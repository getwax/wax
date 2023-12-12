// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {MockGroth16Verifier} from "./utils/MockGroth16Verifier.sol";

contract Enum {
    enum Operation {
        Call,
        DelegateCall
    }
}

interface ISafe {
    /// @dev Allows a Module to execute a Safe transaction without any further confirmations.
    /// @param to Destination address of module transaction.
    /// @param value Ether value of module transaction.
    /// @param data Data payload of module transaction.
    /// @param operation Operation type of module transaction.
    function execTransactionFromModule(
        address to,
        uint256 value,
        bytes calldata data,
        Enum.Operation operation
    ) external returns (bool success);

    function isModuleEnabled(address module) external view returns (bool);
}

interface ISafeECDSAPlugin {
    function getOwner(address safe) external view returns (address);
}

struct ZkEmailRecoveryStorage {
    bytes32 recoveryHash;
}

contract SafeZkEmailRecoveryPlugin {
    bytes32 immutable RECOVERY_HASH_DOMAIN;
    string public constant DOMAIN_NAME = "RECOVERY_PLUGIN";
    uint256 public constant DOMAIN_VERSION = 1;

    mapping(address => ZkEmailRecoveryStorage) public zkEmailRecoveryStorage;

    error INVALID_GUARDIAN_HASH(
        bytes32 recoveryHash,
        bytes32 expectedGuardianHash
    );
    error MODULE_NOT_ENABLED();
    error INVALID_OWNER(address expectedOwner, address owner);
    error INVALID_PROOF();

    MockGroth16Verifier public immutable verifier;

    constructor(address _verifier) {
        verifier = MockGroth16Verifier(_verifier);
        RECOVERY_HASH_DOMAIN = keccak256(
            abi.encodePacked(
                DOMAIN_NAME,
                DOMAIN_VERSION,
                block.chainid,
                address(this)
            )
        );
    }

    function getZkEmailRecoveryStorage(
        address safe
    ) external view returns (ZkEmailRecoveryStorage memory) {
        return zkEmailRecoveryStorage[safe];
    }

    function addRecoveryAccount(
        bytes32 recoveryHash,
        address owner,
        address ecsdaPlugin
    ) external {
        address safe = msg.sender;

        bool moduleEnabled = ISafe(safe).isModuleEnabled(address(this));
        if (!moduleEnabled) revert MODULE_NOT_ENABLED();

        address expectedOwner = ISafeECDSAPlugin(ecsdaPlugin).getOwner(safe);
        if (owner != expectedOwner) revert INVALID_OWNER(expectedOwner, owner);

        zkEmailRecoveryStorage[safe] = ZkEmailRecoveryStorage(recoveryHash);
    }

    function recoverAccount(
        address safe,
        address ecdsaPlugin,
        address newOwner,
        string memory salt,
        bytes32 email,
        uint256[2] memory a,
        uint256[2][2] memory b,
        uint256[2] memory c,
        uint256[1] memory publicSignals
    ) external {
        ZkEmailRecoveryStorage memory recoveryStorage = zkEmailRecoveryStorage[
            safe
        ];

        // Identity of guardian is protected and it is only revealed on recovery
        bytes32 expectedRecoveryHash = keccak256(
            abi.encodePacked(RECOVERY_HASH_DOMAIN, email, salt)
        );

        if (expectedRecoveryHash != recoveryStorage.recoveryHash) {
            revert INVALID_GUARDIAN_HASH(
                recoveryStorage.recoveryHash,
                expectedRecoveryHash
            );
        }

        // verify proof
        bool verified = verifier.verifyProof(a, b, c, publicSignals);
        if (!verified) revert INVALID_PROOF();

        bytes memory data = abi.encodeWithSignature(
            "enable(bytes)",
            abi.encodePacked(newOwner)
        );

        ISafe(safe).execTransactionFromModule(
            ecdsaPlugin,
            0,
            data,
            Enum.Operation.Call
        );
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {ECDSA} from "openzeppelin-contracts/contracts/utils/cryptography/ECDSA.sol";

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

struct ECDSARecoveryStorage {
    bytes32 recoveryHash;
}

contract SafeECDSARecoveryPlugin {
    using ECDSA for bytes32;

    bytes32 immutable RECOVERY_HASH_DOMAIN;
    string public constant DOMAIN_NAME = "RECOVERY_PLUGIN";
    uint256 public constant DOMAIN_VERSION = 1;

    mapping(address => ECDSARecoveryStorage) public ecdsaRecoveryStorage;

    error INVALID_GUARDIAN_HASH(
        bytes32 recoveryHash,
        bytes32 expectedGuardianHash
    );
    error SAFE_ZERO_ADDRESS();
    error MODULE_NOT_ENABLED();
    error MSG_SENDER_NOT_PLUGIN_OWNER(address sender, address pluginOwner);
    error INVALID_NEW_GUARDIAN_SIGNATURE();
    error INVALID_NEW_OWNER_SIGNATURE();

    constructor() {
        RECOVERY_HASH_DOMAIN = keccak256(
            abi.encodePacked(
                DOMAIN_NAME,
                DOMAIN_VERSION,
                block.chainid,
                address(this)
            )
        );
    }

    function getEcdsaRecoveryStorage(
        address safe
    ) external view returns (ECDSARecoveryStorage memory) {
        return ecdsaRecoveryStorage[safe];
    }

    function addRecoveryAccount(
        bytes32 recoveryHash,
        address owner,
        address ecsdaPlugin
    ) external {
        address safe = msg.sender;
        if (safe == address(0)) revert SAFE_ZERO_ADDRESS();

        bool moduleEnabled = ISafe(safe).isModuleEnabled(address(this));
        if (!moduleEnabled) revert MODULE_NOT_ENABLED();

        address expectedOwner = ISafeECDSAPlugin(ecsdaPlugin).getOwner(safe);
        if (owner != expectedOwner)
            revert MSG_SENDER_NOT_PLUGIN_OWNER(msg.sender, owner);

        ecdsaRecoveryStorage[safe] = ECDSARecoveryStorage(recoveryHash);
    }

    function resetEcdsaAddress(
        bytes memory newOwnerSignature,
        bytes memory guardianSignature,
        address guardian,
        string memory salt,
        address ecdsaPlugin,
        address currentOwner,
        address newOwner
    ) external {
        address safe = msg.sender;

        ECDSARecoveryStorage memory recoveryStorage = ecdsaRecoveryStorage[
            safe
        ];

        // Identity of guardian is protected and it is only revealed on recovery
        bytes32 expectedRecoveryHash = keccak256(
            abi.encodePacked(RECOVERY_HASH_DOMAIN, guardian, currentOwner, salt)
        );

        if (expectedRecoveryHash != recoveryStorage.recoveryHash) {
            revert INVALID_GUARDIAN_HASH(
                recoveryStorage.recoveryHash,
                expectedRecoveryHash
            );
        }

        bytes32 ethSignedHash = expectedRecoveryHash.toEthSignedMessageHash();
        if (guardian != ethSignedHash.recover(guardianSignature))
            revert INVALID_NEW_GUARDIAN_SIGNATURE();

        bytes32 currentOwnerHash = keccak256(abi.encodePacked(currentOwner));
        ethSignedHash = currentOwnerHash.toEthSignedMessageHash();

        if (newOwner != ethSignedHash.recover(newOwnerSignature))
            revert INVALID_NEW_OWNER_SIGNATURE();

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

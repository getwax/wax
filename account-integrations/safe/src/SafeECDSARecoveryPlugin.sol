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
}

interface ISafeECDSAPlugin {
    function getOwner(address safe) external view returns (address);
}

struct ECDSARecoveryStorage {
    bytes32 guardianHash;
    address safe;
}

contract SafeECDSARecoveryPlugin {
    using ECDSA for bytes32;

    string public constant RECOVER_ACCOUNT_DOMAIN = "RECOVER_ACCOUNT_DOMAIN";

    mapping(address => ECDSARecoveryStorage) public ecdsaRecoveryStorage;

    error INVALID_GUARDIAN_HASH(
        bytes32 guardianHash,
        bytes32 expectedGuardianHash
    );
    error SAFE_ZERO_ADDRESS();
    error MSG_SENDER_NOT_PLUGIN_OWNER(address sender, address pluginOwner);
    error ATTEMPTING_RESET_ON_WRONG_SAFE(
        address attemptedSafe,
        address storedSafe
    );
    error INVALID_NEW_OWNER_SIGNATURE();

    constructor() {}

    function getEcdsaRecoveryStorage(
        address owner
    ) external view returns (ECDSARecoveryStorage memory) {
        return ecdsaRecoveryStorage[owner];
    }

    function addRecoveryAccount(
        bytes32 guardianHash,
        address safe,
        address ecsdaPlugin
    ) external {
        if (safe == address(0)) revert SAFE_ZERO_ADDRESS();

        address owner = ISafeECDSAPlugin(ecsdaPlugin).getOwner(safe);
        if (msg.sender != owner)
            revert MSG_SENDER_NOT_PLUGIN_OWNER(msg.sender, owner);

        ecdsaRecoveryStorage[msg.sender] = ECDSARecoveryStorage(
            guardianHash,
            safe
        );
    }

    function resetEcdsaAddress(
        bytes memory newOwnerSignature,
        string memory salt,
        address safe,
        address ecdsaPlugin,
        address currentOwner,
        address newOwner
    ) external {
        ECDSARecoveryStorage memory recoveryStorage = ecdsaRecoveryStorage[
            currentOwner
        ];

        // Identity of guardian is protected and it is only revealed on recovery
        bytes32 expectedRecoveryHash = keccak256(
            abi.encode(
                RECOVER_ACCOUNT_DOMAIN,
                msg.sender,
                address(this),
                currentOwner,
                block.chainid,
                salt
            )
        );

        if (expectedRecoveryHash != recoveryStorage.guardianHash) {
            revert INVALID_GUARDIAN_HASH(
                recoveryStorage.guardianHash,
                expectedRecoveryHash
            );
        }

        if (safe != recoveryStorage.safe) {
            revert ATTEMPTING_RESET_ON_WRONG_SAFE(safe, recoveryStorage.safe);
        }

        bytes32 currentOwnerHash = keccak256(abi.encode(currentOwner));
        bytes32 ethSignedHash = currentOwnerHash.toEthSignedMessageHash();

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

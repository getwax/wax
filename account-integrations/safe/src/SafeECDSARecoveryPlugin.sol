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
    address recoveryAccount;
    address safe;
}

contract SafeECDSARecoveryPlugin {
    using ECDSA for bytes32;

    mapping(address => ECDSARecoveryStorage) public ecdsaRecoveryStorage;

    error SENDER_NOT_RECOVERY_ACCOUNT(address sender, address recoveryAccount);
    error SAFE_ZERO_ADDRESS();
    error MSG_SENDER_NOT_PLUGIN_OWNER(address sender, address pluginOwner);
    error ATTEMPTING_RESET_ON_WRONG_SAFE(
        address attemptedSafe,
        address storedSafe
    );
    error RECOVERY_ACCOUNT_DID_NOT_SIGN_MESSAGE();
    error INVALID_RECOVERY_HASH();

    constructor() {}

    function getEcdsaRecoveryStorage(
        address owner
    ) external view returns (ECDSARecoveryStorage memory) {
        return ecdsaRecoveryStorage[owner];
    }

    // TODO: (merge-ok) prove signature cannot be replayed
    function addRecoveryAccount(
        bytes memory recoveryHashSignature,
        address recoveryAccount,
        address safe,
        address ecsdaPlugin
    ) external {
        if (safe == address(0)) revert SAFE_ZERO_ADDRESS();

        address owner = ISafeECDSAPlugin(ecsdaPlugin).getOwner(safe);
        if (msg.sender != owner)
            revert MSG_SENDER_NOT_PLUGIN_OWNER(msg.sender, owner);

        bytes32 expectedRecoveryHash = keccak256(abi.encode(recoveryAccount));
        bytes32 ethSignedRecoveryHash = expectedRecoveryHash
            .toEthSignedMessageHash();

        if (
            recoveryAccount !=
            ethSignedRecoveryHash.recover(recoveryHashSignature)
        ) {
            revert RECOVERY_ACCOUNT_DID_NOT_SIGN_MESSAGE();
        }

        ecdsaRecoveryStorage[msg.sender] = ECDSARecoveryStorage(
            recoveryAccount,
            safe
        );
    }

    function resetEcdsaAddress(
        bytes memory recoveryHashSignature,
        address safe,
        address ecdsaPlugin,
        address currentOwner,
        address newOwner
    ) external {
        ECDSARecoveryStorage memory recoveryStorage = ecdsaRecoveryStorage[
            currentOwner
        ];
        if (safe != recoveryStorage.safe) {
            revert ATTEMPTING_RESET_ON_WRONG_SAFE(safe, recoveryStorage.safe);
        }

        bytes32 expectedRecoveryHash = keccak256(
            abi.encode(recoveryStorage.recoveryAccount)
        );
        bytes32 ethSignedRecoveryHash = expectedRecoveryHash
            .toEthSignedMessageHash();

        if (
            recoveryStorage.recoveryAccount !=
            ethSignedRecoveryHash.recover(recoveryHashSignature)
        ) {
            revert INVALID_RECOVERY_HASH();
        }

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

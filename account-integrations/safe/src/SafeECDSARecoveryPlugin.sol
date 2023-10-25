// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

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
    mapping(address => ECDSARecoveryStorage) public ecdsaRecoveryStorage;

    error SENDER_NOT_RECOVERY_ACCOUNT(address sender, address recoveryAccount);
    error SAFE_ZERO_ADDRESS();
    error MSG_SENDER_NOT_PLUGIN_OWNER(address sender, address pluginOwner);
    error ATTEMPTING_RESET_ON_WRONG_SAFE(
        address attemptedSafe,
        address storedSafe
    );

    constructor() {}

    function getEcdsaRecoveryStorage(
        address owner
    ) external view returns (ECDSARecoveryStorage memory) {
        return ecdsaRecoveryStorage[owner];
    }

    modifier onlyRecoveryAccount(address currentOwner) {
        address recoveryAccount = ecdsaRecoveryStorage[currentOwner]
            .recoveryAccount;
        if (msg.sender != recoveryAccount) {
            revert SENDER_NOT_RECOVERY_ACCOUNT(msg.sender, recoveryAccount);
        }
        _;
    }

    // TODO: (merge-ok) prove recovery address owner possesses private key and proof cannot be replayed
    function addRecoveryAccount(
        address recoveryAccount,
        address safe,
        address ecsdaPlugin
    ) external {
        if (safe == address(0)) revert SAFE_ZERO_ADDRESS();

        address owner = ISafeECDSAPlugin(ecsdaPlugin).getOwner(safe);
        if (msg.sender != owner)
            revert MSG_SENDER_NOT_PLUGIN_OWNER(msg.sender, owner);

        ecdsaRecoveryStorage[msg.sender] = ECDSARecoveryStorage(
            recoveryAccount,
            safe
        );
    }

    function resetEcdsaAddress(
        address safe,
        address ecdsaPlugin,
        address currentOwner,
        address newOwner
    ) external onlyRecoveryAccount(currentOwner) {
        address storedSafe = ecdsaRecoveryStorage[currentOwner].safe;
        if (safe != storedSafe) {
            revert ATTEMPTING_RESET_ON_WRONG_SAFE(safe, storedSafe);
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

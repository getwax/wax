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

contract RecoveryPlugin {
    address private immutable storedEOA;
    address public storedSafe;

    error SENDER_NOT_STORED_EOA(address sender);
    error ATTEMPTING_RESET_ON_WRONG_SAFE(address attemptedSafe);

    constructor(address _safe, address _eoa) {
        storedSafe = _safe;
        storedEOA = _eoa;
    }

    modifier onlyStoredEOA {
        if (msg.sender != storedEOA) {
            revert SENDER_NOT_STORED_EOA(msg.sender);
        }
        _;
    }

    function resetEcdsaAddress(
        address safe,
        address ecdsaPluginAddress,
        address newValidatingEcdsaAddress
    ) external onlyStoredEOA {
        if (safe != storedSafe) {
            revert ATTEMPTING_RESET_ON_WRONG_SAFE(safe);
        }

        bytes memory data = abi.encodeWithSignature("updateOwner(address)", newValidatingEcdsaAddress);
        ISafe(safe).execTransactionFromModule(ecdsaPluginAddress, 0, data, Enum.Operation.Call);
    }
}

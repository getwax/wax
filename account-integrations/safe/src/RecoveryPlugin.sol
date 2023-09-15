// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "hardhat/console.sol";

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
    address public storedEOA;
    address public safe;

    constructor(address _safe, address _eoa) {
        safe = _safe;
        storedEOA = _eoa;
    }

    function getData(address testSafe, address ecdsaaddress, address newAddress) external {
        require(msg.sender == storedEOA, "Only the current EOA can set a new EOA");
        require(testSafe == safe, "Only attempt tx on safed safe");

        console.log("rp - safe address: ", safe);
        console.log("rp - msg.sender: ", msg.sender);
        console.log("rp - storedEOA: ", storedEOA);

        bytes memory data = abi.encodeWithSignature("updateOwner(address)", newAddress);
        ISafe(testSafe).execTransactionFromModule(ecdsaaddress, 0, data, Enum.Operation.Call);
    }

    // TODO: consider checking a message hash instead of the address of the module
    // function recoverSafeIfSigned(bytes memory signature) external {
    //     // This message is what you sign: the address of this module
    //     bytes32 message = prefixed(keccak256(abi.encodePacked(address(this))));
        
    //     require(recoverSigner(message, signature) == storedEOA, "Invalid signature");

    //     // Calling recover on the safe
    //     ISafe(safe).recover();
    // }
}

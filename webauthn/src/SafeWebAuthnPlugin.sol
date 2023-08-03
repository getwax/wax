// SPDX-License-Identifier: LGPL-3.0-only
// pragma solidity ^0.8.0;
pragma solidity >=0.7.0 <0.9.0;
pragma abicoder v2;

import {BaseAccount} from "@account-abstraction/contracts/core/BaseAccount.sol";
import {IEntryPoint, UserOperation} from "@account-abstraction/contracts/interfaces/IEntryPoint.sol";
import {UserOperation} from "@account-abstraction/contracts/interfaces/IEntryPoint.sol";

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

interface ISafe {
    function enableModule(address module) external;

    function execTransactionFromModule(address to, uint256 value, bytes memory data, uint8 operation) external returns (bool success);
}

/// @dev A Dummy 4337 Module/Handler for testing purposes
///      ⚠️ ⚠️ ⚠️ DO NOT USE IN PRODUCTION ⚠️ ⚠️ ⚠️
///      The module does not perform ANY validation, it just executes validateUserOp and execTransaction
///      to perform the opcode level compliance by the bundler.
contract Test4337ModuleAndHandler is BaseAccount {
    using ECDSA for bytes32;

    address public immutable myAddress;
    address private immutable _owner;
    address private immutable _entryPoint;

    address internal constant SENTINEL_MODULES = address(0x1);

    constructor(address entryPointAddress, address ownerAddress) {
        myAddress = address(this);
        _owner = ownerAddress;
        _entryPoint = entryPointAddress;
    }

    function validateUserOp(
        UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external override returns (uint256 validationData) {
        address payable safeAddress = payable(userOp.sender);
        ISafe senderSafe = ISafe(safeAddress);

        if (missingAccountFunds != 0) {
            senderSafe.execTransactionFromModule(_entryPoint, missingAccountFunds, "", 0);
        }

        validationData = _validateSignature(userOp, userOpHash);
    }

    function execTransaction(address to, uint256 value, bytes calldata data) external payable {
        address payable safeAddress = payable(msg.sender);
        ISafe safe = ISafe(safeAddress);
        require(safe.execTransactionFromModule(to, value, data, 0), "tx failed");
    }

    function enableMyself() public {
        ISafe(address(this)).enableModule(myAddress);
    }

    function entryPoint() public view override returns (IEntryPoint) {
        return IEntryPoint(_entryPoint);
    }

    function owner() public view returns (address) {
        return _owner;
    }

    function _validateSignature(UserOperation calldata userOp, bytes32 userOpHash) internal override returns (uint256 validationData) {
        bytes32 hash = userOpHash.toEthSignedMessageHash();
        if (_owner != hash.recover(userOp.signature)) return SIG_VALIDATION_FAILED;
        return 0;
    }
}

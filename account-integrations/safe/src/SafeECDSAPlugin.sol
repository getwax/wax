// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;
pragma abicoder v2;

import {BaseAccount} from "account-abstraction/contracts/core/BaseAccount.sol";
import {IEntryPoint, UserOperation} from "account-abstraction/contracts/interfaces/IEntryPoint.sol";
import {UserOperation} from "account-abstraction/contracts/interfaces/IEntryPoint.sol";

import {ECDSA} from "openzeppelin-contracts/contracts/utils/cryptography/ECDSA.sol";

import "hardhat/console.sol";

interface ISafe {
    function enableModule(address module) external;

    function execTransactionFromModule(
        address to,
        uint256 value,
        bytes memory data,
        uint8 operation
    ) external returns (bool success);

    function isModuleEnabled(address module) external view returns (bool);
}

contract SafeECDSAPlugin is BaseAccount {
    using ECDSA for bytes32;

    address public immutable myAddress; // Module address
    address private _owner; // Safe address
    address private immutable _entryPoint;

    address internal constant _SENTINEL_MODULES = address(0x1);

    error NONCE_NOT_SEQUENTIAL();

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
        _validateNonce(userOp.nonce);
        validationData = _validateSignature(userOp, userOpHash);
        _payPrefund(missingAccountFunds);
    }

    function execTransaction(
        address to,
        uint256 value,
        bytes calldata data
    ) external payable {
        address payable safeAddress = payable(msg.sender);
        ISafe safe = ISafe(safeAddress);
        require(
            safe.execTransactionFromModule(to, value, data, 0),
            "tx failed"
        );
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

    function updateOwner(address newOwner) public {
        console.log("ecdsa - message.sender:        ", msg.sender);
        console.log("ecdsa - owner (key address):  ", _owner);
        console.log("ecdsa - myAddress (module):    ", myAddress);
        console.log("ecdsa - entrypoint:            ", _entryPoint);
        console.log("ecdsa - address(this):         ", address(this));
        bool isModuleEnabled = ISafe(msg.sender).isModuleEnabled(address(this));
        console.log("ecdsa - moduleEnabled:         ", isModuleEnabled);
        console.log("here");
        // require(msg.sender == _owner, "Only the safe can update the owner"); // todo this doesn't work
        _owner = newOwner;
        // Todo fire event
    }

    function _validateSignature(
        UserOperation calldata userOp,
        bytes32 userOpHash
    ) internal view override returns (uint256 validationData) {
        bytes32 hash = userOpHash.toEthSignedMessageHash();
        if (_owner != hash.recover(userOp.signature))
            return SIG_VALIDATION_FAILED;
        return 0;
    }

    /**
     * Ensures userOp nonce is sequential. Nonce uniqueness is already managed by the EntryPoint.
     * This function prevents using a “key” different from the first “zero” key.
     * @param nonce to validate
     */
    function _validateNonce(uint256 nonce) internal pure override {
        if (nonce >= type(uint64).max) {
            revert NONCE_NOT_SEQUENTIAL();
        }
    }

    /**
     * This function is overridden as this plugin does not hold funds, so the transaction
     * has to be executed from the sender Safe
     * @param missingAccountFunds The minimum value this method should send to the entrypoint
     */
    function _payPrefund(uint256 missingAccountFunds) internal override {
        address payable safeAddress = payable(msg.sender);
        ISafe senderSafe = ISafe(safeAddress);

        if (missingAccountFunds != 0) {
            senderSafe.execTransactionFromModule(
                _entryPoint,
                missingAccountFunds,
                "",
                0
            );
        }
    }
}

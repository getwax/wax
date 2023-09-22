// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0 <0.9.0;

import {BaseAccount} from "account-abstraction/contracts/core/BaseAccount.sol";
import {IEntryPoint, UserOperation} from "account-abstraction/contracts/interfaces/IEntryPoint.sol";

import {FCL_WebAuthn} from "./lib/FCL_Webauthn.sol";

interface ISafe {
    function enableModule(address module) external;

    function execTransactionFromModule(
        address to,
        uint256 value,
        bytes memory data,
        uint8 operation
    ) external returns (bool success);
}

contract SafeWebAuthnPlugin is BaseAccount {
    address public immutable myAddress;
    address private immutable _entryPoint;
    uint256[2] private _publicKey;

    address internal constant _SENTINEL_MODULES = address(0x1);

    error NONCE_NOT_SEQUENTIAL();

    constructor(address entryPointAddress, uint256[2] memory pubKey) {
        myAddress = address(this);
        _entryPoint = entryPointAddress;
        _publicKey = pubKey;
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

    function publicKey() public view returns (uint256[2] memory) {
        return _publicKey;
    }

    // Struct declaration to hold multiple local vars.
    // Prevents stack from getting too deep for evm.
    struct LocalVarWrapper {
        bytes1 authenticatorDataFlagMask;
        bytes32 clientChallenge;
        uint256 clientChallengeDataOffset;
    }

    function _validateSignature(
        UserOperation calldata userOp,
        bytes32 userOpHash
    ) internal override returns (uint256 validationData) {
        bytes calldata authenticatorData;
        bytes calldata clientData;
        uint256[2] calldata signature;
        uint256[2] calldata pubKey;
        LocalVarWrapper memory wrapper;

        // scope to contain local variables that can be popped from the stack after use
        {
            // parse length of all fixed-length params (including length)
            uint i = 0;
            uint dataLen = 32;
            uint256 paramLen = abi.decode(userOp.signature[i:i+dataLen], (uint256));
            // Fixed-length params (bytes1, (uint256?), bytes32, uint256, uint256[2], uint256[2]). Expect 9 slots = 256 bytes
            i += dataLen; // advance index

            // decode fixed length params (values to memory)
            dataLen = paramLen - 32; // length already read
            dataLen -= 2 * 2 * 32; // exclude fixed length arrays
            (
                wrapper.authenticatorDataFlagMask,
                , // some number
                wrapper.clientChallenge,
                wrapper.clientChallengeDataOffset
            ) = abi.decode(
                userOp.signature[i:i+dataLen],
                (
                    bytes1,
                    uint256, //not sure what is encoded here
                    bytes32,
                    uint256
                )
            );
            i += dataLen; // advance index


            bytes calldata calldataLocation;
            // load fixed length array params (pointers to calldata)
            dataLen = 2 * 32;
            calldataLocation = userOp.signature[i:i+dataLen];
            assembly{
                signature := calldataLocation.offset
            }
            i += dataLen; // advance index

            calldataLocation = userOp.signature[i:i+dataLen];
            assembly{
                pubKey := calldataLocation.offset
            }
            i += dataLen; // advance index

            // parse length of authenticatorData
            dataLen = 32;
            paramLen = abi.decode(userOp.signature[i:i+dataLen], (uint256));
            i += dataLen; // advance index
            // assign authenticatorData to sig splice
            dataLen = paramLen;
            authenticatorData = userOp.signature[i:i+dataLen];
            i += ((dataLen >> 5) + 1) << 5; // advance index (round up to next slot)

            // parse length of clientData
            dataLen = 32;
            paramLen = abi.decode(userOp.signature[i:i+dataLen], (uint256));
            i += dataLen; // advance index
            // assign clientData to sig splice
            dataLen = paramLen;
            clientData = userOp.signature[i:i+dataLen];
            // i += ((dataLen >> 5) + 1) << 5; // advance index (round up to next slot)
        } // end scope to free vars from stack

        bool verified = FCL_WebAuthn.checkSignature(
            authenticatorData,
            wrapper.authenticatorDataFlagMask,
            clientData,
            wrapper.clientChallenge,
            wrapper.clientChallengeDataOffset,
            signature,
            pubKey
        );
        if (!verified) return SIG_VALIDATION_FAILED;
        return 0;
    }

    /**
     * Ensures userOp nonce is sequential. Nonce uniqueness is already managed by the EntryPoint.
     * This function prevents using a “key” different from the first “zero” key.
     * @param nonce to validate
     */
    function _validateNonce(uint256 nonce) internal view override {
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

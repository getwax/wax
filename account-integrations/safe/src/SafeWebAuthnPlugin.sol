// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0 <0.9.0;

import "forge-std/Test.sol";

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

    struct LocalVarStruct {
        bytes1 authenticatorDataFlagMask;
        uint256 clientChallengeDataOffset;
    }

    function _validateSignature(
        UserOperation calldata userOp,
        bytes32 userOpHash
    ) internal override returns (uint256 validationData) {
        console2.logString("SIG");
        console2.logBytes(userOp.signature);
        bytes calldata authenticatorData;
        bytes calldata clientData;
        uint256[2] calldata signature;
        uint256[2] calldata pubKey;
        LocalVarStruct memory s;

        {            
            // parse length of all fixed-length params (including length)
            uint i = 0;
            uint dataLen = 32;
            uint256 paramLen = abi.decode(userOp.signature[i:i+dataLen], (uint256));
            console2.logString("PARAM LEN");
            console2.logUint(paramLen);
            // Fixed-length params (bytes1, (uint256?), uint256, uint256[2], uint256[2]). Expect 8 slots = 256 bytes
            i += dataLen; // advance index

            // decode fixed length params (values to memory)
            dataLen = 3 * 32; //lenFixedParams - 32; // -32 already read length
            (
                s.authenticatorDataFlagMask,
                , // some number
                s.clientChallengeDataOffset
            ) = abi.decode(
                userOp.signature[i:i+dataLen],
                (
                    bytes1,
                    uint256, //not sure what is encoded here
                    uint256
                )
            );
            i += dataLen; // advance index
            console2.logString("FIXED COPY");
            console2.log(uint8(s.authenticatorDataFlagMask));
            console2.log("%x", s.clientChallengeDataOffset);


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
            console2.logString("FIXED CALLDATA");
            console2.log("%x, %x", signature[0], signature[1]);
            console2.log("%x, %x", pubKey[0], pubKey[1]);

            // parse length of authenticatorData
            dataLen = 32;
            paramLen = abi.decode(userOp.signature[i:i+dataLen], (uint256));
            console2.logString("AUTH LEN");
            console2.log(paramLen);
            // i += dataLen; // advance index
            // assign authenticatorData to sig splice
            dataLen = ((paramLen >> 5) + 1) << 5; // (round up to next slot)
            dataLen += 32; //include index
            console2.logString("AUTH DATALEN");
            console2.log(dataLen);

            authenticatorData = userOp.signature[i:i+dataLen];
            console2.logString("AUTH DATA");
            console2.logBytes(authenticatorData);
            // i += ((dataLen >> 5) + 1) << 5; // advance index (round up to next slot)
            i += dataLen;

            // parse length of clientData
            dataLen = 32;
            paramLen = abi.decode(userOp.signature[i:i+dataLen], (uint256));
            console2.logString("CLIENT LEN");
            console2.log(paramLen);
            // i += dataLen; // advance index
            // assign clientData to sig splice
            dataLen = ((paramLen >> 5) + 1) << 5; // (round up to next slot)
            dataLen += 32;
            console2.logString("CLIENT DATALEN");
            console2.log(dataLen);
            clientData = userOp.signature[i:i+dataLen];
            console2.logString("CLIENT DATA");
            console2.logBytes(clientData);
            // i += ((dataLen >> 5) + 1) << 5; // advance index (round up to next slot)
            i += dataLen;
        }
/*
            0000000000000000000000000000000000000000000000000000000000000100 // 256 = 8 x 32 slots

            0100000000000000000000000000000000000000000000000000000000000000 // authenticatorDataFlagMask

            0000000000000000000000000000000000000000000000000000000000000160 // 352?

            0000000000000000000000000000000000000000000000000000000000000024 // clientChallengeDataOffset

            515562d3cb505fff416437050b64d207a4935c42ff3ddda1ac3ac70fcc3424f5
            85f7cf6ac11bcf378b7dcdffbfc74afc38b59438fa60690745d064b1de74ba01

            bbe2ce868d703d08aab8866f2565c6c3eea7bccb3198a7c8056a317ea26ab7f1
            90766bfd35b6502e5a989d4cbc4c8bc651bbf95bfc8dff137f4981c9162d7342

            0000000000000000000000000000000000000000000000000000000000000025 // 37 bytes
            1584482fdf7a4d0b7eb9d45cf835288cb59e55b8249fff356e33be88ecc546d1
            1d00000000000000000000000000000000000000000000000000000000000000
            ##########

            0000000000000000000000000000000000000000000000000000000000000092 // 146 bytes
            7b2274797065223a22776562617574686e2e676574222c226368616c6c656e67
            65223a22efbfbd22efbfbd5f21efbfbd1b113e63efbfbdefbfbd6defbfbd4fef // 64
            bfbdefbfbd11efbfbd11efbfbd40efbfbdefbfbdefbfbd64efbfbdefbfbd3cef
            bfbd58222c226f726967696e223a2268747470733a2f2f646576656c6f706d65 // 128
            6e742e666f72756d64616f732e636f6d227d0000000000000000000000000000 // +18
            ####################################
*/

        // (
        //     bytes calldata authenticatorData,
        //     bytes1 authenticatorDataFlagMask,
        //     bytes calldata clientData,
        //     uint256 clientChallengeDataOffset,
        //     uint256[2] calldata signature,
        //     uint256[2] calldata pubKey
        // ) = abi.decode(
        //         userOp.signature,
        //         (bytes, bytes1, bytes, uint256, uint256[2], uint256[2])
        //     );

        // (
        //     bytes memory authenticatorData,
        //     bytes1 authenticatorDataFlagMask,
        //     bytes memory clientData,
        //     uint256 clientChallengeDataOffset,
        //     uint256[2] memory signature,
        //     uint256[2] memory pubKey
        // ) = abi.decode(
        //         userOp.signature,
        //         (bytes, bytes1, bytes, uint256, uint256[2], uint256[2])
        //     );

        bool verified = FCL_WebAuthn.checkSignature(
            authenticatorData,
            s.authenticatorDataFlagMask,
            clientData,
            userOpHash,
            s.clientChallengeDataOffset,
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

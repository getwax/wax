// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0 <0.9.0;

import {HandlerContext} from "safe-contracts/contracts/handler/HandlerContext.sol";
import {BaseAccount} from "account-abstraction/contracts/core/BaseAccount.sol";
import {IEntryPoint, PackedUserOperation} from "account-abstraction/contracts/interfaces/IEntryPoint.sol";
import {WebAuthn} from "../primitives/WebAuthn.sol";

import {Safe4337Base, SIG_VALIDATION_FAILED} from "./utils/Safe4337Base.sol";

interface ISafe {
    function enableModule(address module) external;

    function execTransactionFromModule(
        address to,
        uint256 value,
        bytes memory data,
        uint8 operation
    ) external returns (bool success);
}

contract SafeWebAuthnPlugin is Safe4337Base, WebAuthn {
    address public immutable myAddress;
    address private immutable _entryPoint;
    uint256[2] private _publicKey;

    address internal constant _SENTINEL_MODULES = address(0x1);

    constructor(address entryPointAddress, uint256[2] memory pubKey) {
        myAddress = address(this);
        _entryPoint = entryPointAddress;
        _publicKey = pubKey;
    }

    function execTransaction(
        address to,
        uint256 value,
        bytes calldata data
    ) external payable {
        _requireFromEntryPoint();

        require(
            _currentSafe().execTransactionFromModule(to, value, data, 0),
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
        PackedUserOperation calldata userOp,
        bytes32 /*userOpHash*/
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
            // Fixed-length params (bytes1, (uint256?), bytes32, uint256, uint256[2], uint256[2]). Expect 9 slots (288 bytes)
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

        bool verified = verifySignature(
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
}

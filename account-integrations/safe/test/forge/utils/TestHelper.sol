// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "forge-std/Test.sol";
import {EntryPoint, UserOperation} from "account-abstraction/contracts/core/EntryPoint.sol";
import {Webauthn} from "../../../src/WebAuthn.sol";

/* solhint-disable private-vars-leading-underscore */

abstract contract TestHelper is Test {
    EntryPoint public entryPoint;
    address internal entryPointAddress;

    address internal constant ALICE = address(1);
    address internal constant BOB = address(2);
    address[] internal testAccounts = [ALICE, BOB];

    constructor() {
        entryPoint = new EntryPoint();
        entryPointAddress = address(entryPoint);
    }

    function buildUserOp() public pure returns (UserOperation memory userOp) {
        address sender = ALICE;
        uint256 nonce = 0;
        bytes memory initCode = hex"00";
        bytes memory callData = hex"00";
        uint256 callGasLimit = 0;
        uint256 verificationGasLimit = 0;
        uint256 preVerificationGas = 0;
        uint256 maxFeePerGas = 0;
        uint256 maxPriorityFeePerGas = 0;
        bytes memory paymasterAndData = hex"00";
        bytes memory signature = hex"00";

        userOp = UserOperation(
            sender,
            nonce,
            initCode,
            callData,
            callGasLimit,
            verificationGasLimit,
            preVerificationGas,
            maxFeePerGas,
            maxPriorityFeePerGas,
            paymasterAndData,
            signature
        );
    }

    function getWebAuthnPublicKey()
        internal
        pure
        returns (uint256[2] memory publicKey)
    {
        publicKey = [
            84983235508986227069118519878575107221347312419117152995971180204793547896817,
            65342283463016373417889909198331793507107976344099657471582098851386861908802
        ];
    }

    function getWebAuthnSignatureValues()
        internal
        pure
        returns (
            bytes memory authenticatorData,
            bytes1 authenticatorDataFlagMask,
            bytes memory clientData,
            bytes32 messageHash,
            uint256 clientChallengeDataOffset,
            uint256[2] memory signature
        )
    {
        authenticatorData = hex"1584482fdf7a4d0b7eb9d45cf835288cb59e55b8249fff356e33be88ecc546d11d00000000";
        authenticatorDataFlagMask = 0x01;
        clientData = hex"7b2274797065223a22776562617574686e2e676574222c226368616c6c656e6765223a22efbfbd22efbfbd5f21efbfbd1b113e63efbfbdefbfbd6defbfbd4fefbfbdefbfbd11efbfbd11efbfbd40efbfbdefbfbdefbfbd64efbfbdefbfbd3cefbfbd58222c226f726967696e223a2268747470733a2f2f646576656c6f706d656e742e666f72756d64616f732e636f6d227d";
        messageHash = keccak256("test");
        clientChallengeDataOffset = 36;
        signature = [
            36788204816852931931532076736929768488646494203674172515272861180041446565109,
            60595451626159535380360537025565143491223093262105891867977188941268073626113
        ];
    }

    function getWebAuthnUserOpSignature()
        internal
        pure
        returns (bytes memory userOpSignature)
    {
        (
            bytes memory authenticatorData,
            bytes1 authenticatorDataFlagMask,
            bytes memory clientData,
            ,
            uint256 clientChallengeDataOffset,
            uint256[2] memory signature
        ) = getWebAuthnSignatureValues();
        uint256[2] memory publicKey = getWebAuthnPublicKey();

        userOpSignature = abi.encode(
            authenticatorData,
            authenticatorDataFlagMask,
            clientData,
            clientChallengeDataOffset,
            signature,
            publicKey
        );
    }
}

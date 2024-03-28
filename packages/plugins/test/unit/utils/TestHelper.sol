// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "forge-std/Test.sol";
import {EntryPoint, PackedUserOperation} from "account-abstraction/contracts/core/EntryPoint.sol";

/* solhint-disable private-vars-leading-underscore */
/* solhint-disable var-name-mixedcase */

abstract contract TestHelper is Test {
    EntryPoint public entryPoint;
    address internal entryPointAddress;

    Vm.Wallet internal Alice;
    Vm.Wallet internal Bob;
    Vm.Wallet internal Carol;
    Vm.Wallet internal Dave;

    constructor() {
        entryPoint = new EntryPoint();
        entryPointAddress = address(entryPoint);

        Alice = vm.createWallet("Alice");
        Bob = vm.createWallet("Bob");
        Carol = vm.createWallet("Carol");
        Dave = vm.createWallet("Dave");
    }

    function buildUserOp()
        public
        view
        returns (PackedUserOperation memory userOp)
    {
        address sender = Alice.addr;
        uint256 nonce = 0;
        bytes memory initCode = hex"00";
        bytes memory callData = hex"00";
        bytes32 accountGasLimits = hex"00";
        uint256 preVerificationGas = 0;
        bytes32 gasFees = hex"00";
        bytes memory paymasterAndData = hex"00";
        bytes memory signature = hex"00";

        userOp = PackedUserOperation(
            sender,
            nonce,
            initCode,
            callData,
            accountGasLimits,
            preVerificationGas,
            gasFees,
            paymasterAndData,
            signature
        );
    }

    function getBlsPublicKey()
        internal
        pure
        returns (uint256[4] memory blsPublicKey)
    {
        blsPublicKey = [
            132717240148715495716830092615264954100450741533726881977491253319934626186,
            16529913524269699447728123839564290049462588501612385428117812564372235631213,
            6723802622733259999017759229550901788409326783399870212435371135065148938899,
            20466365198683368208378341278437912769395319265331814663954463565439474504379
        ];
    }

    function getWebAuthnPublicKey()
        internal
        pure
        returns (uint256[2] memory publicKey)
    {
        publicKey = [
            114874632398302156264159990279427641021947882640101801130664833947273521181002,
            32136952818958550240756825111900051564117520891182470183735244184006536587423
        ];
    }

    function getWebAuthnSignatureValues()
        internal
        pure
        returns (
            bytes memory authenticatorData,
            bytes1 authenticatorDataFlagMask,
            bytes memory clientData,
            bytes32 clientChallenge,
            uint256 clientChallengeDataOffset,
            uint256[2] memory signature
        )
    {
        authenticatorData = hex"f8e4b678e1c62f7355266eaa4dc1148573440937063a46d848da1e25babbd20b010000004d";
        authenticatorDataFlagMask = 0x01;
        clientData = hex"7b2274797065223a22776562617574686e2e676574222c226368616c6c656e6765223a224e546f2d3161424547526e78786a6d6b61544865687972444e5833697a6c7169316f776d4f643955474a30222c226f726967696e223a2268747470733a2f2f66726573682e6c65646765722e636f6d222c2263726f73734f726967696e223a66616c73657d";
        clientChallenge = hex"353a3ed5a0441919f1c639a46931de872ac3357de2ce5aa2d68c2639df54189d";
        clientChallengeDataOffset = 36;
        signature = [
            45847212378479006099766816358861726414873720355505495069909394794949093093607,
            55835259151215769394881684156457977412783812617123006733908193526332337539398
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
            bytes32 clientChallenge,
            uint256 clientChallengeDataOffset,
            uint256[2] memory signature
        ) = getWebAuthnSignatureValues();
        uint256[2] memory publicKey = getWebAuthnPublicKey();

        userOpSignature = abi.encode(
            authenticatorData,
            authenticatorDataFlagMask,
            clientData,
            clientChallenge,
            clientChallengeDataOffset,
            signature,
            publicKey
        );
        // console2.logString("authenticatorData");
        // console2.logBytes(authenticatorData);
        // console2.logString("flagMask");
        // console2.logBytes1(authenticatorDataFlagMask);
        // console2.logString("userOp");
        // console2.logBytes(userOpSignature);
    }
}

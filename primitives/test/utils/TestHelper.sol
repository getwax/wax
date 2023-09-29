// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "forge-std/Test.sol";
import {WebAuthn} from "../../src/WebAuthn.sol";

/* solhint-disable private-vars-leading-underscore */

abstract contract TestHelper is Test {
    address internal constant ALICE = address(1);
    address internal constant BOB = address(2);
    address[] internal testAccounts = [ALICE, BOB];

    constructor() {}

    function getWebAuthnPublicKey() internal pure returns (uint256[2] memory publicKey) {
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
        clientData =
            hex"7b2274797065223a22776562617574686e2e676574222c226368616c6c656e6765223a224e546f2d3161424547526e78786a6d6b61544865687972444e5833697a6c7169316f776d4f643955474a30222c226f726967696e223a2268747470733a2f2f66726573682e6c65646765722e636f6d222c2263726f73734f726967696e223a66616c73657d";
        clientChallenge = hex"353a3ed5a0441919f1c639a46931de872ac3357de2ce5aa2d68c2639df54189d";
        clientChallengeDataOffset = 36;
        signature = [
            45847212378479006099766816358861726414873720355505495069909394794949093093607,
            55835259151215769394881684156457977412783812617123006733908193526332337539398
        ];
    }
}

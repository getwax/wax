// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "forge-std/Test.sol";
import {TestHelper} from "./utils/TestHelper.sol";
import {Webauthn} from "../../src/safe-plugins/Webauthn.sol";

/* solhint-disable func-name-mixedcase */

contract WebauthnTest is TestHelper {
    constructor() TestHelper() {}

    Webauthn public webauthn;

    function setUp() public {
        webauthn = new Webauthn();
    }

    function test_verifySignature_ValidSignature() public {
        // Arrange
        (
            bytes memory authenticatorData,
            bytes1 authenticatorDataFlagMask,
            bytes memory clientData,
            bytes32 messageHash,
            uint256 clientChallengeDataOffset,
            uint256[2] memory signature
        ) = getWebAuthnSignatureValues();
        uint256[2] memory publicKey = getPublicKey();

        // Act
        bool verified = webauthn.verifySignature(
            authenticatorData,
            authenticatorDataFlagMask,
            clientData,
            messageHash,
            clientChallengeDataOffset,
            signature,
            publicKey
        );

        // Assert
        assertTrue(verified, "Invalid signature");
    }
}

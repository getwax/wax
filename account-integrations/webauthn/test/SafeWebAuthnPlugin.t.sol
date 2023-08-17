// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "forge-std/Test.sol";
import {TestHelper} from "./utils/TestHelper.sol";
import {Webauthn} from "../src/Webauthn.sol";

contract WebauthnTest is TestHelper {
    constructor() TestHelper() {}

    function setUp() public {
        webauthn = new Webauthn{salt: 0}();
    }

    function test_verifySignature_ValidSignature() public {
        // Arrange
        (
            bytes memory authenticatorData,
            bytes1 authenticatorDataFlagMask,
            bytes memory clientData,
            bytes32 messageHash,
            uint256 clientChallengeDataOffset,
            uint256[2] memory signature,
            uint256[2] memory publicKey
        ) = getPublicKeyAndSignature();

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

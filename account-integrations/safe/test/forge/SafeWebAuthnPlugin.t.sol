// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "forge-std/Test.sol";
import {TestHelper} from "./utils/TestHelper.sol";
import {SafeWebAuthnPluginHarness} from "./utils/SafeWebAuthnPluginHarness.sol";
import {SafeWebAuthnPlugin} from "../../src/SafeWebAuthnPlugin.sol";
import {UserOperation, UserOperationLib} from "account-abstraction/contracts/interfaces/IEntryPoint.sol";

/* solhint-disable func-name-mixedcase */

contract SafeWebAuthnPluginTest is TestHelper {
    constructor() TestHelper() {}

    SafeWebAuthnPlugin public safeWebAuthnPlugin;
    SafeWebAuthnPluginHarness public safeWebAuthnPluginHarness;

    function setUp() public {
        uint256[2] memory publicKey = getWebAuthnPublicKey();
        address entryPointAddress = address(1);
        safeWebAuthnPlugin = new SafeWebAuthnPlugin(
            entryPointAddress,
            publicKey
        );
        safeWebAuthnPluginHarness = new SafeWebAuthnPluginHarness(
            entryPointAddress,
            publicKey
        );
    }

    function test_validateSignature_ValidSignature() public {
        // Arrange
        UserOperation memory userOp = buildUserOp();
        bytes32 userOpHash = entryPoint.getUserOpHash(userOp);
        uint256 expectedValidationData = 0;

        bytes memory userOpSignature = getWebAuthnUserOpSignature();
        userOp.signature = userOpSignature;

        // Act
        uint256 validationData = safeWebAuthnPluginHarness
            .exposed_validateSignature(userOp, userOpHash);

        // Assert
        assertEq(validationData, expectedValidationData);
    }

    function test_validateSignature_InvalidSignature() public {
        // Arrange
        UserOperation memory userOp = buildUserOp();
        bytes32 userOpHash = entryPoint.getUserOpHash(userOp);
        uint256 expectedValidationData = 1;

        (
            bytes memory authenticatorData,
            bytes1 authenticatorDataFlagMask,
            bytes memory clientData,
            ,
            uint256 clientChallengeDataOffset,

        ) = getWebAuthnSignatureValues();
        uint256[2] memory publicKey = getWebAuthnPublicKey();
        uint256[2] memory invalidSignature = [uint256(0), uint256(0)];

        bytes memory userOpSignature = abi.encode(
            authenticatorData,
            authenticatorDataFlagMask,
            clientData,
            clientChallengeDataOffset,
            invalidSignature,
            publicKey
        );
        userOp.signature = userOpSignature;

        // Act
        uint256 validationData = safeWebAuthnPluginHarness
            .exposed_validateSignature(userOp, userOpHash);

        // Assert
        assertEq(validationData, expectedValidationData);
    }
}

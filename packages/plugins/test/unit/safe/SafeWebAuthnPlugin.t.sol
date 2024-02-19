// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "forge-std/Test.sol";
import "forge-std/console2.sol";
import {TestHelper} from "../utils/TestHelper.sol";
import {SafeWebAuthnPluginHarness} from "../utils/SafeWebAuthnPluginHarness.sol";
import {SafeWebAuthnPlugin} from "../../../src/safe/SafeWebAuthnPlugin.sol";
import {Safe4337Base} from "../../../src/safe/utils/Safe4337Base.sol";
import {UserOperation, UserOperationLib} from "account-abstraction/contracts/interfaces/IEntryPoint.sol";

/* solhint-disable func-name-mixedcase */

contract SafeWebAuthnPluginTest is TestHelper {
    constructor() TestHelper() {}

    SafeWebAuthnPluginHarness public safeWebAuthnPlugin;

    function setUp() public {
        uint256[2] memory publicKey = getWebAuthnPublicKey();
        safeWebAuthnPlugin = new SafeWebAuthnPluginHarness(
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
        uint256 validationData = safeWebAuthnPlugin.exposed_validateSignature(
            userOp,
            userOpHash
        );

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
            bytes32 clientChallenge,
            uint256 clientChallengeDataOffset,

        ) = getWebAuthnSignatureValues();
        uint256[2] memory publicKey = getWebAuthnPublicKey();
        uint256[2] memory invalidSignature = [uint256(0), uint256(0)];

        bytes memory userOpSignature = abi.encode(
            authenticatorData,
            authenticatorDataFlagMask,
            clientData,
            clientChallenge,
            clientChallengeDataOffset,
            invalidSignature,
            publicKey
        );
        userOp.signature = userOpSignature;

        // Act
        uint256 validationData = safeWebAuthnPlugin.exposed_validateSignature(
            userOp,
            userOpHash
        );

        // Assert
        assertEq(validationData, expectedValidationData);
    }

    function test_validateNonce_ValidNonce() public view {
        // Arrange
        uint256 nonce = 0;

        // Act & Assert
        safeWebAuthnPlugin.exposed_validateNonce(nonce);
    }

    function test_validateNonce_ValidNonceLessThanMaxUint64() public view {
        // Arrange
        uint256 nonce = uint256(type(uint64).max) - 1;

        // Act & Assert
        safeWebAuthnPlugin.exposed_validateNonce(nonce);
    }

    function test_validateNonce_InvalidNonceEqualToMaxUint64() public {
        // Arrange
        uint256 nonce = type(uint64).max;

        // Act & Assert
        vm.expectRevert(Safe4337Base.NONCE_NOT_SEQUENTIAL.selector);
        safeWebAuthnPlugin.exposed_validateNonce(nonce);
    }

    function test_validateNonce_InvalidNonceGreaterThanMaxUint64() public {
        // Arrange
        uint256 nonce = uint256(type(uint64).max) + 1;

        // Act & Assert
        vm.expectRevert(Safe4337Base.NONCE_NOT_SEQUENTIAL.selector);
        safeWebAuthnPlugin.exposed_validateNonce(nonce);
    }
}

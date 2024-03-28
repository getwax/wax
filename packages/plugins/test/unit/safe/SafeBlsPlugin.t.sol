// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "forge-std/Test.sol";
import "forge-std/console2.sol";
import {TestHelper} from "../utils/TestHelper.sol";
import {SafeBlsPluginHarness} from "../utils/SafeBlsPluginHarness.sol";
import {SafeBlsPlugin} from "../../../src/safe/SafeBlsPlugin.sol";
import {Safe4337Base} from "../../../src/safe/utils/Safe4337Base.sol";
import {BLSSignatureAggregator} from "account-abstraction/contracts/samples/bls/BLSSignatureAggregator.sol";

/* solhint-disable func-name-mixedcase */

contract SafeBlsPluginTest is TestHelper {
    constructor() TestHelper() {}

    BLSSignatureAggregator public blsSignatureAggregator;
    SafeBlsPluginHarness public safeBlsPlugin;

    function setUp() public {
        uint256[4] memory blsPublicKey = getBlsPublicKey();

        blsSignatureAggregator = new BLSSignatureAggregator(entryPointAddress);

        safeBlsPlugin = new SafeBlsPluginHarness(
            entryPointAddress,
            address(blsSignatureAggregator),
            blsPublicKey
        );
    }

    function test_validateNonce_ValidNonce() public view {
        // Arrange
        uint256 nonce = 0;

        // Act & Assert
        safeBlsPlugin.exposed_validateNonce(nonce);
    }

    function test_validateNonce_ValidNonceLessThanMaxUint64() public view {
        // Arrange
        uint256 nonce = uint256(type(uint64).max) - 1;

        // Act & Assert
        safeBlsPlugin.exposed_validateNonce(nonce);
    }

    function test_validateNonce_InvalidNonceEqualToMaxUint64() public {
        // Arrange
        uint256 nonce = type(uint64).max;

        // Act & Assert
        vm.expectRevert(Safe4337Base.NONCE_NOT_SEQUENTIAL.selector);
        safeBlsPlugin.exposed_validateNonce(nonce);
    }

    function test_validateNonce_InvalidNonceGreaterThanMaxUint64() public {
        // Arrange
        uint256 nonce = uint256(type(uint64).max) + 1;

        // Act & Assert
        vm.expectRevert(Safe4337Base.NONCE_NOT_SEQUENTIAL.selector);
        safeBlsPlugin.exposed_validateNonce(nonce);
    }
}

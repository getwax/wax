// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "forge-std/Test.sol";
import "forge-std/console2.sol";
import {TestHelper} from "./utils/TestHelper.sol";
import {SafeECDSAPluginHarness} from "./utils/SafeECDSAPluginHarness.sol";
import {SafeECDSAPlugin} from "../../src/SafeECDSAPlugin.sol";
import {UserOperation, UserOperationLib} from "account-abstraction/contracts/interfaces/IEntryPoint.sol";

/* solhint-disable func-name-mixedcase */

contract SafeECDSAPluginTest is TestHelper {
    constructor() TestHelper() {}

    SafeECDSAPluginHarness public safeECDSAPlugin;

    function setUp() public {
        safeECDSAPlugin = new SafeECDSAPluginHarness(entryPointAddress, ALICE);
    }

    function test_validateNonce_ValidNonceSequence() public {
        // Arrange
        uint256 nonce = 0;
        uint192 zeroKey = 0;

        // Act & Assert
        safeECDSAPlugin.exposed_validateNonce(nonce);

        vm.startPrank(address(safeECDSAPlugin));
        entryPoint.incrementNonce(zeroKey);
        vm.stopPrank();

        safeECDSAPlugin.exposed_validateNonce(nonce++);
    }

    function test_validateNonce_ValidNonceLessThanMaxUint64() public view {
        // Arrange
        uint256 nonce = uint256(type(uint64).max) - 1;

        // Act & Assert
        safeECDSAPlugin.exposed_validateNonce(nonce);
    }

    function test_validateNonce_InvalidNonceEqualToMaxUint64() public {
        // Arrange
        uint256 nonce = type(uint64).max;

        // Act & Assert
        vm.expectRevert(SafeECDSAPlugin.NONCE_NOT_SEQUENTIAL.selector);
        safeECDSAPlugin.exposed_validateNonce(nonce);
    }

    function test_validateNonce_InvalidNonceGreaterThanMaxUint64() public {
        // Arrange
        uint256 nonce = uint256(type(uint64).max) + 1;

        // Act & Assert
        vm.expectRevert(SafeECDSAPlugin.NONCE_NOT_SEQUENTIAL.selector);
        safeECDSAPlugin.exposed_validateNonce(nonce);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "forge-std/Test.sol";
import "forge-std/console2.sol";
import {TestHelper} from "./utils/TestHelper.sol";
import {SafeECDSARecoveryPlugin, ECDSARecoveryStorage} from "../../src/SafeECDSARecoveryPlugin.sol";
import {SafeECDSAPlugin} from "../../src/SafeECDSAPlugin.sol";
import {Safe} from "safe-contracts/contracts/Safe.sol";
import {SafeProxy} from "safe-contracts/contracts/proxies/SafeProxy.sol";

/* solhint-disable func-name-mixedcase */

contract SafeECDSARecoveryPluginTest is TestHelper {
    constructor() TestHelper() {}

    SafeECDSARecoveryPlugin public safeECDSARecoveryPlugin;
    SafeECDSAPlugin public safeECDSAPlugin;
    Safe public safe;
    address public safeAddress;

    address owner = ALICE;

    function setUp() public {
        safeECDSARecoveryPlugin = new SafeECDSARecoveryPlugin();
        safeECDSAPlugin = new SafeECDSAPlugin(entryPointAddress);

        Safe safeSingleton = new Safe();
        SafeProxy safeProxy = new SafeProxy(address(safeSingleton));

        address[] memory owners = new address[](1);
        owners[0] = owner;

        safe = Safe(payable(address(safeProxy)));
        safeAddress = address(safe);

        safe.setup(
            owners,
            1,
            address(safeECDSAPlugin),
            abi.encodeCall(SafeECDSAPlugin.enableMyself, (owner)),
            address(safeECDSAPlugin),
            address(0),
            0,
            payable(address(0))
        );
    }

    function test_addRecoveryAccount_SafeZeroAddress() public {
        // Arrange
        address recoveryAccount = BOB;
        address safeZeroAddress = address(0);

        // Act & Assert
        vm.expectRevert(SafeECDSARecoveryPlugin.SAFE_ZERO_ADDRESS.selector);
        safeECDSARecoveryPlugin.addRecoveryAccount(
            recoveryAccount,
            safeZeroAddress,
            address(safeECDSAPlugin)
        );
    }

    function test_addRecoveryAccount_MsgSenderNotPluginOwner() public {
        // Arrange
        address recoveryAccount = BOB;

        // Act & Assert
        vm.startPrank(recoveryAccount);
        vm.expectRevert(
            abi.encodeWithSelector(
                SafeECDSARecoveryPlugin.MSG_SENDER_NOT_PLUGIN_OWNER.selector,
                recoveryAccount,
                owner
            )
        );
        safeECDSARecoveryPlugin.addRecoveryAccount(
            recoveryAccount,
            safeAddress,
            address(safeECDSAPlugin)
        );
    }

    function test_addRecoveryAccount_recoveryAccountAdded() public {
        // Arrange
        address recoveryAccount = BOB;

        // Act
        vm.startPrank(owner);
        safeECDSARecoveryPlugin.addRecoveryAccount(
            recoveryAccount,
            safeAddress,
            address(safeECDSAPlugin)
        );

        ECDSARecoveryStorage
            memory ecdsaRecoveryStorage = safeECDSARecoveryPlugin
                .getEcdsaRecoveryStorage(owner);

        // Assert
        assertEq(ecdsaRecoveryStorage.recoveryAccount, recoveryAccount);
        assertEq(ecdsaRecoveryStorage.safe, safeAddress);
    }

    function test_resetEcdsaAddress_senderNotRecoveryAccount() public {
        // Arrange
        address newOwner = BOB;
        address recoveryAccount = CAROL;
        address expectedRecoveryAccount = address(0);

        // Act & Assert
        vm.startPrank(recoveryAccount);
        vm.expectRevert(
            abi.encodeWithSelector(
                SafeECDSARecoveryPlugin.SENDER_NOT_RECOVERY_ACCOUNT.selector,
                recoveryAccount,
                expectedRecoveryAccount
            )
        );
        safeECDSARecoveryPlugin.resetEcdsaAddress(
            safeAddress,
            address(safeECDSAPlugin),
            owner,
            newOwner
        );
    }

    function test_resetEcdsaAddress_attemptingResetOnWrongSafe() public {
        // Arrange
        address recoveryAccount = BOB;
        address newOwner = CAROL;
        address wrongSafeAddress = DAVE;

        vm.startPrank(safeAddress);
        safe.enableModule(address(safeECDSARecoveryPlugin));
        vm.stopPrank();

        vm.startPrank(owner);
        safeECDSARecoveryPlugin.addRecoveryAccount(
            recoveryAccount,
            safeAddress,
            address(safeECDSAPlugin)
        );
        vm.stopPrank();

        // Act & Assert
        vm.startPrank(recoveryAccount);
        vm.expectRevert(
            abi.encodeWithSelector(
                SafeECDSARecoveryPlugin.ATTEMPTING_RESET_ON_WRONG_SAFE.selector,
                wrongSafeAddress,
                safeAddress
            )
        );
        safeECDSARecoveryPlugin.resetEcdsaAddress(
            wrongSafeAddress,
            address(safeECDSAPlugin),
            owner,
            newOwner
        );
    }

    function test_resetEcdsaAddress_resetsEcdsaAddress() public {
        // Arrange
        address recoveryAccount = BOB;
        address newOwner = CAROL;

        vm.startPrank(safeAddress);
        safe.enableModule(address(safeECDSARecoveryPlugin));
        vm.stopPrank();

        vm.startPrank(owner);
        safeECDSARecoveryPlugin.addRecoveryAccount(
            recoveryAccount,
            safeAddress,
            address(safeECDSAPlugin)
        );
        vm.stopPrank();

        // Act
        vm.startPrank(recoveryAccount);
        safeECDSARecoveryPlugin.resetEcdsaAddress(
            safeAddress,
            address(safeECDSAPlugin),
            owner,
            newOwner
        );

        // Assert
        address updatedOwner = safeECDSAPlugin.getOwner(safeAddress);
        assertEq(updatedOwner, newOwner);
    }
}

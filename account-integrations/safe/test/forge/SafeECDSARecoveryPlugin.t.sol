// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "forge-std/Test.sol";
import "forge-std/console2.sol";
import {TestHelper} from "./utils/TestHelper.sol";
import {SafeECDSARecoveryPlugin, ECDSARecoveryStorage} from "../../src/SafeECDSARecoveryPlugin.sol";
import {SafeECDSAPlugin} from "../../src/SafeECDSAPlugin.sol";
import {Safe} from "safe-contracts/contracts/Safe.sol";
import {SafeProxy} from "safe-contracts/contracts/proxies/SafeProxy.sol";
import {ECDSA} from "openzeppelin-contracts/contracts/utils/cryptography/ECDSA.sol";

/* solhint-disable func-name-mixedcase */

contract SafeECDSARecoveryPluginTest is TestHelper {
    using ECDSA for bytes32;

    constructor() TestHelper() {}

    SafeECDSARecoveryPlugin public safeECDSARecoveryPlugin;
    SafeECDSAPlugin public safeECDSAPlugin;
    Safe public safe;
    address public safeAddress;

    address public owner;

    bytes32 RECOVERY_HASH_DOMAIN;

    function setUp() public {
        safeECDSARecoveryPlugin = new SafeECDSARecoveryPlugin();
        safeECDSAPlugin = new SafeECDSAPlugin(entryPointAddress);

        Safe safeSingleton = new Safe();
        SafeProxy safeProxy = new SafeProxy(address(safeSingleton));

        address[] memory owners = new address[](1);
        owner = Alice.addr;
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

        RECOVERY_HASH_DOMAIN = keccak256(
            abi.encodePacked(
                "RECOVERY_PLUGIN",
                uint256(1),
                block.chainid,
                address(safeECDSARecoveryPlugin)
            )
        );
    }

    function test_addRecoveryAccount_SafeZeroAddress() public {
        // Arrange
        address recoveryAccount = Bob.addr;
        string memory salt = "test salt";

        bytes32 guardianHash = keccak256(
            abi.encodePacked(RECOVERY_HASH_DOMAIN, recoveryAccount, owner, salt)
        );
        address safeZeroAddress = address(0);

        // Act & Assert
        vm.expectRevert(SafeECDSARecoveryPlugin.SAFE_ZERO_ADDRESS.selector);
        safeECDSARecoveryPlugin.addRecoveryAccount(
            guardianHash,
            safeZeroAddress,
            address(safeECDSAPlugin)
        );
    }

    function test_addRecoveryAccount_MsgSenderNotPluginOwner() public {
        // Arrange
        address recoveryAccount = Bob.addr;
        string memory salt = "test salt";

        bytes32 guardianHash = keccak256(
            abi.encodePacked(RECOVERY_HASH_DOMAIN, recoveryAccount, owner, salt)
        );

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
            guardianHash,
            safeAddress,
            address(safeECDSAPlugin)
        );
    }

    function test_addRecoveryAccount_recoveryAccountAdded() public {
        // Arrange
        address recoveryAccount = Bob.addr;
        string memory salt = "test salt";

        bytes32 guardianHash = keccak256(
            abi.encodePacked(RECOVERY_HASH_DOMAIN, recoveryAccount, owner, salt)
        );

        // Act
        vm.startPrank(owner);
        safeECDSARecoveryPlugin.addRecoveryAccount(
            guardianHash,
            safeAddress,
            address(safeECDSAPlugin)
        );

        ECDSARecoveryStorage
            memory ecdsaRecoveryStorage = safeECDSARecoveryPlugin
                .getEcdsaRecoveryStorage(owner);

        // Assert
        assertEq(ecdsaRecoveryStorage.guardianHash, guardianHash);
        assertEq(ecdsaRecoveryStorage.safe, safeAddress);
    }

    function test_addRecoveryAccount_addMultipleRecoveryAccountsAndPlugins()
        public
    {
        // Arrange
        address recoveryAccount1 = Bob.addr;
        string memory salt = "test salt";

        bytes32 guardianHash1 = keccak256(
            abi.encodePacked(
                RECOVERY_HASH_DOMAIN,
                recoveryAccount1,
                owner,
                salt
            )
        );

        address recoveryAccount2 = Carol.addr;
        address secondOwner = Dave.addr;

        bytes32 guardianHash2 = keccak256(
            abi.encodePacked(
                RECOVERY_HASH_DOMAIN,
                recoveryAccount2,
                owner,
                salt
            )
        );

        SafeECDSAPlugin secondSafeECDSAPlugin = new SafeECDSAPlugin(
            entryPointAddress
        );

        vm.startPrank(safeAddress);
        secondSafeECDSAPlugin.enable(abi.encodePacked(secondOwner));
        vm.stopPrank();

        // Act
        vm.startPrank(owner);
        safeECDSARecoveryPlugin.addRecoveryAccount(
            guardianHash1,
            safeAddress,
            address(safeECDSAPlugin)
        );

        vm.startPrank(secondOwner);
        safeECDSARecoveryPlugin.addRecoveryAccount(
            guardianHash2,
            safeAddress,
            address(secondSafeECDSAPlugin)
        );

        // Assert
        ECDSARecoveryStorage
            memory ecdsaRecoveryStorage = safeECDSARecoveryPlugin
                .getEcdsaRecoveryStorage(owner);

        ECDSARecoveryStorage
            memory ecdsaRecoveryStorage2 = safeECDSARecoveryPlugin
                .getEcdsaRecoveryStorage(secondOwner);

        assertEq(ecdsaRecoveryStorage.guardianHash, guardianHash1);
        assertEq(ecdsaRecoveryStorage.safe, safeAddress);

        assertEq(ecdsaRecoveryStorage2.guardianHash, guardianHash2);
        assertEq(ecdsaRecoveryStorage2.safe, safeAddress);
    }

    function test_resetEcdsaAddress_invalidRecoveryHash() public {
        // Arrange
        address recoveryAccount = Bob.addr;
        string memory salt = "test salt";

        bytes32 guardianHash = keccak256(
            abi.encodePacked(
                "INVALID_RECOVERY_HASH_DOMAIN",
                recoveryAccount,
                owner,
                salt
            )
        );

        bytes32 expectedGuardianHash = keccak256(
            abi.encodePacked(RECOVERY_HASH_DOMAIN, recoveryAccount, owner, salt)
        );
        Vm.Wallet memory newOwner = Carol;

        bytes memory newOwnerSignature = abi.encodePacked("dummy signature"); // note the order here is different from the tuple above.

        vm.startPrank(safeAddress);
        safe.enableModule(address(safeECDSARecoveryPlugin));
        vm.stopPrank();

        vm.startPrank(owner);
        safeECDSARecoveryPlugin.addRecoveryAccount(
            guardianHash,
            safeAddress,
            address(safeECDSAPlugin)
        );
        vm.stopPrank();

        ECDSARecoveryStorage
            memory ecdsaRecoveryStorage = safeECDSARecoveryPlugin
                .getEcdsaRecoveryStorage(owner);

        // Act & Assert
        vm.startPrank(recoveryAccount);
        vm.expectRevert(
            abi.encodeWithSelector(
                SafeECDSARecoveryPlugin.INVALID_GUARDIAN_HASH.selector,
                ecdsaRecoveryStorage.guardianHash,
                expectedGuardianHash
            )
        );
        safeECDSARecoveryPlugin.resetEcdsaAddress(
            newOwnerSignature,
            salt,
            safeAddress,
            address(safeECDSAPlugin),
            owner,
            newOwner.addr
        );
    }

    function test_resetEcdsaAddress_attemptingResetOnWrongSafe() public {
        // Arrange
        address recoveryAccount = Bob.addr;
        string memory salt = "test salt";

        bytes32 guardianHash = keccak256(
            abi.encodePacked(RECOVERY_HASH_DOMAIN, recoveryAccount, owner, salt)
        );
        Vm.Wallet memory newOwner = Carol;
        address wrongSafeAddress = Dave.addr;

        bytes memory newOwnerSignature = abi.encodePacked("dummy signature");

        vm.startPrank(safeAddress);
        safe.enableModule(address(safeECDSARecoveryPlugin));
        vm.stopPrank();

        vm.startPrank(owner);
        safeECDSARecoveryPlugin.addRecoveryAccount(
            guardianHash,
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
            newOwnerSignature,
            salt,
            wrongSafeAddress,
            address(safeECDSAPlugin),
            owner,
            newOwner.addr
        );
    }

    function test_resetEcdsaAddress_invalidNewOwnerSignature() public {
        // Arrange
        address recoveryAccount = Bob.addr;
        string memory salt = "test salt";

        bytes32 guardianHash = keccak256(
            abi.encodePacked(RECOVERY_HASH_DOMAIN, recoveryAccount, owner, salt)
        );
        Vm.Wallet memory newOwner = Carol;

        bytes32 invalidOwnerHash = keccak256(
            abi.encodePacked("invalid address hash")
        );
        bytes32 ethSignedHash = invalidOwnerHash.toEthSignedMessageHash();
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(newOwner, ethSignedHash);
        bytes memory newOwnerSignature = abi.encodePacked(r, s, v); // note the order here is different from the tuple above.

        vm.startPrank(safeAddress);
        safe.enableModule(address(safeECDSARecoveryPlugin));
        vm.stopPrank();

        vm.startPrank(owner);
        safeECDSARecoveryPlugin.addRecoveryAccount(
            guardianHash,
            safeAddress,
            address(safeECDSAPlugin)
        );
        vm.stopPrank();

        // Act & Assert
        vm.startPrank(recoveryAccount);
        vm.expectRevert(
            SafeECDSARecoveryPlugin.INVALID_NEW_OWNER_SIGNATURE.selector
        );
        safeECDSARecoveryPlugin.resetEcdsaAddress(
            newOwnerSignature,
            salt,
            safeAddress,
            address(safeECDSAPlugin),
            owner,
            newOwner.addr
        );
    }

    function test_resetEcdsaAddress_resetsEcdsaAddress() public {
        // Arrange
        address recoveryAccount = Bob.addr;
        string memory salt = "test salt";

        bytes32 guardianHash = keccak256(
            abi.encodePacked(RECOVERY_HASH_DOMAIN, recoveryAccount, owner, salt)
        );
        Vm.Wallet memory newOwner = Carol;

        bytes32 currentOwnerHash = keccak256(abi.encodePacked(owner));
        bytes32 ethSignedHash = currentOwnerHash.toEthSignedMessageHash();
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(newOwner, ethSignedHash);
        bytes memory newOwnerSignature = abi.encodePacked(r, s, v); // note the order here is different from the tuple above.

        vm.startPrank(safeAddress);
        safe.enableModule(address(safeECDSARecoveryPlugin));
        vm.stopPrank();

        vm.startPrank(owner);
        safeECDSARecoveryPlugin.addRecoveryAccount(
            guardianHash,
            safeAddress,
            address(safeECDSAPlugin)
        );
        vm.stopPrank();

        // Act
        vm.startPrank(recoveryAccount);
        safeECDSARecoveryPlugin.resetEcdsaAddress(
            newOwnerSignature,
            salt,
            safeAddress,
            address(safeECDSAPlugin),
            owner,
            newOwner.addr
        );

        // Assert
        address updatedOwner = safeECDSAPlugin.getOwner(safeAddress);
        assertEq(updatedOwner, newOwner.addr);
    }
}

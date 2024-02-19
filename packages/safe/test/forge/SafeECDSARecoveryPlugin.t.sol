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
/* solhint-disable private-vars-leading-underscore */
/* solhint-disable var-name-mixedcase */

contract SafeECDSARecoveryPluginTest is TestHelper {
    using ECDSA for bytes32;

    constructor() TestHelper() {}

    SafeECDSARecoveryPlugin public safeECDSARecoveryPlugin;
    SafeECDSAPlugin public safeECDSAPlugin;
    Safe public safeSingleton;
    Safe public safe;
    address public safeAddress;

    address public owner;

    bytes32 RECOVERY_HASH_DOMAIN;

    function setUp() public {
        safeECDSARecoveryPlugin = new SafeECDSARecoveryPlugin();
        safeECDSAPlugin = new SafeECDSAPlugin(entryPointAddress);

        safeSingleton = new Safe();
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

        vm.startPrank(safeAddress);
        safe.enableModule(address(safeECDSARecoveryPlugin));
        vm.stopPrank();

        RECOVERY_HASH_DOMAIN = keccak256(
            abi.encodePacked(
                "RECOVERY_PLUGIN",
                uint256(1),
                block.chainid,
                address(safeECDSARecoveryPlugin)
            )
        );
    }

    function test_addRecoveryAccount_ModuleNotEnabled() public {
        // Arrange
        address recoveryAccount = Bob.addr;
        string memory salt = "test salt";

        bytes32 recoveryHash = keccak256(
            abi.encodePacked(RECOVERY_HASH_DOMAIN, recoveryAccount, owner, salt)
        );

        address prevModuleInLinkedList = address(0x1);
        address moduleToDisable = address(safeECDSARecoveryPlugin);

        // Act
        vm.startPrank(safeAddress);
        safe.disableModule(prevModuleInLinkedList, moduleToDisable);

        // Assert
        vm.expectRevert(SafeECDSARecoveryPlugin.MODULE_NOT_ENABLED.selector);
        safeECDSARecoveryPlugin.addRecoveryAccount(
            recoveryHash,
            safeAddress,
            address(safeECDSAPlugin)
        );
    }

    function test_addRecoveryAccount_invalidOwner() public {
        // Arrange
        address recoveryAccount = Bob.addr;
        address invalidOwner = Dave.addr;
        string memory salt = "test salt";

        bytes32 recoveryHash = keccak256(
            abi.encodePacked(RECOVERY_HASH_DOMAIN, recoveryAccount, owner, salt)
        );

        // Act & Assert
        vm.startPrank(safeAddress);
        vm.expectRevert(
            abi.encodeWithSelector(
                SafeECDSARecoveryPlugin.INVALID_OWNER.selector,
                owner,
                invalidOwner
            )
        );
        safeECDSARecoveryPlugin.addRecoveryAccount(
            recoveryHash,
            invalidOwner,
            address(safeECDSAPlugin)
        );
    }

    function test_addRecoveryAccount_recoveryAccountAdded() public {
        // Arrange
        address recoveryAccount = Bob.addr;
        string memory salt = "test salt";

        bytes32 recoveryHash = keccak256(
            abi.encodePacked(RECOVERY_HASH_DOMAIN, recoveryAccount, owner, salt)
        );

        // Act
        vm.startPrank(safeAddress);
        safeECDSARecoveryPlugin.addRecoveryAccount(
            recoveryHash,
            owner,
            address(safeECDSAPlugin)
        );

        ECDSARecoveryStorage
            memory ecdsaRecoveryStorage = safeECDSARecoveryPlugin
                .getEcdsaRecoveryStorage(safeAddress);

        // Assert
        assertEq(ecdsaRecoveryStorage.recoveryHash, recoveryHash);
    }

    function test_addRecoveryAccount_addMultipleRecoveryAccountsToSamePlugin()
        public
    {
        // Arrange

        // Create and setup second safe to use with plugin
        SafeProxy safeProxy2 = new SafeProxy(address(safeSingleton));
        Safe safe2 = Safe(payable(address(safeProxy2)));
        address safe2Address = address(safe2);

        address[] memory owners = new address[](1);
        owners[0] = owner;

        vm.startPrank(safe2Address);
        safe2.setup(
            owners,
            1,
            address(safeECDSAPlugin),
            abi.encodeCall(SafeECDSAPlugin.enableMyself, (owner)),
            address(safeECDSAPlugin),
            address(0),
            0,
            payable(address(0))
        );

        safe2.enableModule(address(safeECDSARecoveryPlugin));
        vm.stopPrank();

        address recoveryAccount1 = Bob.addr;
        address recoveryAccount2 = Carol.addr;

        string memory salt = "test salt";

        bytes32 guardianHash1 = keccak256(
            abi.encodePacked(
                RECOVERY_HASH_DOMAIN,
                recoveryAccount1,
                owner,
                salt
            )
        );

        bytes32 guardianHash2 = keccak256(
            abi.encodePacked(
                RECOVERY_HASH_DOMAIN,
                recoveryAccount2,
                owner,
                salt
            )
        );

        // Act
        vm.startPrank(safeAddress);
        safeECDSARecoveryPlugin.addRecoveryAccount(
            guardianHash1,
            owner,
            address(safeECDSAPlugin)
        );

        vm.startPrank(safe2Address);
        safeECDSARecoveryPlugin.addRecoveryAccount(
            guardianHash2,
            owner,
            address(safeECDSAPlugin)
        );

        // Assert
        ECDSARecoveryStorage
            memory ecdsaRecoveryStorage = safeECDSARecoveryPlugin
                .getEcdsaRecoveryStorage(safeAddress);
        ECDSARecoveryStorage
            memory ecdsaRecoveryStorage2 = safeECDSARecoveryPlugin
                .getEcdsaRecoveryStorage(safe2Address);

        assertEq(ecdsaRecoveryStorage.recoveryHash, guardianHash1);
        assertEq(ecdsaRecoveryStorage2.recoveryHash, guardianHash2);
    }

    function test_resetEcdsaAddress_invalidRecoveryHash() public {
        // Arrange
        address recoveryAccount = Bob.addr;
        string memory salt = "test salt";

        bytes32 recoveryHash = keccak256(
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

        vm.startPrank(safeAddress);
        safeECDSARecoveryPlugin.addRecoveryAccount(
            recoveryHash,
            owner,
            address(safeECDSAPlugin)
        );
        vm.stopPrank();

        Vm.Wallet memory newOwner = Carol;
        bytes memory newOwnerSignature = abi.encodePacked("dummy signature");

        // Act & Assert
        vm.startPrank(recoveryAccount);
        vm.expectRevert(
            abi.encodeWithSelector(
                SafeECDSARecoveryPlugin.INVALID_GUARDIAN_HASH.selector,
                recoveryHash,
                expectedGuardianHash
            )
        );
        safeECDSARecoveryPlugin.resetEcdsaAddress(
            newOwnerSignature,
            safeAddress,
            salt,
            address(safeECDSAPlugin),
            owner,
            newOwner.addr
        );
    }

    function test_resetEcdsaAddress_invalidNewOwnerSignature() public {
        // Arrange
        address recoveryAccount = Bob.addr;
        string memory salt = "test salt";

        bytes32 recoveryHash = keccak256(
            abi.encodePacked(RECOVERY_HASH_DOMAIN, recoveryAccount, owner, salt)
        );

        vm.startPrank(safeAddress);
        safeECDSARecoveryPlugin.addRecoveryAccount(
            recoveryHash,
            owner,
            address(safeECDSAPlugin)
        );
        vm.stopPrank();

        Vm.Wallet memory newOwner = Carol;

        bytes32 invalidOwnerHash = keccak256(
            abi.encodePacked("invalid address hash")
        );
        bytes32 ethSignedHash = invalidOwnerHash.toEthSignedMessageHash();
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(newOwner, ethSignedHash);
        bytes memory newOwnerSignature = abi.encodePacked(r, s, v); // note the order here is different from the tuple above.

        // Act & Assert
        vm.startPrank(recoveryAccount);
        vm.expectRevert(
            SafeECDSARecoveryPlugin.INVALID_NEW_OWNER_SIGNATURE.selector
        );
        safeECDSARecoveryPlugin.resetEcdsaAddress(
            newOwnerSignature,
            safeAddress,
            salt,
            address(safeECDSAPlugin),
            owner,
            newOwner.addr
        );
    }

    function test_resetEcdsaAddress_resetsEcdsaAddress() public {
        // Arrange
        address recoveryAccount = Bob.addr;
        string memory salt = "test salt";

        bytes32 recoveryHash = keccak256(
            abi.encodePacked(RECOVERY_HASH_DOMAIN, recoveryAccount, owner, salt)
        );

        vm.startPrank(safeAddress);
        safeECDSARecoveryPlugin.addRecoveryAccount(
            recoveryHash,
            owner,
            address(safeECDSAPlugin)
        );
        vm.stopPrank();

        Vm.Wallet memory newOwner = Carol;

        bytes32 currentOwnerHash = keccak256(abi.encodePacked(owner));
        bytes32 ethSignedHash = currentOwnerHash.toEthSignedMessageHash();
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(newOwner, ethSignedHash);
        bytes memory newOwnerSignature = abi.encodePacked(r, s, v); // note the order here is different from the tuple above.

        // Act
        vm.startPrank(recoveryAccount);
        safeECDSARecoveryPlugin.resetEcdsaAddress(
            newOwnerSignature,
            safeAddress,
            salt,
            address(safeECDSAPlugin),
            owner,
            newOwner.addr
        );

        // Assert
        address updatedOwner = safeECDSAPlugin.getOwner(safeAddress);
        assertEq(updatedOwner, newOwner.addr);
    }
}

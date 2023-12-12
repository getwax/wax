// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "forge-std/Test.sol";
import "forge-std/console2.sol";
import {TestHelper} from "./utils/TestHelper.sol";
import {SafeZkEmailRecoveryPlugin, ZkEmailRecoveryStorage} from "../../src/SafeZkEmailRecoveryPlugin.sol";
import {SafeECDSAPlugin} from "../../src/SafeECDSAPlugin.sol";
import {MockGroth16Verifier} from "../../src/utils/MockGroth16Verifier.sol";
import {Safe} from "safe-contracts/contracts/Safe.sol";
import {SafeProxy} from "safe-contracts/contracts/proxies/SafeProxy.sol";
import {ECDSA} from "openzeppelin-contracts/contracts/utils/cryptography/ECDSA.sol";

/* solhint-disable func-name-mixedcase */
/* solhint-disable private-vars-leading-underscore */
/* solhint-disable var-name-mixedcase */

contract SafeZkEmailRecoveryPluginTest is TestHelper {
    using ECDSA for bytes32;

    constructor() TestHelper() {}

    SafeZkEmailRecoveryPlugin public safeZkEmailRecoveryPlugin;
    SafeECDSAPlugin public safeECDSAPlugin;
    Safe public safeSingleton;
    Safe public safe;
    address public safeAddress;

    address public owner;

    bytes32 RECOVERY_HASH_DOMAIN;

    function setUp() public {
        MockGroth16Verifier mockGroth16Verifier = new MockGroth16Verifier();
        safeZkEmailRecoveryPlugin = new SafeZkEmailRecoveryPlugin(
            address(mockGroth16Verifier)
        );
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
        safe.enableModule(address(safeZkEmailRecoveryPlugin));
        vm.stopPrank();

        RECOVERY_HASH_DOMAIN = keccak256(
            abi.encodePacked(
                "RECOVERY_PLUGIN",
                uint256(1),
                block.chainid,
                address(safeZkEmailRecoveryPlugin)
            )
        );
    }

    function test_addRecoveryAccount_ModuleNotEnabled() public {
        // Arrange
        bytes32 email = 0x6f1450935d03f8edb673952efc01207c5de7c9bffb123f23b79dbeb80a73376e; // ethers.keccak256(ethers.toUtf8Bytes("test@mail.com"));
        string memory salt = "test salt";

        bytes32 recoveryHash = keccak256(
            abi.encodePacked(RECOVERY_HASH_DOMAIN, email, salt)
        );

        address prevModuleInLinkedList = address(0x1);
        address moduleToDisable = address(safeZkEmailRecoveryPlugin);

        // Act
        vm.startPrank(safeAddress);
        safe.disableModule(prevModuleInLinkedList, moduleToDisable);

        // Assert
        vm.expectRevert(SafeZkEmailRecoveryPlugin.MODULE_NOT_ENABLED.selector);
        safeZkEmailRecoveryPlugin.addRecoveryAccount(
            recoveryHash,
            safeAddress,
            address(safeECDSAPlugin)
        );
    }

    function test_addRecoveryAccount_invalidOwner() public {
        // Arrange
        address invalidOwner = Dave.addr;
        bytes32 email = 0x6f1450935d03f8edb673952efc01207c5de7c9bffb123f23b79dbeb80a73376e; // ethers.keccak256(ethers.toUtf8Bytes("test@mail.com"));
        string memory salt = "test salt";

        bytes32 recoveryHash = keccak256(
            abi.encodePacked(RECOVERY_HASH_DOMAIN, email, salt)
        );

        // Act & Assert
        vm.startPrank(safeAddress);
        vm.expectRevert(
            abi.encodeWithSelector(
                SafeZkEmailRecoveryPlugin.INVALID_OWNER.selector,
                owner,
                invalidOwner
            )
        );
        safeZkEmailRecoveryPlugin.addRecoveryAccount(
            recoveryHash,
            invalidOwner,
            address(safeECDSAPlugin)
        );
    }

    function test_addRecoveryAccount_recoveryAccountAdded() public {
        // Arrange
        bytes32 email = 0x6f1450935d03f8edb673952efc01207c5de7c9bffb123f23b79dbeb80a73376e; // ethers.keccak256(ethers.toUtf8Bytes("test@mail.com"));
        string memory salt = "test salt";

        bytes32 recoveryHash = keccak256(
            abi.encodePacked(RECOVERY_HASH_DOMAIN, email, salt)
        );

        // Act
        vm.startPrank(safeAddress);
        safeZkEmailRecoveryPlugin.addRecoveryAccount(
            recoveryHash,
            owner,
            address(safeECDSAPlugin)
        );

        ZkEmailRecoveryStorage
            memory zkEmailRecoveryStorage = safeZkEmailRecoveryPlugin
                .getZkEmailRecoveryStorage(safeAddress);

        // Assert
        assertEq(zkEmailRecoveryStorage.recoveryHash, recoveryHash);
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

        safe2.enableModule(address(safeZkEmailRecoveryPlugin));
        vm.stopPrank();

        bytes32 email1 = 0x6f1450935d03f8edb673952efc01207c5de7c9bffb123f23b79dbeb80a73376e; // ethers.keccak256(ethers.toUtf8Bytes("test@mail.com"));
        bytes32 email2 = 0xdea89a4f4488c5f2e94b9fe37b1c17104c8b11442520b364fde514989c08c478; // ethers.keccak256(ethers.toUtf8Bytes("test2@mail.com"));
        string memory salt = "test salt";

        bytes32 guardianHash1 = keccak256(
            abi.encodePacked(RECOVERY_HASH_DOMAIN, email1, salt)
        );

        bytes32 guardianHash2 = keccak256(
            abi.encodePacked(RECOVERY_HASH_DOMAIN, email2, salt)
        );

        // Act
        vm.startPrank(safeAddress);
        safeZkEmailRecoveryPlugin.addRecoveryAccount(
            guardianHash1,
            owner,
            address(safeECDSAPlugin)
        );

        vm.startPrank(safe2Address);
        safeZkEmailRecoveryPlugin.addRecoveryAccount(
            guardianHash2,
            owner,
            address(safeECDSAPlugin)
        );

        // Assert
        ZkEmailRecoveryStorage
            memory zkEmailRecoveryStorage = safeZkEmailRecoveryPlugin
                .getZkEmailRecoveryStorage(safeAddress);
        ZkEmailRecoveryStorage
            memory ecdsaRecoveryStorage2 = safeZkEmailRecoveryPlugin
                .getZkEmailRecoveryStorage(safe2Address);

        assertEq(zkEmailRecoveryStorage.recoveryHash, guardianHash1);
        assertEq(ecdsaRecoveryStorage2.recoveryHash, guardianHash2);
    }

    function test_resetEcdsaAddress_invalidRecoveryHash() public {
        // Arrange
        address recoveryAccount = Bob.addr;
        bytes32 email = 0x6f1450935d03f8edb673952efc01207c5de7c9bffb123f23b79dbeb80a73376e; // ethers.keccak256(ethers.toUtf8Bytes("test@mail.com"));
        string memory salt = "test salt";
        uint256[2] memory a = [uint256(0), uint256(0)];
        uint256[2][2] memory b = [
            [uint256(0), uint256(0)],
            [uint256(0), uint256(0)]
        ];
        uint256[2] memory c = [uint256(0), uint256(0)];
        uint256[1] memory publicSignals = [uint256(0)];

        bytes32 recoveryHash = keccak256(
            abi.encodePacked("INVALID_RECOVERY_HASH_DOMAIN", email, salt)
        );

        bytes32 expectedGuardianHash = keccak256(
            abi.encodePacked(RECOVERY_HASH_DOMAIN, email, salt)
        );

        vm.startPrank(safeAddress);
        safeZkEmailRecoveryPlugin.addRecoveryAccount(
            recoveryHash,
            owner,
            address(safeECDSAPlugin)
        );
        vm.stopPrank();

        Vm.Wallet memory newOwner = Carol;

        // Act & Assert
        vm.startPrank(recoveryAccount);
        vm.expectRevert(
            abi.encodeWithSelector(
                SafeZkEmailRecoveryPlugin.INVALID_GUARDIAN_HASH.selector,
                recoveryHash,
                expectedGuardianHash
            )
        );
        safeZkEmailRecoveryPlugin.recoverAccount(
            safeAddress,
            address(safeECDSAPlugin),
            newOwner.addr,
            salt,
            email,
            a,
            b,
            c,
            publicSignals
        );
    }

    function test_resetEcdsaAddress_invalidProof() public {
        // Arrange
        address recoveryAccount = Bob.addr;
        bytes32 email = 0x6f1450935d03f8edb673952efc01207c5de7c9bffb123f23b79dbeb80a73376e; // ethers.keccak256(ethers.toUtf8Bytes("test@mail.com"));
        string memory salt = "test salt";
        uint256[2] memory a = [uint256(0), uint256(0)];
        uint256[2][2] memory b = [
            [uint256(0), uint256(0)],
            [uint256(0), uint256(0)]
        ];
        uint256[2] memory c = [uint256(0), uint256(0)];
        uint256[1] memory publicSignals = [uint256(1)]; // arbitary value that returns false from mock verifier

        bytes32 recoveryHash = keccak256(
            abi.encodePacked(RECOVERY_HASH_DOMAIN, email, salt)
        );

        vm.startPrank(safeAddress);
        safeZkEmailRecoveryPlugin.addRecoveryAccount(
            recoveryHash,
            owner,
            address(safeECDSAPlugin)
        );
        vm.stopPrank();

        Vm.Wallet memory newOwner = Carol;

        // Act & Assert
        vm.startPrank(recoveryAccount);
        vm.expectRevert(SafeZkEmailRecoveryPlugin.INVALID_PROOF.selector);
        safeZkEmailRecoveryPlugin.recoverAccount(
            safeAddress,
            address(safeECDSAPlugin),
            newOwner.addr,
            salt,
            email,
            a,
            b,
            c,
            publicSignals
        );
    }

    function test_resetEcdsaAddress_resetsEcdsaAddress() public {
        // Arrange
        address recoveryAccount = Bob.addr;
        bytes32 email = 0x6f1450935d03f8edb673952efc01207c5de7c9bffb123f23b79dbeb80a73376e; // ethers.keccak256(ethers.toUtf8Bytes("test@mail.com"));
        string memory salt = "test salt";
        uint256[2] memory a = [uint256(0), uint256(0)];
        uint256[2][2] memory b = [
            [uint256(0), uint256(0)],
            [uint256(0), uint256(0)]
        ];
        uint256[2] memory c = [uint256(0), uint256(0)];
        uint256[1] memory publicSignals = [uint256(0)];

        bytes32 recoveryHash = keccak256(
            abi.encodePacked(RECOVERY_HASH_DOMAIN, email, salt)
        );

        vm.startPrank(safeAddress);
        safeZkEmailRecoveryPlugin.addRecoveryAccount(
            recoveryHash,
            owner,
            address(safeECDSAPlugin)
        );
        vm.stopPrank();

        Vm.Wallet memory newOwner = Carol;

        // Act
        vm.startPrank(recoveryAccount);
        safeZkEmailRecoveryPlugin.recoverAccount(
            safeAddress,
            address(safeECDSAPlugin),
            newOwner.addr,
            salt,
            email,
            a,
            b,
            c,
            publicSignals
        );

        // Assert
        address updatedOwner = safeECDSAPlugin.getOwner(safeAddress);
        assertEq(updatedOwner, newOwner.addr);
    }
}

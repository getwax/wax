// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "forge-std/Test.sol";
import "forge-std/console2.sol";
import {TestHelper} from "./utils/TestHelper.sol";
import {SafeZkEmailRecoveryPlugin, RecoveryRequest} from "../../src/SafeZkEmailRecoveryPlugin.sol";
import {SafeECDSAPlugin} from "../../src/SafeECDSAPlugin.sol";
import {MockGroth16Verifier} from "../../src/utils/MockGroth16Verifier.sol";
import {MockDKIMRegsitry} from "../../src/utils/MockDKIMRegsitry.sol";
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

    MockDKIMRegsitry public mockDKIMRegsitry;

    address public owner;

    bytes32 RECOVERY_HASH_DOMAIN;
    bytes32 email;
    string salt;
    string emailDomain;
    string dkimPublicKey;

    function setUp() public {
        MockGroth16Verifier mockGroth16Verifier = new MockGroth16Verifier();
        MockDKIMRegsitry defaultDkimRegsitry = new MockDKIMRegsitry();

        safeZkEmailRecoveryPlugin = new SafeZkEmailRecoveryPlugin(
            address(mockGroth16Verifier),
            address(defaultDkimRegsitry)
        );
        safeECDSAPlugin = new SafeECDSAPlugin(entryPointAddress);

        safeSingleton = new Safe();
        SafeProxy safeProxy = new SafeProxy(address(safeSingleton));

        mockDKIMRegsitry = new MockDKIMRegsitry();

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
        email = 0x6f1450935d03f8edb673952efc01207c5de7c9bffb123f23b79dbeb80a73376e; // ethers.keccak256(ethers.toUtf8Bytes("test@mail.com"));
        salt = "test salt";
        emailDomain = "google.com";
        dkimPublicKey = "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAxES3RTDdoDUcyrIFzApJx9Vkd89Sma86iSHn8UzQRevFI69jNRSuqkOZfQQ0h+fK+Fh7DNz8QznLpSh6QBjOHEAfZVj/+eK1L4sbkULOSEvy1njCb7U+gkQ3D60j35pKBefd1gkDoH5V/2E2qnld89ECwTaklWLrTYLAgHfSAj/A01JDQpvxCRneFNHHaZG+8LbPi2wZKgwmb97HWyPu9KokiKrnYg6tfQzLFVj5PqDRoqv4QCv9B/mXcnIRALSV0BPuLKBF4rsCEo0+FoYrcjbF+LIZzOw/cPbOCPGTXJPh0rDZjgpLO7l+A+hRxaqh4OLd+DrinY7VjPhcKo57dwIDAQAB";
    }

    function test_configureRecovery_ModuleNotEnabled() public {
        // Arrange
        bytes32 recoveryHash = keccak256(
            abi.encodePacked(RECOVERY_HASH_DOMAIN, email, salt)
        );
        bytes32 dkimPublicKeyHash = keccak256(abi.encodePacked(dkimPublicKey));

        address prevModuleInLinkedList = address(0x1);
        address moduleToDisable = address(safeZkEmailRecoveryPlugin);

        // Act
        vm.startPrank(safeAddress);
        safe.disableModule(prevModuleInLinkedList, moduleToDisable);

        // Assert
        vm.expectRevert(SafeZkEmailRecoveryPlugin.MODULE_NOT_ENABLED.selector);
        safeZkEmailRecoveryPlugin.configureRecovery(
            address(safeECDSAPlugin),
            owner,
            recoveryHash,
            dkimPublicKeyHash,
            address(mockDKIMRegsitry)
        );
    }

    function test_configureRecovery_invalidOwner() public {
        // Arrange
        address invalidOwner = Dave.addr;
        bytes32 recoveryHash = keccak256(
            abi.encodePacked(RECOVERY_HASH_DOMAIN, email, salt)
        );
        bytes32 dkimPublicKeyHash = keccak256(abi.encodePacked(dkimPublicKey));

        // Act & Assert
        vm.startPrank(safeAddress);
        vm.expectRevert(
            abi.encodeWithSelector(
                SafeZkEmailRecoveryPlugin.INVALID_OWNER.selector,
                owner,
                invalidOwner
            )
        );
        safeZkEmailRecoveryPlugin.configureRecovery(
            address(safeECDSAPlugin),
            invalidOwner,
            recoveryHash,
            dkimPublicKeyHash,
            address(mockDKIMRegsitry)
        );
    }

    function test_configureRecovery_recoveryAlreadyInitialised() public {
        // Arrange
        address recoveryAccount = Bob.addr;
        uint256[2] memory a = [uint256(0), uint256(0)];
        uint256[2][2] memory b = [
            [uint256(0), uint256(0)],
            [uint256(0), uint256(0)]
        ];
        uint256[2] memory c = [uint256(0), uint256(0)];

        bytes32 recoveryHash = keccak256(
            abi.encodePacked(RECOVERY_HASH_DOMAIN, email, salt)
        );
        bytes32 dkimPublicKeyHash = keccak256(abi.encodePacked(dkimPublicKey));

        vm.startPrank(safeAddress);
        safeZkEmailRecoveryPlugin.configureRecovery(
            address(safeECDSAPlugin),
            owner,
            recoveryHash,
            dkimPublicKeyHash,
            address(mockDKIMRegsitry)
        );
        vm.stopPrank();

        Vm.Wallet memory newOwner = Carol;

        // Act
        vm.startPrank(recoveryAccount);
        safeZkEmailRecoveryPlugin.initiateRecovery(
            safeAddress,
            newOwner.addr,
            emailDomain,
            a,
            b,
            c
        );

        // Assert
        vm.startPrank(safeAddress);
        vm.expectRevert(
            SafeZkEmailRecoveryPlugin.RECOVERY_ALREADY_INITIATED.selector
        );
        safeZkEmailRecoveryPlugin.configureRecovery(
            address(safeECDSAPlugin),
            owner,
            recoveryHash,
            dkimPublicKeyHash,
            address(mockDKIMRegsitry)
        );
    }

    function test_configureRecovery_recoveryConfiguredSuccessfully() public {
        // Arrange
        bytes32 recoveryHash = keccak256(
            abi.encodePacked(RECOVERY_HASH_DOMAIN, email, salt)
        );
        bytes32 dkimPublicKeyHash = keccak256(abi.encodePacked(dkimPublicKey));

        // Act
        vm.startPrank(safeAddress);
        safeZkEmailRecoveryPlugin.configureRecovery(
            address(safeECDSAPlugin),
            owner,
            recoveryHash,
            dkimPublicKeyHash,
            address(mockDKIMRegsitry)
        );

        RecoveryRequest
            memory zkEmailRecoveryStorage = safeZkEmailRecoveryPlugin
                .getRecoveryRequest(safeAddress);

        // Assert
        assertEq(zkEmailRecoveryStorage.recoveryHash, recoveryHash);
        // FIXME: update assertions
    }

    function test_configureRecovery_addMultipleRecoveryAccountsToSamePlugin()
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

        bytes32 recoveryHash1 = keccak256(
            abi.encodePacked(RECOVERY_HASH_DOMAIN, email, salt)
        );
        bytes32 dkimPublicKeyHash = keccak256(abi.encodePacked(dkimPublicKey));

        bytes32 email2 = 0xdea89a4f4488c5f2e94b9fe37b1c17104c8b11442520b364fde514989c08c478; // ethers.keccak256(ethers.toUtf8Bytes("test2@mail.com"));
        bytes32 recoveryHash2 = keccak256(
            abi.encodePacked(RECOVERY_HASH_DOMAIN, email2, salt)
        );

        // Act
        vm.startPrank(safeAddress);
        safeZkEmailRecoveryPlugin.configureRecovery(
            address(safeECDSAPlugin),
            owner,
            recoveryHash1,
            dkimPublicKeyHash,
            address(mockDKIMRegsitry)
        );

        vm.startPrank(safe2Address);
        safeZkEmailRecoveryPlugin.configureRecovery(
            address(safeECDSAPlugin),
            owner,
            recoveryHash2,
            dkimPublicKeyHash,
            address(mockDKIMRegsitry)
        );

        // Assert
        RecoveryRequest
            memory zkEmailRecoveryStorage = safeZkEmailRecoveryPlugin
                .getRecoveryRequest(safeAddress);
        RecoveryRequest memory ecdsaRecoveryStorage2 = safeZkEmailRecoveryPlugin
            .getRecoveryRequest(safe2Address);

        assertEq(zkEmailRecoveryStorage.recoveryHash, recoveryHash1);
        assertEq(ecdsaRecoveryStorage2.recoveryHash, recoveryHash2);
        // FIXME: update assertions
    }

    function test_initiateRecovery_recoveryAlreadyInitiated() public {
        // Arrange
        address recoveryAccount = Bob.addr;
        uint256[2] memory a = [uint256(0), uint256(0)];
        uint256[2][2] memory b = [
            [uint256(0), uint256(0)],
            [uint256(0), uint256(0)]
        ];
        uint256[2] memory c = [uint256(0), uint256(0)];

        bytes32 recoveryHash = keccak256(
            abi.encodePacked(RECOVERY_HASH_DOMAIN, email, salt)
        );
        bytes32 dkimPublicKeyHash = keccak256(abi.encodePacked(dkimPublicKey));

        vm.startPrank(safeAddress);
        safeZkEmailRecoveryPlugin.configureRecovery(
            address(safeECDSAPlugin),
            owner,
            recoveryHash,
            dkimPublicKeyHash,
            address(mockDKIMRegsitry)
        );
        vm.stopPrank();

        Vm.Wallet memory newOwner = Carol;

        vm.startPrank(recoveryAccount);
        safeZkEmailRecoveryPlugin.initiateRecovery(
            safeAddress,
            newOwner.addr,
            emailDomain,
            a,
            b,
            c
        );

        // Act & Assert
        vm.expectRevert(
            SafeZkEmailRecoveryPlugin.RECOVERY_ALREADY_INITIATED.selector
        );
        safeZkEmailRecoveryPlugin.initiateRecovery(
            safeAddress,
            newOwner.addr,
            emailDomain,
            a,
            b,
            c
        );
    }

    function test_initiateRecovery_invalidDkimPublicKeyHash() public {
        // Arrange
        address recoveryAccount = Bob.addr;
        uint256[2] memory a = [uint256(0), uint256(0)];
        uint256[2][2] memory b = [
            [uint256(0), uint256(0)],
            [uint256(0), uint256(0)]
        ];
        uint256[2] memory c = [uint256(0), uint256(0)];

        bytes32 recoveryHash = keccak256(
            abi.encodePacked(RECOVERY_HASH_DOMAIN, email, salt)
        );
        bytes32 invalidDkimPublicKeyHash = keccak256(
            abi.encodePacked("return false")
        );

        vm.startPrank(safeAddress);
        safeZkEmailRecoveryPlugin.configureRecovery(
            address(safeECDSAPlugin),
            owner,
            recoveryHash,
            invalidDkimPublicKeyHash,
            address(mockDKIMRegsitry)
        );
        vm.stopPrank();

        Vm.Wallet memory newOwner = Carol;

        // Act & Assert
        vm.startPrank(recoveryAccount);
        vm.expectRevert(
            abi.encodeWithSelector(
                SafeZkEmailRecoveryPlugin.INVALID_DKIM_KEY_HASH.selector,
                safeAddress,
                emailDomain,
                invalidDkimPublicKeyHash
            )
        );
        safeZkEmailRecoveryPlugin.initiateRecovery(
            safeAddress,
            newOwner.addr,
            emailDomain,
            a,
            b,
            c
        );
    }

    function test_initiateRecovery_invalidProof() public {
        // Arrange
        address recoveryAccount = Bob.addr;
        uint256[2] memory a = [uint256(1), uint256(0)];
        uint256[2][2] memory b = [
            [uint256(0), uint256(0)],
            [uint256(0), uint256(0)]
        ];
        uint256[2] memory c = [uint256(0), uint256(0)];

        bytes32 recoveryHash = keccak256(
            abi.encodePacked(RECOVERY_HASH_DOMAIN, email, salt)
        );
        bytes32 dkimPublicKeyHash = keccak256(abi.encodePacked(dkimPublicKey));

        vm.startPrank(safeAddress);
        safeZkEmailRecoveryPlugin.configureRecovery(
            address(safeECDSAPlugin),
            owner,
            recoveryHash,
            dkimPublicKeyHash,
            address(mockDKIMRegsitry)
        );
        vm.stopPrank();

        Vm.Wallet memory newOwner = Carol;

        // Act & Assert
        vm.startPrank(recoveryAccount);
        vm.expectRevert(SafeZkEmailRecoveryPlugin.INVALID_PROOF.selector);
        safeZkEmailRecoveryPlugin.initiateRecovery(
            safeAddress,
            newOwner.addr,
            emailDomain,
            a,
            b,
            c
        );
    }

    function test_initiateRecovery_initiatesRecoverySuccessfully() public {
        // Arrange
        address recoveryAccount = Bob.addr;
        uint256[2] memory a = [uint256(0), uint256(0)];
        uint256[2][2] memory b = [
            [uint256(0), uint256(0)],
            [uint256(0), uint256(0)]
        ];
        uint256[2] memory c = [uint256(0), uint256(0)];

        bytes32 recoveryHash = keccak256(
            abi.encodePacked(RECOVERY_HASH_DOMAIN, email, salt)
        );
        bytes32 dkimPublicKeyHash = keccak256(abi.encodePacked(dkimPublicKey));

        vm.startPrank(safeAddress);
        safeZkEmailRecoveryPlugin.configureRecovery(
            address(safeECDSAPlugin),
            owner,
            recoveryHash,
            dkimPublicKeyHash,
            address(mockDKIMRegsitry)
        );
        vm.stopPrank();

        Vm.Wallet memory newOwner = Carol;

        // Act
        vm.startPrank(recoveryAccount);
        safeZkEmailRecoveryPlugin.initiateRecovery(
            safeAddress,
            newOwner.addr,
            emailDomain,
            a,
            b,
            c
        );

        RecoveryRequest memory recoveryRequest = safeZkEmailRecoveryPlugin
            .getRecoveryRequest(safeAddress);

        // Assert
        assertEq(
            recoveryRequest.executeAfter,
            block.timestamp + safeZkEmailRecoveryPlugin.defaultDelay()
        );
        assertEq(recoveryRequest.pendingNewOwner, newOwner.addr);
    }

    function test_recoverPlugin_recoveryNotInitiated() public {
        // Arrange, Act & Assert
        vm.expectRevert(
            SafeZkEmailRecoveryPlugin.RECOVERY_NOT_INITIATED.selector
        );
        safeZkEmailRecoveryPlugin.recoverPlugin(
            safeAddress,
            address(safeECDSAPlugin)
        );
    }

    function test_recoverPlugin_delayNotPassed() public {
        // Arrange
        address recoveryAccount = Bob.addr;
        uint256[2] memory a = [uint256(0), uint256(0)];
        uint256[2][2] memory b = [
            [uint256(0), uint256(0)],
            [uint256(0), uint256(0)]
        ];
        uint256[2] memory c = [uint256(0), uint256(0)];

        bytes32 recoveryHash = keccak256(
            abi.encodePacked(RECOVERY_HASH_DOMAIN, email, salt)
        );
        bytes32 dkimPublicKeyHash = keccak256(abi.encodePacked(dkimPublicKey));

        vm.startPrank(safeAddress);
        safeZkEmailRecoveryPlugin.configureRecovery(
            address(safeECDSAPlugin),
            owner,
            recoveryHash,
            dkimPublicKeyHash,
            address(mockDKIMRegsitry)
        );
        vm.stopPrank();

        Vm.Wallet memory newOwner = Carol;

        vm.startPrank(recoveryAccount);
        safeZkEmailRecoveryPlugin.initiateRecovery(
            safeAddress,
            newOwner.addr,
            emailDomain,
            a,
            b,
            c
        );

        // Act
        vm.startPrank(recoveryAccount);
        vm.expectRevert(SafeZkEmailRecoveryPlugin.DELAY_NOT_PASSED.selector);
        safeZkEmailRecoveryPlugin.recoverPlugin(
            safeAddress,
            address(safeECDSAPlugin)
        );
    }

    function test_recoverPlugin_recoversPluginSuccessfully() public {
        // Arrange
        address recoveryAccount = Bob.addr;
        uint256[2] memory a = [uint256(0), uint256(0)];
        uint256[2][2] memory b = [
            [uint256(0), uint256(0)],
            [uint256(0), uint256(0)]
        ];
        uint256[2] memory c = [uint256(0), uint256(0)];

        bytes32 recoveryHash = keccak256(
            abi.encodePacked(RECOVERY_HASH_DOMAIN, email, salt)
        );
        bytes32 dkimPublicKeyHash = keccak256(abi.encodePacked(dkimPublicKey));

        vm.startPrank(safeAddress);
        safeZkEmailRecoveryPlugin.configureRecovery(
            address(safeECDSAPlugin),
            owner,
            recoveryHash,
            dkimPublicKeyHash,
            address(mockDKIMRegsitry)
        );
        vm.stopPrank();

        Vm.Wallet memory newOwner = Carol;

        vm.startPrank(recoveryAccount);
        safeZkEmailRecoveryPlugin.initiateRecovery(
            safeAddress,
            newOwner.addr,
            emailDomain,
            a,
            b,
            c
        );

        vm.warp(
            block.timestamp +
                safeZkEmailRecoveryPlugin.defaultDelay() +
                1 seconds
        );

        // Act
        vm.startPrank(recoveryAccount);
        safeZkEmailRecoveryPlugin.recoverPlugin(
            safeAddress,
            address(safeECDSAPlugin)
        );

        // Assert
        address updatedOwner = safeECDSAPlugin.getOwner(safeAddress);
        assertEq(updatedOwner, newOwner.addr);

        RecoveryRequest memory recoveryRequest = safeZkEmailRecoveryPlugin
            .getRecoveryRequest(safeAddress);
        assertEq(recoveryRequest.recoveryHash, bytes32(0));
        assertEq(recoveryRequest.dkimPublicKeyHash, bytes32(0));
        assertEq(recoveryRequest.executeAfter, 0);
        assertEq(recoveryRequest.pendingNewOwner, address(0));
    }

    function testFuzz_recoverPlugin_recoversPluginSuccessfullyWithCustomDelay(
        uint256 delay
    ) public {
        // Arrange
        delay = bound(delay, 1 seconds, 52 weeks); // restricting delay from 1 second up to 1 year

        address recoveryAccount = Bob.addr;
        uint256[2] memory a = [uint256(0), uint256(0)];
        uint256[2][2] memory b = [
            [uint256(0), uint256(0)],
            [uint256(0), uint256(0)]
        ];
        uint256[2] memory c = [uint256(0), uint256(0)];

        bytes32 recoveryHash = keccak256(
            abi.encodePacked(RECOVERY_HASH_DOMAIN, email, salt)
        );
        bytes32 dkimPublicKeyHash = keccak256(abi.encodePacked(dkimPublicKey));

        vm.startPrank(safeAddress);
        safeZkEmailRecoveryPlugin.configureRecovery(
            address(safeECDSAPlugin),
            owner,
            recoveryHash,
            dkimPublicKeyHash,
            address(mockDKIMRegsitry)
        );

        safeZkEmailRecoveryPlugin.setCustomDelay(delay);
        vm.stopPrank();

        Vm.Wallet memory newOwner = Carol;

        vm.startPrank(recoveryAccount);
        safeZkEmailRecoveryPlugin.initiateRecovery(
            safeAddress,
            newOwner.addr,
            emailDomain,
            a,
            b,
            c
        );

        uint256 customDelay = safeZkEmailRecoveryPlugin.customDelay(
            safeAddress
        );

        vm.warp(block.timestamp + customDelay + 1 seconds);

        // Act
        vm.startPrank(recoveryAccount);
        safeZkEmailRecoveryPlugin.recoverPlugin(
            safeAddress,
            address(safeECDSAPlugin)
        );

        // Assert
        address updatedOwner = safeECDSAPlugin.getOwner(safeAddress);
        assertEq(updatedOwner, newOwner.addr);

        RecoveryRequest memory recoveryRequest = safeZkEmailRecoveryPlugin
            .getRecoveryRequest(safeAddress);
        assertEq(recoveryRequest.recoveryHash, bytes32(0));
        assertEq(recoveryRequest.dkimPublicKeyHash, bytes32(0));
        assertEq(recoveryRequest.executeAfter, 0);
        assertEq(recoveryRequest.pendingNewOwner, address(0));
    }
}

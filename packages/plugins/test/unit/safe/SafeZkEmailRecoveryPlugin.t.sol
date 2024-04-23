// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "forge-std/Test.sol";
import "forge-std/console2.sol";
import {TestHelper} from "../utils/TestHelper.sol";
import {SafeZkEmailRecoveryPlugin, RecoveryRequest} from "../../../src/safe/SafeZkEmailRecoveryPlugin.sol";
import {SafeZkEmailRecoveryPluginHarness} from "../utils/SafeZkEmailRecoveryPluginHarness.sol";
import {Safe} from "safe-contracts/contracts/Safe.sol";
import {SafeProxy} from "safe-contracts/contracts/proxies/SafeProxy.sol";

import {EmailAuth} from "ether-email-auth/packages/contracts/src/EmailAuth.sol";
import {ECDSAOwnedDKIMRegistry} from "ether-email-auth/packages/contracts/src/utils/ECDSAOwnedDKIMRegistry.sol";
import {Verifier} from "ether-email-auth/packages/contracts/src/utils/Verifier.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/* solhint-disable func-name-mixedcase */
/* solhint-disable private-vars-leading-underscore */
/* solhint-disable var-name-mixedcase */

// TODO: THESE TESTS ARE CURRENTLY SKIPPED IN CI WHILE WE'RE WORKING ON THE ZK SUMMIT DEMO. WE STILL HAVE A PASSING INTEGRATION TEST.

contract SafeZkEmailRecoveryPluginTest is TestHelper {
    using MessageHashUtils for bytes;

    event RecoveryConfigured(
        address indexed safe,
        address indexed owner,
        uint256 customDelay
    );
    event RecoveryInitiated(
        address indexed safe,
        address newOwner,
        uint256 executeAfter
    );
    event OwnerRecovered(
        address indexed safe,
        address oldOwner,
        address newOwner
    );
    event RecoveryCancelled(address indexed safe);
    event RecoveryDelaySet(address indexed safe, uint256 delay);

    constructor() TestHelper() {}

    SafeZkEmailRecoveryPluginHarness public safeZkEmailRecoveryPlugin;
    Safe public safeSingleton;
    Safe public safe;
    address public safeAddress;

    address public owner;

    bytes32 RECOVERY_HASH_DOMAIN;
    bytes32 email;
    string salt;
    string emailDomain;
    string dkimPublicKey;

    // ZK email contracts
    // EmailAuth emailAuth;
    ECDSAOwnedDKIMRegistry ecdsaOwnedDkimRegistry;
    Verifier verifier;
    bytes32 accountSalt;

    string selector = "12345";
    string domainName = "gmail.com";
    bytes32 publicKeyHash =
        0x0ea9c777dc7110e5a9e89b13f0cfc540e3845ba120b2b6dc24024d61488d4788;

    function setUp() public {
        // Create ZK Email contracts
        address zkEmailDeployer = vm.addr(1);
        vm.startPrank(zkEmailDeployer);
        ecdsaOwnedDkimRegistry = new ECDSAOwnedDKIMRegistry(zkEmailDeployer);
        string memory signedMsg = ecdsaOwnedDkimRegistry.computeSignedMsg(
            ecdsaOwnedDkimRegistry.SET_PREFIX(),
            selector,
            domainName,
            publicKeyHash
        );
        bytes32 digest = MessageHashUtils.toEthSignedMessageHash(
            bytes(signedMsg)
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(1, digest);
        bytes memory signature = abi.encodePacked(r, s, v);
        ecdsaOwnedDkimRegistry.setDKIMPublicKeyHash(
            selector,
            domainName,
            publicKeyHash,
            signature
        );

        verifier = new Verifier();
        accountSalt = 0x2c3abbf3d1171bfefee99c13bf9c47f1e8447576afd89096652a34f27b297971;

        EmailAuth emailAuthImpl = new EmailAuth();
        // ERC1967Proxy emailAuthProxy = new ERC1967Proxy(
        //     address(emailAuthImpl),
        //     abi.encodeWithSelector(
        //         emailAuthImpl.initialize.selector,
        //         accountSalt
        //     )
        // );
        // emailAuth = EmailAuth(payable(address(emailAuthProxy)));
        // emailAuth.updateVerifier(address(verifier));
        // emailAuth.updateDKIMRegistry(address(ecdsaOwnedDkimRegistry));
        vm.stopPrank();

        safeZkEmailRecoveryPlugin = new SafeZkEmailRecoveryPluginHarness(
            address(verifier),
            address(ecdsaOwnedDkimRegistry),
            address(emailAuthImpl)
        );

        safeSingleton = new Safe();
        SafeProxy safeProxy = new SafeProxy(address(safeSingleton));

        // safe4337Module = new Safe4337Module(entryPointAddress);
        // safeModuleSetup = new SafeModuleSetup();

        address[] memory owners = new address[](1);
        owner = Alice.addr;
        owners[0] = owner;

        safe = Safe(payable(address(safeProxy)));
        safeAddress = address(safe);

        safe.setup(
            owners,
            1,
            address(0),
            bytes("0"),
            address(0),
            // address(safeModuleSetup),
            // abi.encodeCall(SafeModuleSetup.enableModules, (modules)),
            // address(safe4337Module),
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
        address guardian;
        uint256 customDelay = 0;
        address previousOwnerInLinkedList = address(0x1);

        address prevModuleInLinkedList = address(0x1);
        address moduleToDisable = address(safeZkEmailRecoveryPlugin);

        // Act
        vm.startPrank(safeAddress);
        safe.disableModule(prevModuleInLinkedList, moduleToDisable);

        // Assert
        vm.expectRevert(SafeZkEmailRecoveryPlugin.MODULE_NOT_ENABLED.selector);
        safeZkEmailRecoveryPlugin.configureRecovery(
            owner,
            guardian,
            customDelay,
            previousOwnerInLinkedList
        );
    }

    function test_configureRecovery_invalidOwner() public {
        // Arrange
        address invalidOwner = Dave.addr;
        address guardian;
        uint256 customDelay = 0;
        address previousOwnerInLinkedList = address(0x1);

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
            invalidOwner,
            guardian,
            customDelay,
            previousOwnerInLinkedList
        );
    }

    function test_configureRecovery_recoveryAlreadyInitialised() public {
        // Arrange
        address recoveryAccount = Bob.addr;

        address guardian;
        uint256 customDelay = 0;
        address previousOwnerInLinkedList = address(0x1);

        uint templateIdx;
        bytes[] memory subjectParams;

        vm.startPrank(safeAddress);
        safeZkEmailRecoveryPlugin.configureRecovery(
            owner,
            guardian,
            customDelay,
            previousOwnerInLinkedList
        );
        vm.stopPrank();

        // Act
        vm.startPrank(recoveryAccount);
        safeZkEmailRecoveryPlugin.exposedProcessRecovery(
            guardian,
            templateIdx,
            subjectParams,
            bytes32(0)
        );

        // Assert
        vm.startPrank(safeAddress);
        vm.expectRevert(
            SafeZkEmailRecoveryPlugin.RECOVERY_ALREADY_INITIATED.selector
        );
        safeZkEmailRecoveryPlugin.configureRecovery(
            owner,
            guardian,
            customDelay,
            previousOwnerInLinkedList
        );
    }

    function test_configureRecovery_recoveryConfiguredSuccessfullyWithDefaultDelay()
        public
    {
        // Arrange
        address guardian;
        uint256 customDelay = 0;
        address previousOwnerInLinkedList = address(0x1);

        // Act
        vm.startPrank(safeAddress);
        vm.expectEmit(true, true, false, false);
        emit RecoveryConfigured(safeAddress, owner, customDelay);
        safeZkEmailRecoveryPlugin.configureRecovery(
            owner,
            guardian,
            customDelay,
            previousOwnerInLinkedList
        );

        RecoveryRequest memory recoveryRequest = safeZkEmailRecoveryPlugin
            .getRecoveryRequest(safeAddress);

        // Assert
        assertEq(recoveryRequest.executeAfter, 0);
        assertEq(recoveryRequest.pendingNewOwner, address(0));
        assertEq(
            recoveryRequest.delay,
            safeZkEmailRecoveryPlugin.defaultDelay()
        );
    }

    function test_configureRecovery_recoveryConfiguredSuccessfullyWithCustomDelay()
        public
    {
        // Arrange
        address guardian;
        uint256 customDelay = 48 hours;
        address previousOwnerInLinkedList = address(0x1);

        // Act
        vm.startPrank(safeAddress);
        vm.expectEmit(true, true, false, false);
        emit RecoveryConfigured(safeAddress, owner, customDelay);
        safeZkEmailRecoveryPlugin.configureRecovery(
            owner,
            guardian,
            customDelay,
            previousOwnerInLinkedList
        );

        RecoveryRequest memory recoveryRequest = safeZkEmailRecoveryPlugin
            .getRecoveryRequest(safeAddress);

        // Assert
        assertEq(recoveryRequest.executeAfter, 0);
        assertEq(recoveryRequest.pendingNewOwner, address(0));
        assertEq(recoveryRequest.delay, customDelay);
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
            address(0),
            bytes("0"),
            address(0),
            // address(safeModuleSetup),
            // abi.encodeCall(SafeModuleSetup.enableModules, (modules)),
            // address(safe4337Module),
            address(0),
            0,
            payable(address(0))
        );

        safe2.enableModule(address(safeZkEmailRecoveryPlugin));
        vm.stopPrank();

        address guardian1;
        uint256 customDelay = 0;
        address previousOwnerInLinkedList = address(0x1);

        address guardian2;

        // Act
        vm.startPrank(safeAddress);
        safeZkEmailRecoveryPlugin.configureRecovery(
            owner,
            guardian1,
            customDelay,
            previousOwnerInLinkedList
        );

        vm.startPrank(safe2Address);
        safeZkEmailRecoveryPlugin.configureRecovery(
            owner,
            guardian2,
            customDelay,
            previousOwnerInLinkedList
        );

        // Assert
        RecoveryRequest memory recoveryRequest1 = safeZkEmailRecoveryPlugin
            .getRecoveryRequest(safeAddress);
        RecoveryRequest memory recoveryRequest2 = safeZkEmailRecoveryPlugin
            .getRecoveryRequest(safe2Address);

        assertEq(recoveryRequest1.executeAfter, 0);
        assertEq(recoveryRequest1.pendingNewOwner, address(0));

        assertEq(recoveryRequest2.executeAfter, 0);
        assertEq(recoveryRequest2.pendingNewOwner, address(0));
    }

    function test_initiateRecovery_recoveryNotConfigured() public {
        // Arrange
        address recoveryAccount = Bob.addr;
        address guardian;

        uint templateIdx;
        bytes[] memory subjectParams;

        // Act & Assert
        vm.startPrank(recoveryAccount);
        // TODO Chekc if still needed in follow up work
        // vm.expectRevert(
        //     SafeZkEmailRecoveryPlugin.RECOVERY_NOT_CONFIGURED.selector
        // );
        safeZkEmailRecoveryPlugin.exposedProcessRecovery(
            guardian,
            templateIdx,
            subjectParams,
            bytes32(0)
        );
    }

    function test_initiateRecovery_recoveryAlreadyInitiated() public {
        // Arrange
        address recoveryAccount = Bob.addr;

        address guardian;
        uint256 customDelay = 0;
        address previousOwnerInLinkedList = address(0x1);

        uint templateIdx;
        bytes[] memory subjectParams;

        vm.startPrank(safeAddress);
        safeZkEmailRecoveryPlugin.configureRecovery(
            owner,
            guardian,
            customDelay,
            previousOwnerInLinkedList
        );
        vm.stopPrank();

        vm.startPrank(recoveryAccount);
        safeZkEmailRecoveryPlugin.exposedProcessRecovery(
            guardian,
            templateIdx,
            subjectParams,
            bytes32(0)
        );

        // Act & Assert
        vm.expectRevert(
            SafeZkEmailRecoveryPlugin.RECOVERY_ALREADY_INITIATED.selector
        );
        safeZkEmailRecoveryPlugin.exposedProcessRecovery(
            guardian,
            templateIdx,
            subjectParams,
            bytes32(0)
        );
    }

    function test_initiateRecovery_initiatesRecoverySuccessfully() public {
        // Arrange
        address recoveryAccount = Bob.addr;

        address guardian;
        uint256 customDelay = 0;
        address previousOwnerInLinkedList = address(0x1);

        uint templateIdx;
        bytes[] memory subjectParams;

        uint256 expectedExecuteAfter = block.timestamp +
            safeZkEmailRecoveryPlugin.defaultDelay();

        vm.startPrank(safeAddress);
        safeZkEmailRecoveryPlugin.configureRecovery(
            owner,
            guardian,
            customDelay,
            previousOwnerInLinkedList
        );
        vm.stopPrank();

        Vm.Wallet memory newOwner = Carol;

        // Act
        vm.startPrank(recoveryAccount);
        vm.expectEmit(true, false, false, false);
        emit RecoveryInitiated(
            safeAddress,
            newOwner.addr,
            expectedExecuteAfter
        );
        safeZkEmailRecoveryPlugin.exposedProcessRecovery(
            guardian,
            templateIdx,
            subjectParams,
            bytes32(0)
        );

        RecoveryRequest memory recoveryRequest = safeZkEmailRecoveryPlugin
            .getRecoveryRequest(safeAddress);

        // Assert
        assertEq(recoveryRequest.executeAfter, expectedExecuteAfter);
        assertEq(recoveryRequest.pendingNewOwner, newOwner.addr);
    }

    function test_recoverPlugin_recoveryNotInitiated() public {
        // Arrange
        address previousOwnerInLinkedList;

        // Act & Assert
        vm.expectRevert(
            SafeZkEmailRecoveryPlugin.RECOVERY_NOT_INITIATED.selector
        );
        safeZkEmailRecoveryPlugin.recoverPlugin(
            safeAddress,
            previousOwnerInLinkedList
        );
    }

    function test_recoverPlugin_delayNotPassed() public {
        // Arrange
        address recoveryAccount = Bob.addr;

        address guardian;
        uint256 customDelay = 0;
        address previousOwnerInLinkedList = address(0x1);

        uint templateIdx;
        bytes[] memory subjectParams;

        vm.startPrank(safeAddress);
        safeZkEmailRecoveryPlugin.configureRecovery(
            owner,
            guardian,
            customDelay,
            previousOwnerInLinkedList
        );
        vm.stopPrank();

        vm.startPrank(recoveryAccount);
        safeZkEmailRecoveryPlugin.exposedProcessRecovery(
            guardian,
            templateIdx,
            subjectParams,
            bytes32(0)
        );

        // Act
        vm.startPrank(recoveryAccount);
        vm.expectRevert(SafeZkEmailRecoveryPlugin.DELAY_NOT_PASSED.selector);
        safeZkEmailRecoveryPlugin.recoverPlugin(
            safeAddress,
            previousOwnerInLinkedList
        );
    }

    function test_recoverPlugin_swapsPluginOwnerSuccessfully() public {
        // Arrange
        address recoveryAccount = Bob.addr;

        address guardian;
        uint256 customDelay = 0;
        address previousOwnerInLinkedList = address(0x1);

        uint templateIdx;
        bytes[] memory subjectParams;

        vm.startPrank(safeAddress);
        safeZkEmailRecoveryPlugin.configureRecovery(
            owner,
            guardian,
            customDelay,
            previousOwnerInLinkedList
        );
        vm.stopPrank();

        Vm.Wallet memory newOwner = Carol;

        vm.startPrank(recoveryAccount);
        safeZkEmailRecoveryPlugin.exposedProcessRecovery(
            guardian,
            templateIdx,
            subjectParams,
            bytes32(0)
        );

        vm.warp(
            block.timestamp +
                safeZkEmailRecoveryPlugin.defaultDelay() +
                1 seconds
        );

        // Act
        vm.startPrank(recoveryAccount);
        vm.expectEmit(true, false, false, false);
        emit OwnerRecovered(safeAddress, owner, newOwner.addr);
        safeZkEmailRecoveryPlugin.recoverPlugin(
            safeAddress,
            previousOwnerInLinkedList
        );

        // Assert
        bool isOwner = Safe(payable(safeAddress)).isOwner(newOwner.addr);
        assertTrue(isOwner);

        RecoveryRequest memory recoveryRequest = safeZkEmailRecoveryPlugin
            .getRecoveryRequest(safeAddress);
        assertEq(recoveryRequest.executeAfter, 0);
        assertEq(recoveryRequest.pendingNewOwner, address(0));
    }

    function testFuzz_recoverPlugin_swapsPluginOwnerSuccessfullyWithCustomDelay(
        uint256 delay
    ) public {
        // Arrange
        delay = bound(delay, 1 seconds, 52 weeks); // restricting delay from 1 second up to 1 year

        address recoveryAccount = Bob.addr;

        address guardian;
        uint256 initialDelay = 0;
        address previousOwnerInLinkedList = address(0x1);

        uint templateIdx;
        bytes[] memory subjectParams;

        vm.startPrank(safeAddress);
        safeZkEmailRecoveryPlugin.configureRecovery(
            owner,
            guardian,
            initialDelay,
            previousOwnerInLinkedList
        );

        RecoveryRequest memory recoveryRequest = safeZkEmailRecoveryPlugin
            .getRecoveryRequest(safeAddress);
        assertEq(
            recoveryRequest.delay,
            safeZkEmailRecoveryPlugin.defaultDelay()
        );

        vm.expectEmit(true, false, false, false);
        emit RecoveryDelaySet(safeAddress, delay);
        // TODO Chekc if still needed in follow up work
        // safeZkEmailRecoveryPlugin.setRecoveryDelay(delay);
        vm.stopPrank();

        Vm.Wallet memory newOwner = Carol;

        vm.startPrank(recoveryAccount);
        safeZkEmailRecoveryPlugin.exposedProcessRecovery(
            guardian,
            templateIdx,
            subjectParams,
            bytes32(0)
        );

        vm.warp(block.timestamp + delay + 1 seconds);

        // Act
        vm.startPrank(recoveryAccount);
        safeZkEmailRecoveryPlugin.recoverPlugin(
            safeAddress,
            previousOwnerInLinkedList
        );

        // Assert
        bool isOwner = Safe(payable(safeAddress)).isOwner(newOwner.addr);
        assertTrue(isOwner);

        assertEq(recoveryRequest.executeAfter, 0);
        assertEq(recoveryRequest.pendingNewOwner, address(0));
    }

    function test_cancelRecovery_deletesRecoveryRequest() public {
        // Arrange
        address recoveryAccount = Bob.addr;

        address guardian;
        uint256 customDelay = 0;
        address previousOwnerInLinkedList = address(0x1);

        uint templateIdx;
        bytes[] memory subjectParams;

        vm.startPrank(safeAddress);
        safeZkEmailRecoveryPlugin.configureRecovery(
            owner,
            guardian,
            customDelay,
            previousOwnerInLinkedList
        );
        vm.stopPrank();

        Vm.Wallet memory newOwner = Carol;

        vm.startPrank(recoveryAccount);
        safeZkEmailRecoveryPlugin.exposedProcessRecovery(
            guardian,
            templateIdx,
            subjectParams,
            bytes32(0)
        );

        RecoveryRequest memory recoveryRequestBefore = safeZkEmailRecoveryPlugin
            .getRecoveryRequest(safeAddress);

        // Act
        vm.startPrank(safeAddress);
        vm.expectEmit(true, false, false, false);
        emit RecoveryCancelled(safeAddress);
        safeZkEmailRecoveryPlugin.cancelRecovery();

        RecoveryRequest memory recoveryRequestAfter = safeZkEmailRecoveryPlugin
            .getRecoveryRequest(safeAddress);

        // Assert
        assertEq(
            recoveryRequestBefore.executeAfter,
            block.timestamp + safeZkEmailRecoveryPlugin.defaultDelay()
        );
        assertEq(recoveryRequestBefore.pendingNewOwner, newOwner.addr);

        assertEq(recoveryRequestAfter.executeAfter, 0);
        assertEq(recoveryRequestAfter.pendingNewOwner, address(0));
    }
}

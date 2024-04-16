// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "forge-std/Test.sol";
import "forge-std/console2.sol";
import {TestHelper} from "../../unit/utils/TestHelper.sol";
import {SafeZkEmailRecoveryPlugin} from "../../../src/safe/SafeZkEmailRecoveryPlugin.sol";
import {ISafeZkEmailRecoveryPlugin} from "../../../src/safe/interface/ISafeZkEmailRecoveryPlugin.sol";

import {IEmailAccountRecovery} from "../../../src/safe/EmailAccountRecoveryRouter.sol";
import {MockGroth16Verifier} from "../../../src/safe/utils/MockGroth16Verifier.sol";
import {Safe} from "safe-contracts/contracts/Safe.sol";
import {SafeProxy} from "safe-contracts/contracts/proxies/SafeProxy.sol";

import {EmailAuth, EmailAuthMsg, EmailProof} from "ether-email-auth/packages/contracts/src/EmailAuth.sol";
import {ECDSAOwnedDKIMRegistry} from "ether-email-auth/packages/contracts/src/utils/ECDSAOwnedDKIMRegistry.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/* solhint-disable func-name-mixedcase */
/* solhint-disable private-vars-leading-underscore */
/* solhint-disable var-name-mixedcase */

contract SafeZkEmailRecoveryPlugin_Integration_Test is TestHelper {
    using MessageHashUtils for bytes;

    constructor() TestHelper() {}

    SafeZkEmailRecoveryPlugin public safeZkEmailRecoveryPlugin;
    Safe public safeSingleton;
    Safe public safe;
    address public safeAddress;

    address zkEmailDeployer = vm.addr(1);
    address public owner;

    // ZK email contracts
    // EmailAuth emailAuth;
    ECDSAOwnedDKIMRegistry ecdsaOwnedDkimRegistry;
    MockGroth16Verifier verifier;
    bytes32 accountSalt1;
    bytes32 accountSalt2;

    address guardian1;
    address guardian2;

    string selector = "12345";
    string domainName = "gmail.com";
    bytes32 publicKeyHash =
        0x0ea9c777dc7110e5a9e89b13f0cfc540e3845ba120b2b6dc24024d61488d4788;

    function setUp() public {
        // Create ZK Email contracts
        address signer = zkEmailDeployer;
        vm.startPrank(signer);
        ecdsaOwnedDkimRegistry = new ECDSAOwnedDKIMRegistry(signer);
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

        verifier = new MockGroth16Verifier();
        accountSalt1 = keccak256(abi.encode("account salt 1"));
        accountSalt2 = keccak256(abi.encode("account salt 2"));

        EmailAuth emailAuthImpl = new EmailAuth();
        vm.stopPrank();

        safeZkEmailRecoveryPlugin = new SafeZkEmailRecoveryPlugin(
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

        guardian1 = safeZkEmailRecoveryPlugin.computeEmailAuthAddress(
            accountSalt1
        );
        guardian2 = safeZkEmailRecoveryPlugin.computeEmailAuthAddress(
            accountSalt2
        );
    }

    function generateMockEmailProof(
        string memory subject,
        bytes32 nullifier,
        bytes32 accountSalt
    ) public returns (EmailProof memory) {
        EmailProof memory emailProof;
        emailProof.domainName = "gmail.com";
        emailProof.publicKeyHash = bytes32(
            vm.parseUint(
                "6632353713085157925504008443078919716322386156160602218536961028046468237192"
            )
        );
        emailProof.timestamp = block.timestamp;
        emailProof.maskedSubject = subject;
        emailProof.emailNullifier = nullifier;
        emailProof.accountSalt = accountSalt;
        emailProof.isCodeExist = true;
        emailProof.proof = bytes("0");

        return emailProof;
    }

    function generateEmailAuthMsg() public {}

    function acceptGuardian(
        address safeAddress,
        address emailAccountRecoveryRouterAddress,
        string memory subject,
        bytes32 nullifier,
        bytes32 accountSalt,
        uint256 templateIdx
    ) public {
        EmailProof memory emailProof = generateMockEmailProof(
            subject,
            nullifier,
            accountSalt
        );

        // Handle acceptance
        bytes[] memory subjectParamsForAcceptance = new bytes[](1);
        subjectParamsForAcceptance[0] = abi.encode(safeAddress);
        EmailAuthMsg memory emailAuthMsg = EmailAuthMsg({
            templateId: safeZkEmailRecoveryPlugin.computeAcceptanceTemplateId(
                templateIdx
            ),
            subjectParams: subjectParamsForAcceptance,
            skipedSubjectPrefix: 0,
            proof: emailProof
        });
        IEmailAccountRecovery(emailAccountRecoveryRouterAddress)
            .handleAcceptance(emailAuthMsg, templateIdx);
    }

    function handleRecovery(
        address safeAddress,
        address newOwner,
        address emailAccountRecoveryRouterAddress,
        string memory subject,
        bytes32 nullifier,
        bytes32 accountSalt,
        uint256 templateIdx
    ) public {
        EmailProof memory emailProof = generateMockEmailProof(
            subject,
            nullifier,
            accountSalt
        );

        bytes[] memory subjectParamsForRecovery = new bytes[](3);
        subjectParamsForRecovery[0] = abi.encode(owner);
        subjectParamsForRecovery[1] = abi.encode(newOwner);
        subjectParamsForRecovery[2] = abi.encode(safeAddress);

        EmailAuthMsg memory emailAuthMsg = EmailAuthMsg({
            templateId: safeZkEmailRecoveryPlugin.computeRecoveryTemplateId(
                templateIdx
            ),
            subjectParams: subjectParamsForRecovery,
            skipedSubjectPrefix: 0,
            proof: emailProof
        });
        IEmailAccountRecovery(emailAccountRecoveryRouterAddress).handleRecovery(
            emailAuthMsg,
            templateIdx
        );
    }

    function testIntegration_AccountRecovery() public {
        Vm.Wallet memory newOwner = Carol;

        address[] memory guardians = new address[](2);

        guardians[0] = guardian1;
        guardians[1] = guardian2;

        address previousOwnerInLinkedList = address(0x1);
        uint256 recoveryDelay = 1 seconds;
        uint256 threshold = 2;
        uint templateIdx = 0;

        // Configure recovery
        vm.startPrank(safeAddress);
        address emailAccountRecoveryRouterAddress = safeZkEmailRecoveryPlugin
            .configureRecovery(
                guardians,
                previousOwnerInLinkedList,
                recoveryDelay,
                threshold
            );
        vm.stopPrank();

        // Create email proof for guardian acceptance

        // Accept guardian 1
        acceptGuardian(
            safeAddress,
            emailAccountRecoveryRouterAddress,
            "Accept guardian request for 0x78cA0A67bF6Cbe8Bf2429f0c7934eE5Dd687a32c",
            keccak256(abi.encode("nullifier 1")),
            accountSalt1,
            templateIdx
        );
        // Accept guardian 2
        acceptGuardian(
            safeAddress,
            emailAccountRecoveryRouterAddress,
            "Accept guardian request for 0x78cA0A67bF6Cbe8Bf2429f0c7934eE5Dd687a32c",
            keccak256(abi.encode("nullifier 1")),
            accountSalt2,
            templateIdx
        );

        // assertTrue(guardianRequest.accepted);

        vm.warp(12 seconds);

        // Create email proof for recovery & handle recovery
        // handle recovery request for guardian 1
        handleRecovery(
            safeAddress,
            newOwner.addr,
            emailAccountRecoveryRouterAddress,
            "Update owner from 0xBf0b5A4099F0bf6c8bC4252eBeC548Bae95602Ea to 0xDdF4497d39b10cf50Af640942cc15233970dA0c2 on account 0x78cA0A67bF6Cbe8Bf2429f0c7934eE5Dd687a32c",
            keccak256(abi.encode("nullifier 2")),
            accountSalt1,
            templateIdx
        );
        // handle recovery request for guardian 2
        handleRecovery(
            safeAddress,
            newOwner.addr,
            emailAccountRecoveryRouterAddress,
            "Update owner from 0xBf0b5A4099F0bf6c8bC4252eBeC548Bae95602Ea to 0xDdF4497d39b10cf50Af640942cc15233970dA0c2 on account 0x78cA0A67bF6Cbe8Bf2429f0c7934eE5Dd687a32c",
            keccak256(abi.encode("nullifier 2")),
            accountSalt2,
            templateIdx
        );

        vm.warp(block.timestamp + recoveryDelay);

        // Complete recovery
        IEmailAccountRecovery(emailAccountRecoveryRouterAddress)
            .completeRecovery();

        bool isOwner = Safe(payable(safeAddress)).isOwner(newOwner.addr);
        assertTrue(isOwner, "New owner has not been added to the Safe");

        bool oldOwnerIsOwner = Safe(payable(safeAddress)).isOwner(owner);
        assertFalse(
            oldOwnerIsOwner,
            "Old owner has not been removed from the Safe"
        );
    }
}

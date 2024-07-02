// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "forge-std/Test.sol";
import "forge-std/console2.sol";
import {TestHelper} from "../../unit/utils/TestHelper.sol";
import {SafeZkEmailRecoveryPlugin, RecoveryRequest, GuardianRequest} from "../../../src/safe/SafeZkEmailRecoveryPlugin.sol";
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
    bytes32 accountSalt;

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
        accountSalt = 0x2c3abbf3d1171bfefee99c13bf9c47f1e8447576afd89096652a34f27b297971;

        EmailAuth emailAuthImpl = new EmailAuth();
        ERC1967Proxy emailAuthProxy = new ERC1967Proxy(
            address(emailAuthImpl),
            abi.encodeWithSelector(
                emailAuthImpl.initialize.selector,
                signer,
                accountSalt
            )
        );
        // emailAuth = EmailAuth(payable(address(emailAuthProxy)));
        // emailAuth.updateVerifier(address(verifier));
        // emailAuth.updateDKIMRegistry(address(ecdsaOwnedDkimRegistry));
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
    }

    function testIntegration_AccountRecovery() public {
        Vm.Wallet memory newOwner = Carol;
        address guardian = safeZkEmailRecoveryPlugin.computeEmailAuthAddress(
            accountSalt
        );
        address previousOwnerInLinkedList = address(0x1);
        uint256 customDelay = 0;
        uint templateIdx = 0;

        // Configure recovery
        vm.startPrank(safeAddress);
        address emailAccountRecoveryRouterAddress = safeZkEmailRecoveryPlugin
            .configureRecovery(
                owner,
                guardian,
                customDelay,
                previousOwnerInLinkedList
            );
        vm.stopPrank();

        // Create email proof for guardian acceptance
        EmailProof memory emailProof;
        emailProof.domainName = "gmail.com";
        emailProof.publicKeyHash = bytes32(
            vm.parseUint(
                "6632353713085157925504008443078919716322386156160602218536961028046468237192"
            )
        );
        emailProof.timestamp = block.timestamp;
        emailProof
            .maskedSubject = "Accept guardian request for 0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9";
        emailProof.emailNullifier = keccak256(abi.encode("nullifier 1"));
        emailProof.accountSalt = accountSalt;
        emailProof.isCodeExist = true;
        emailProof.proof = bytes("0");

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

        GuardianRequest memory guardianRequest = safeZkEmailRecoveryPlugin
            .getGuardianRequest(guardian);
        assertTrue(guardianRequest.accepted);
        assertEq(guardianRequest.safe, safeAddress);

        // Create email proof for recovery
        emailProof.domainName = "gmail.com";
        emailProof.publicKeyHash = bytes32(
            vm.parseUint(
                "6632353713085157925504008443078919716322386156160602218536961028046468237192"
            )
        );
        emailProof.timestamp = block.timestamp + 1;
        emailProof
            .maskedSubject = "Update owner to 0xDdF4497d39b10cf50Af640942cc15233970dA0c2 on account 0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9";
        emailProof.emailNullifier = keccak256(abi.encode("nullifier 2"));
        emailProof.accountSalt = accountSalt;
        require(
            emailProof.accountSalt == accountSalt,
            "accountSalt should be the same"
        );
        emailProof.isCodeExist = true;
        emailProof.proof = bytes("0");

        // Handle recovery
        bytes[] memory subjectParamsForRecovery = new bytes[](2);
        subjectParamsForRecovery[0] = abi.encode(newOwner.addr);
        subjectParamsForRecovery[1] = abi.encode(safeAddress);
        emailAuthMsg = EmailAuthMsg({
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

        vm.warp(
            block.timestamp +
                safeZkEmailRecoveryPlugin.defaultDelay() +
                1 seconds
        );

        // Complete recovery
        IEmailAccountRecovery(emailAccountRecoveryRouterAddress)
            .completeRecovery();

        bool isOwner = Safe(payable(safeAddress)).isOwner(newOwner.addr);
        assertTrue(isOwner);

        bool oldOwnerIsOwner = Safe(payable(safeAddress)).isOwner(owner);
        assertFalse(oldOwnerIsOwner);
    }
}

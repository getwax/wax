// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {EmailAccountRecovery} from "ether-email-auth/packages/contracts/src/EmailAccountRecovery.sol";
import {GuardianManager} from "./GuardianManager.sol";
import {RouterManager} from "./RouterManager.sol";
import {ISafeZkEmailRecoveryPlugin} from "./interface/ISafeZkEmailRecoveryPlugin.sol";
import {ISafe} from "./utils/Safe4337Base.sol";
import {EmailAccountRecoveryRouter} from "./EmailAccountRecoveryRouter.sol";
import "forge-std/console2.sol";

/*//////////////////////////////////////////////////////////////////////////
    THIS CONTRACT IS STILL IN ACTIVE DEVELOPMENT. NOT FOR PRODUCTION USE        
//////////////////////////////////////////////////////////////////////////*/

// Recovery flow
// 1. deploy singleton contract
// 2. account owner calls configureRecovery to configure recovery
// 3. Via the relayer, the owner can request a guardian with handleAcceptance (calls acceptGuardian under the hood)
// 4. Via the relayer, the guardian can call handleRecovery (calls processRecovery under the hood)
// 5. Via the relayer (but can be called by anyone), call completeRecovery which will complete recovery if the conditions have been met (calls recoverPlugin under the hood)

/**
 * A safe plugin that recovers a safe owner via a zkp of an email.
 * NOT FOR PRODUCTION USE
 */
contract SafeZkEmailRecoveryPlugin is
    GuardianManager,
    RouterManager,
    ISafeZkEmailRecoveryPlugin,
    EmailAccountRecovery
{
    /** Mapping of safe address to recovery delay */
    mapping(address => uint256) public recoveryDelays;

    /** Mapping of safe address to recovery request */
    mapping(address => RecoveryRequest) public recoveryRequests;

    constructor(
        address _verifier,
        address _dkimRegistry,
        address _emailAuthImpl
    ) {
        verifierAddr = _verifier;
        dkimAddr = _dkimRegistry;
        emailAuthImplementationAddr = _emailAuthImpl;
    }

    /// @inheritdoc ISafeZkEmailRecoveryPlugin
    function getRecoveryDelay(address safe) external view returns (uint256) {
        return recoveryDelays[safe];
    }

    /// @inheritdoc ISafeZkEmailRecoveryPlugin
    function getRecoveryRequest(
        address safe
    ) external view returns (RecoveryRequest memory) {
        return recoveryRequests[safe];
    }

    /// @inheritdoc EmailAccountRecovery
    function acceptanceSubjectTemplates()
        public
        pure
        override
        returns (string[][] memory)
    {
        string[][] memory templates = new string[][](1);
        templates[0] = new string[](5);
        templates[0][0] = "Accept";
        templates[0][1] = "guardian";
        templates[0][2] = "request";
        templates[0][3] = "for";
        templates[0][4] = "{ethAddr}";
        return templates;
    }

    /// @inheritdoc EmailAccountRecovery
    function recoverySubjectTemplates()
        public
        pure
        override
        returns (string[][] memory)
    {
        string[][] memory templates = new string[][](1);
        templates[0] = new string[](9);
        templates[0][0] = "Update";
        templates[0][1] = "owner";
        templates[0][2] = "from";
        templates[0][3] = "{ethAddr}";
        templates[0][4] = "to";
        templates[0][5] = "{ethAddr}";
        templates[0][6] = "on";
        templates[0][7] = "account";
        templates[0][8] = "{ethAddr}";
        return templates;
    }

    /// @inheritdoc ISafeZkEmailRecoveryPlugin
    function configureRecovery(
        address[] memory guardians,
        uint256 recoveryDelay,
        uint256 threshold
    ) external returns (address routerAddress) {
        address safe = msg.sender;

        // Check this module is enabled on the calling Safe account
        bool moduleEnabled = ISafe(safe).isModuleEnabled(address(this));
        if (!moduleEnabled) revert ModuleNotEnabled();

        setupGuardians(safe, guardians, threshold);

        if (recoveryRequests[safe].executeAfter > 0) {
            revert RecoveryAlreadyInitiated();
        }

        routerAddress = deployRouterForAccount(safe);

        recoveryDelays[safe] = recoveryDelay;

        emit RecoveryConfigured(
            safe,
            guardians.length,
            threshold,
            recoveryDelay
        );
    }

    // TODO: add natspec to interface or inherit from EmailAccountRecovery
    function acceptGuardian(
        address guardian,
        uint templateIdx,
        bytes[] memory subjectParams,
        bytes32
    ) internal override {
        if (guardian == address(0)) revert InvalidGuardian();
        if (templateIdx != 0) revert InvalidTemplateIndex();
        if (subjectParams.length != 1) revert InvalidSubjectParams();

        address safeInEmail = abi.decode(subjectParams[0], (address));

        address safeForRouter = getAccountForRouter(msg.sender);
        if (safeForRouter != safeInEmail) revert InvalidAccountForRouter();

        if (!isGuardian(guardian, safeInEmail))
            revert GuardianInvalidForSafeInEmail();

        GuardianStatus guardianStatus = getGuardianStatus(
            safeInEmail,
            guardian
        );
        if (guardianStatus == GuardianStatus.ACCEPTED)
            revert GuardianAlreadyAccepted();

        updateGuardian(safeInEmail, guardian, GuardianStatus.ACCEPTED);
    }

    // TODO: add natspec to interface or inherit from EmailAccountRecovery
    function processRecovery(
        address guardian,
        uint templateIdx,
        bytes[] memory subjectParams,
        bytes32
    ) internal override {
        if (guardian == address(0)) revert InvalidGuardian();
        if (templateIdx != 0) revert InvalidTemplateIndex();
        if (subjectParams.length != 3) revert InvalidSubjectParams();

        address ownerToSwapInEmail = abi.decode(subjectParams[0], (address));
        address newOwnerInEmail = abi.decode(subjectParams[1], (address));
        address safeInEmail = abi.decode(subjectParams[2], (address));

        address safeForRouter = getAccountForRouter(msg.sender);
        if (safeForRouter != safeInEmail) revert InvalidAccountForRouter();

        if (!isGuardian(guardian, safeInEmail))
            revert GuardianInvalidForSafeInEmail();

        GuardianStatus guardianStatus = getGuardianStatus(
            safeInEmail,
            guardian
        );
        if (guardianStatus == GuardianStatus.REQUESTED)
            revert GuardianHasNotAccepted();

        bool isExistingOwner = ISafe(safeInEmail).isOwner(newOwnerInEmail);
        if (isExistingOwner) revert InvalidNewOwner();

        RecoveryRequest memory recoveryRequest = recoveryRequests[safeInEmail];
        if (recoveryRequest.executeAfter > 0) {
            revert RecoveryAlreadyInitiated();
        }

        recoveryRequests[safeInEmail].approvalCount++;
        recoveryRequests[safeInEmail].pendingNewOwner = newOwnerInEmail;
        recoveryRequests[safeInEmail].oldOwner = ownerToSwapInEmail;

        uint256 threshold = getGuardianConfig(safeInEmail).threshold;
        if (recoveryRequests[safeInEmail].approvalCount >= threshold) {
            uint256 executeAfter = block.timestamp +
                recoveryDelays[safeInEmail];

            recoveryRequests[safeInEmail].executeAfter = executeAfter;

            emit RecoveryInitiated(safeInEmail, newOwnerInEmail, executeAfter);
        }
    }

    // TODO: add natspec to interface or inherit from EmailAccountRecovery
    function completeRecovery() public override {
        address safe = getAccountForRouter(msg.sender);

        RecoveryRequest memory recoveryRequest = recoveryRequests[safe];

        uint256 threshold = getGuardianConfig(safe).threshold;
        if (recoveryRequest.approvalCount < threshold)
            revert NotEnoughApprovals();

        if (block.timestamp < recoveryRequest.executeAfter) {
            revert DelayNotPassed();
        }

        delete recoveryRequests[safe];

        address previousOwnerInLinkedList = getPreviousOwnerInLinkedList(
            safe,
            recoveryRequest.oldOwner
        );

        bytes memory swapOwnerData = abi.encodeWithSignature(
            "swapOwner(address,address,address)",
            previousOwnerInLinkedList,
            recoveryRequest.oldOwner,
            recoveryRequest.pendingNewOwner
        );

        ISafe(safe).execTransactionFromModule(safe, 0, swapOwnerData, 0);

        emit OwnerRecovered(
            safe,
            recoveryRequest.oldOwner,
            recoveryRequest.pendingNewOwner
        );
    }

    /**
     * @notice Helper function that retrieves the owner that points to the owner to be
     * replaced in the Safe `owners` linked list. Based on the logic used to swap
     * owners in the safe core sdk.
     * @param safe the safe account to query
     * @param oldOwner the old owner to be swapped in the recovery attempt.
     */
    function getPreviousOwnerInLinkedList(
        address safe,
        address oldOwner
    ) internal view returns (address) {
        address[] memory owners = ISafe(safe).getOwners();

        uint256 oldOwnerIndex;
        for (uint256 i = 0; i < owners.length; i++) {
            if (owners[i] == oldOwner) {
                oldOwnerIndex = i;
                break;
            }
        }
        address sentinelOwner = address(0x1);
        return oldOwnerIndex == 0 ? sentinelOwner : owners[oldOwnerIndex - 1];
    }

    /// @inheritdoc ISafeZkEmailRecoveryPlugin
    function cancelRecovery() external {
        address safe = msg.sender;
        delete recoveryRequests[safe];
        emit RecoveryCancelled(safe);
    }

    /// @inheritdoc ISafeZkEmailRecoveryPlugin
    function updateRecoveryDelay(uint256 recoveryDelay) external {
        // TODO: add implementation
    }
}

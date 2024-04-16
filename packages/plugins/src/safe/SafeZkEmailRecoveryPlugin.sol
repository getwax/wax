// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {EmailAccountRecovery} from "ether-email-auth/packages/contracts/src/EmailAccountRecovery.sol";
import {GuardianManager} from "./GuardianManager.sol";
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
    ISafeZkEmailRecoveryPlugin,
    EmailAccountRecovery
{
    /** Mapping of safe address to recovery config */
    mapping(address => RecoveryConfig) public recoveryConfigs;

    /** Mapping of safe address to recovery request */
    mapping(address => RecoveryRequest) public recoveryRequests;

    /** Mapping of guardian address to guardian request */
    mapping(address => GuardianRequest) public guardianRequests;

    /** Mapping of email account recovery router contracts to safe details needed to complete recovery */
    mapping(address => SafeAccountInfo) public recoveryRouterToSafeInfo;

    /** Mapping of safe account addresses to email account recovery router contracts**/
    /** These are stored for frontends to easily find the router contract address from the given safe account address**/
    mapping(address => address) public safeAddrToRecoveryRouter;

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
    function getRecoveryConfig(
        address safe
    ) external view returns (RecoveryConfig memory) {
        return recoveryConfigs[safe];
    }

    /// @inheritdoc ISafeZkEmailRecoveryPlugin
    function getRecoveryRequest(
        address safe
    ) external view returns (RecoveryRequest memory) {
        return recoveryRequests[safe];
    }

    // /// @inheritdoc ISafeZkEmailRecoveryPlugin
    function getGuardianRequest(
        address safe
    ) external view returns (GuardianRequest memory) {
        return guardianRequests[safe];
    }

    // TODO: test
    /// @inheritdoc ISafeZkEmailRecoveryPlugin
    function getRouterForSafe(address safe) external view returns (address) {
        return safeAddrToRecoveryRouter[safe];
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
        address previousOwnerInLinkedList, // TODO: We should try fetch this automatically when needed. It is possible that owners are changed without going through the recovery plugin and this value could be outdated
        uint256 recoveryDelay,
        uint256 threshold
    ) external returns (address emailAccountRecoveryRouterAddress) {
        address safe = msg.sender;

        // Check this module is enabled on the calling Safe account
        bool moduleEnabled = ISafe(safe).isModuleEnabled(address(this));
        if (!moduleEnabled) revert ModuleNotFound();

        if (threshold < 1) revert InvalidThreshold();
        if (guardians.length < threshold) revert InvalidGuardianCount();

        setupGuardians(safe, guardians, threshold);

        // FIXME: Should be for safe not guardian
        if (recoveryRequests[guardians[0]].executeAfter > 0) {
            revert RecoveryAlreadyInitiated();
        }

        require(
            safeAddrToRecoveryRouter[safe] == address(0),
            "router contract for safe already exits"
        );

        EmailAccountRecoveryRouter emailAccountRecoveryRouter = new EmailAccountRecoveryRouter(
                address(this)
            );
        emailAccountRecoveryRouterAddress = address(emailAccountRecoveryRouter);

        require(
            recoveryRouterToSafeInfo[emailAccountRecoveryRouterAddress].safe ==
                address(0),
            "safe for the router contract already exits"
        );
        recoveryRouterToSafeInfo[
            emailAccountRecoveryRouterAddress
        ] = SafeAccountInfo(safe, previousOwnerInLinkedList);
        safeAddrToRecoveryRouter[safe] = emailAccountRecoveryRouterAddress;

        recoveryConfigs[safe] = RecoveryConfig({recoveryDelay: recoveryDelay});

        // FIXME: loop over properly
        guardianRequests[guardians[0]] = GuardianRequest({safe: safe});
        guardianRequests[guardians[1]] = GuardianRequest({safe: safe});

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
        require(guardian != address(0), "invalid guardian");
        // TODO extract to function or modifier?
        require(
            guardianRequests[guardian].safe != address(0),
            "guardian not requested"
        );
        require(templateIdx == 0, "invalid template index");
        require(subjectParams.length == 1, "invalid subject params");

        address safeInEmail = abi.decode(subjectParams[0], (address));
        address safeForRouter = recoveryRouterToSafeInfo[msg.sender].safe;
        require(safeForRouter == safeInEmail, "invalid account for router");
        require(
            guardianRequests[guardian].safe == safeInEmail,
            "invalid account in email"
        );

        bool acceptedRecovery = getRecoveryAcceptance(safeInEmail, guardian);
        require(!acceptedRecovery, "guardian has already accepted");

        changeRecoveryAcceptance(safeInEmail, guardian, true);
    }

    // TODO: add natspec to interface or inherit from EmailAccountRecovery
    function processRecovery(
        address guardian,
        uint templateIdx,
        bytes[] memory subjectParams,
        bytes32
    ) internal override {
        require(guardian != address(0), "invalid guardian");
        require(
            guardianRequests[guardian].safe != address(0),
            "guardian not requested"
        );
        require(templateIdx == 0, "invalid template index");
        require(subjectParams.length == 3, "invalid subject params");

        address ownerToSwapInEmail = abi.decode(subjectParams[0], (address));

        address newOwnerInEmail = abi.decode(subjectParams[1], (address));
        require(newOwnerInEmail != address(0), "invalid new owner in email");

        address safeInEmail = abi.decode(subjectParams[2], (address));
        address safeForRouter = recoveryRouterToSafeInfo[msg.sender].safe;
        require(safeForRouter == safeInEmail, "invalid account for router");
        require(
            guardianRequests[guardian].safe == safeInEmail,
            "invalid account in email"
        );

        bool acceptedRecovery = getRecoveryAcceptance(safeInEmail, guardian);
        require(acceptedRecovery, "guardian has not accepted");

        bool isExistingOwner = ISafe(safeInEmail).isOwner(newOwnerInEmail);
        if (isExistingOwner) revert InvalidNewOwner();

        RecoveryRequest memory recoveryRequest = recoveryRequests[safeInEmail];
        RecoveryConfig memory recoveryConfig = recoveryConfigs[safeInEmail];
        if (recoveryRequest.executeAfter > 0) {
            revert RecoveryAlreadyInitiated();
        }

        recoveryRequests[safeInEmail].approvalCount++;
        recoveryRequests[safeInEmail].pendingNewOwner = newOwnerInEmail;
        recoveryRequests[safeInEmail].ownerToSwap = ownerToSwapInEmail;

        uint256 threshold = getThreshold(safeInEmail);
        if (recoveryRequests[safeInEmail].approvalCount >= threshold) {
            uint256 executeAfter = block.timestamp +
                recoveryConfigs[safeInEmail].recoveryDelay;

            recoveryRequests[safeInEmail].executeAfter = executeAfter;

            emit RecoveryInitiated(safeInEmail, newOwnerInEmail, executeAfter);
        }
    }

    // TODO: add natspec to interface or inherit from EmailAccountRecovery
    function completeRecovery() public override {
        SafeAccountInfo memory safeAccountInfo = recoveryRouterToSafeInfo[
            msg.sender
        ];
        recoverPlugin(
            safeAccountInfo.safe,
            safeAccountInfo.previousOwnerInLinkedList
        );
    }

    /// @inheritdoc ISafeZkEmailRecoveryPlugin
    function recoverPlugin(address safe, address previousOwner) public {
        RecoveryRequest memory recoveryRequest = recoveryRequests[safe];

        uint256 threshold = getThreshold(safe);
        if (recoveryRequest.approvalCount < threshold)
            revert NotEnoughApprovals();

        if (block.timestamp >= recoveryRequest.executeAfter) {
            delete recoveryRequests[safe];

            bytes memory data = abi.encodeWithSignature(
                "swapOwner(address,address,address)",
                previousOwner,
                recoveryRequest.ownerToSwap,
                recoveryRequest.pendingNewOwner
            );

            ISafe(safe).execTransactionFromModule(safe, 0, data, 0);

            emit OwnerRecovered(
                safe,
                recoveryRequest.ownerToSwap,
                recoveryRequest.pendingNewOwner
            );

            // changeRecoveryAcceptance(safeInEmail, guardian, false); // FIXME: can't access guardians
        } else {
            revert DelayNotPassed();
        }
    }

    /// @inheritdoc ISafeZkEmailRecoveryPlugin
    function cancelRecovery() external {
        address safe = msg.sender;
        delete recoveryRequests[safe];
        emit RecoveryCancelled(safe);
    }

    /// @inheritdoc ISafeZkEmailRecoveryPlugin
    function updateRecoveryConfig(
        uint256 guardianCount,
        uint256 threshold,
        uint256 recoveryDelay
    ) external {
        // TODO: add implementation
    }

    /// @inheritdoc ISafeZkEmailRecoveryPlugin
    function updateGuardian() external {
        // TODO: add implementation
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {ISafe} from "./utils/Safe4337Base.sol";
import {EmailAccountRecoveryRouter} from "./EmailAccountRecoveryRouter.sol";
import {EmailAccountRecovery} from "ether-email-auth/packages/contracts/src/EmailAccountRecovery.sol";
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

struct RecoveryConfig {
    uint256 guardianCount; // the number of guardians configured for the specific recovery config
    uint256 threshold; // the number of approvals needed to execute a recovery request
    uint256 recoveryDelay; // the delay from the recovery request being initiated with enough appovals until it can be executed. Protects against malicious recovery attempts
}

struct RecoveryRequest {
    uint256 executeAfter; // the timestamp from which the recovery request can be executed
    address ownerToSwap; // the old owner that will be swapped out for pendingNewOwner
    address pendingNewOwner; // the pending new owner to be rotated
    uint256 approvalCount; // number of guardian approvals for the recovery request
}

struct GuardianRequest {
    address safe;
    bool accepted;
}

struct SafeAccountInfo {
    address safe;
    address previousOwnerInLinkedList;
}

/**
 * A safe plugin that recovers a safe owner via a zkp of an email.
 * NOT FOR PRODUCTION USE
 */
contract SafeZkEmailRecoveryPlugin is EmailAccountRecovery {
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

    /** Errors */
    error MODULE_NOT_ENABLED();
    error INVALID_OWNER(address owner);
    error INVALID_THRESHOLD();
    error INVALID_GUARDIAN_COUNT();
    error INVALID_NEW_OWNER();
    error RECOVERY_ALREADY_INITIATED();
    error RECOVERY_NOT_INITIATED();
    error DELAY_NOT_PASSED();

    /** Events */
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

    constructor(
        address _verifier,
        address _dkimRegistry,
        address _emailAuthImpl
    ) {
        verifierAddr = _verifier;
        dkimAddr = _dkimRegistry;
        emailAuthImplementationAddr = _emailAuthImpl;
    }

    /**
     * EmailAccountRecovery implementations
     */

    /**
     * @inheritdoc EmailAccountRecovery
     */
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

    /**
     * @inheritdoc EmailAccountRecovery
     */
    function recoverySubjectTemplates()
        public
        pure
        override
        returns (string[][] memory)
    {
        string[][] memory templates = new string[][](1);
        templates[0] = new string[](7);
        templates[0][0] = "Update";
        templates[0][1] = "owner";
        templates[0][2] = "to";
        templates[0][3] = "{ethAddr}";
        templates[0][4] = "on";
        templates[0][5] = "account";
        templates[0][6] = "{ethAddr}";
        return templates;
    }

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
        require(
            !guardianRequests[guardian].accepted,
            "guardian has already accepted"
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

        guardianRequests[guardian].accepted = true;
    }

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
        require(
            guardianRequests[guardian].accepted,
            "guardian has not accepted"
        );
        require(templateIdx == 0, "invalid template index");
        require(subjectParams.length == 2, "invalid subject params");

        address newOwnerInEmail = abi.decode(subjectParams[0], (address));
        require(newOwnerInEmail != address(0), "invalid new owner in email");

        address safeInEmail = abi.decode(subjectParams[1], (address));
        address safeForRouter = recoveryRouterToSafeInfo[msg.sender].safe;
        require(safeForRouter == safeInEmail, "invalid account for router");
        require(
            guardianRequests[guardian].safe == safeInEmail,
            "invalid account in email"
        );

        bool isExistingOwner = ISafe(safeInEmail).isOwner(newOwnerInEmail);
        if (isExistingOwner) revert INVALID_NEW_OWNER();

        RecoveryRequest memory recoveryRequest = recoveryRequests[safeInEmail];
        RecoveryConfig memory recoveryConfig = recoveryConfigs[safeInEmail];
        if (recoveryRequest.executeAfter > 0) {
            revert RECOVERY_ALREADY_INITIATED();
        }

        recoveryRequests[safeInEmail].approvalCount++;

        if (
            recoveryRequests[safeInEmail].approvalCount >=
            recoveryConfig.threshold
        ) {
            uint256 executeAfter = block.timestamp +
                recoveryConfigs[safeInEmail].recoveryDelay;

            recoveryRequests[safeInEmail].executeAfter = executeAfter;
            recoveryRequests[safeInEmail].pendingNewOwner = newOwnerInEmail;

            emit RecoveryInitiated(safeInEmail, newOwnerInEmail, executeAfter);
        }
    }

    function completeRecovery() public override {
        SafeAccountInfo memory safeAccountInfo = recoveryRouterToSafeInfo[
            msg.sender
        ];
        recoverPlugin(
            safeAccountInfo.safe,
            safeAccountInfo.previousOwnerInLinkedList
        );
    }

    /**
     * @notice Returns recovery config accociated with a safe address
     * @param safe address to query storage with
     */
    function getRecoveryConfig(
        address safe
    ) external view returns (RecoveryConfig memory) {
        return recoveryConfigs[safe];
    }

    /**
     * @notice Returns recovery request accociated with a safe address
     * @param safe address to query storage with
     */
    function getRecoveryRequest(
        address safe
    ) external view returns (RecoveryRequest memory) {
        return recoveryRequests[safe];
    }

    /**
     * @notice Returns guardian request accociated with a safe address
     * @param safe address to query storage with
     */
    function getGuardianRequest(
        address safe
    ) external view returns (GuardianRequest memory) {
        return guardianRequests[safe];
    }

    // TODO test
    /**
     * @notice Returns the recovery router address that corresponds to the specified Safe account
     * @param safe address to query storage with
     */
    function getRouterForSafe(address safe) external view returns (address) {
        return safeAddrToRecoveryRouter[safe];
    }

    /**
     * @notice Stores a recovery hash that can be used to recover a safe owner
     *         at a later stage.
     * @dev dkimRegistry can be a zero address if the user wants to use the
     *      defaultDkimRegistry. customDelay can be 0 if the user wants to use defaultDelay
     *      This function assumes it is being called from a safe - see how msg.sender
     *      is interpreted. This is the first function that must be called when setting up recovery.
     * @param owner Owner on the safe being recovered
     * @param guardian The EmailAuth guardian address that has permissions to recover an owner on the account
     * @param recoveryDelay A custom delay for recovery that is associated with a safe.
     * @param previousOwnerInLinkedList The previous owner stored in the Safe owners linked list.
     * This is needed to rotate the owner at the end of the recovery flow
     */
    function configureRecovery(
        address owner,
        address guardian,
        address previousOwnerInLinkedList, // TODO: We should try fetch this automatically when needed. It is possible that owners are changed without going through the recovery plugin and this value could be outdated
        uint256 recoveryDelay,
        uint256 guardianCount,
        uint256 threshold
    ) external returns (address emailAccountRecoveryRouterAddress) {
        address safe = msg.sender;
        bool moduleEnabled = ISafe(safe).isModuleEnabled(address(this));
        if (!moduleEnabled) revert MODULE_NOT_ENABLED();

        require(
            guardianRequests[guardian].safe == address(0),
            "guardian already requested"
        );

        bool isOwner = ISafe(safe).isOwner(owner);
        if (!isOwner) revert INVALID_OWNER(owner);

        if (recoveryRequests[guardian].executeAfter > 0) {
            revert RECOVERY_ALREADY_INITIATED();
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

        if (threshold < 1) revert INVALID_THRESHOLD();
        if (guardianCount < threshold) revert INVALID_GUARDIAN_COUNT();

        recoveryConfigs[safe] = RecoveryConfig({
            guardianCount: guardianCount,
            threshold: threshold,
            recoveryDelay: recoveryDelay
        });

        recoveryRequests[safe] = RecoveryRequest({
            executeAfter: 0,
            ownerToSwap: owner,
            pendingNewOwner: address(0),
            approvalCount: 0
        });

        guardianRequests[guardian] = GuardianRequest({
            safe: safe,
            accepted: false
        });

        emit RecoveryConfigured(safe, owner, recoveryDelay);
    }

    /**
     * @notice Recovers a safe owner using a zk email proof.
     * @dev Rotates the safe owner address to a new address.
     *      This function is designed so it can be called from any account and account type.
     *      This function is the third and final function that needs to be called in the
     *      recovery process. After configureRecovery & initiateRecovery
     * @param safe The safe for the owner being rotated
     * @param previousOwner The previous owner in the safe owners linked list // TODO: (merge-ok) retrieve this automatically
     */
    function recoverPlugin(address safe, address previousOwner) public {
        RecoveryRequest memory recoveryRequest = recoveryRequests[safe];

        if (recoveryRequest.ownerToSwap == address(0)) {
            revert RECOVERY_NOT_INITIATED();
        }

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
        } else {
            revert DELAY_NOT_PASSED();
        }
    }

    /**
     * @notice Cancels the recovery process of the sender if it exits.
     * @dev Deletes the recovery request accociated with a safe. Assumes
     *      the msg.sender is the safe that the recovery request is being deleted for
     */
    function cancelRecovery() external {
        address safe = msg.sender;
        delete recoveryRequests[safe];
        emit RecoveryCancelled(safe);
    }

    function updateRecoveryConfig(
        uint256 guardianCount,
        uint256 threshold,
        uint256 recoveryDelay
    ) external {}

    function updateGuardian() external {}
}

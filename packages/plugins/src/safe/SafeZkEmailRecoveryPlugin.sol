// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {ISafe} from "./utils/Safe4337Base.sol";
import {EmailAccountRecovery} from "ether-email-auth/packages/contracts/src/EmailAccountRecovery.sol"; // TODO: use this import once ethers-email-auth has been updated
// import {EmailAccountRecovery} from "./temp-ethers-email-auth-dependencies/EmailAccountRecovery.sol";

/*//////////////////////////////////////////////////////////////////////////
    THIS CONTRACT IS STILL IN ACTIVE DEVELOPMENT. NOT FOR PRODUCTION USE        
//////////////////////////////////////////////////////////////////////////*/

struct RecoveryRequest {
    address guardian;
    uint256 executeAfter;
    address ownerToSwap;
    address pendingNewOwner;
    uint256 delay;
}

struct GuardianRequest {
    address safe;
    bool accepted;
}

/**
 * A safe plugin that recovers a safe owner via a zkp of an email.
 * NOT FOR PRODUCTION USE
 */
contract SafeZkEmailRecoveryPlugin is EmailAccountRecovery {
    /** Default delay has been set to a large timeframe on purpose. Please use a default delay suited to your specific context */
    uint256 public constant defaultDelay = 2 weeks;

    bytes32 immutable RECOVERY_HASH_DOMAIN;

    /** Mapping of safe address to recovery request */
    mapping(address => RecoveryRequest) public recoveryRequests;
    /** Mapping of guardian address to guardian request */
    mapping(address => GuardianRequest) public guardianRequests;

    /** Mapping of safe address to dkim registry address */
    // TODO How can we use a custom DKIM reigstry/key with email auth?
    // mapping(address => address) public dkimRegistryOfSafe;

    error MODULE_NOT_ENABLED();
    error INVALID_OWNER(address owner);
    error INVALID_NEW_OWNER();
    error RECOVERY_ALREADY_INITIATED();
    error RECOVERY_NOT_CONFIGURED();
    error RECOVERY_NOT_INITIATED();
    error DELAY_NOT_PASSED();

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

    constructor(
        address _verifier,
        address _dkimRegistry,
        address _emailAuthImpl
    ) {
        verifierAddr = _verifier;
        dkimAddr = _dkimRegistry;
        emailAuthImplementationAddr = _emailAuthImpl;

        // TODO May no longer be necesary
        RECOVERY_HASH_DOMAIN = keccak256(
            abi.encode(
                keccak256(
                    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                ),
                keccak256("SafeZKEmailRecoveryPlugin"),
                keccak256("1"),
                block.chainid,
                address(this)
            )
        );
    }

    /**
     * EmailAccountRecovery implementations
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
        require(templateIdx == 0, "invalid template index");
        require(subjectParams.length == 1, "invalid subject params");

        address safeInEmail = abi.decode(subjectParams[0], (address));
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
        require(
            guardianRequests[guardian].safe == safeInEmail,
            "invalid account in email"
        );

        bool isExistingOwner = ISafe(safeInEmail).isOwner(newOwnerInEmail);
        if (isExistingOwner) revert INVALID_NEW_OWNER();

        RecoveryRequest memory recoveryRequest = recoveryRequests[safeInEmail];
        if (recoveryRequest.executeAfter > 0) {
            revert RECOVERY_ALREADY_INITIATED();
        }

        uint256 executeAfter = block.timestamp +
            recoveryRequests[safeInEmail].delay;

        recoveryRequests[safeInEmail].executeAfter = executeAfter;
        recoveryRequests[safeInEmail].pendingNewOwner = newOwnerInEmail;

        emit RecoveryInitiated(safeInEmail, newOwnerInEmail, executeAfter);
    }

    function completeRecovery() public override {
        // TODO see if this is needed
        revert("use recoverPlugin");
    }

    /**
     * Plugin
     */

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
     * @notice Stores a recovery hash that can be used to recover a safe owner
     *         at a later stage.
     * @dev dkimRegistry can be a zero address if the user wants to use the
     *      defaultDkimRegistry. customDelay can be 0 if the user wants to use defaultDelay
     *      This function assumes it is being called from a safe - see how msg.sender
     *      is interpreted. This is the first function that must be called when setting up recovery.
     * @param owner Owner on the safe being recovered
     * @param guardian TODO
     * @param customDelay A custom delay to set the recoveryDelay value that is associated with a safe.
     */
    function configureRecovery(
        address owner,
        address guardian,
        uint256 customDelay
    ) external {
        address safe = msg.sender;

        bool moduleEnabled = ISafe(safe).isModuleEnabled(address(this));
        if (!moduleEnabled) revert MODULE_NOT_ENABLED();

        bool isOwner = ISafe(safe).isOwner(owner);
        if (!isOwner) revert INVALID_OWNER(owner);

        if (recoveryRequests[guardian].executeAfter > 0) {
            revert RECOVERY_ALREADY_INITIATED();
        }

        uint256 delay = defaultDelay;
        if (customDelay > 0) {
            delay = customDelay;
        }

        recoveryRequests[safe] = RecoveryRequest({
            guardian: guardian,
            executeAfter: 0,
            ownerToSwap: owner,
            pendingNewOwner: address(0),
            delay: delay
        });

        guardianRequests[guardian] = GuardianRequest({
            safe: safe,
            accepted: false
        });

        emit RecoveryConfigured(safe, owner, delay);
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
    function recoverPlugin(address safe, address previousOwner) external {
        RecoveryRequest memory recoveryRequest = recoveryRequests[safe];

        if (recoveryRequest.executeAfter == 0) {
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

    /**
     * @notice Sets a custom delay for recovering an owner for a specific safe.
     * @dev Custom delay is used instead of the default delay when recovering an
     *      owner. Custom delays should be configured with care as they can be
     *      used to bypass the default delay.
     * @param delay The custom delay to be used when recovering an owner on the safe
     */
    function setRecoveryDelay(uint256 delay) external {
        address safe = msg.sender;
        recoveryRequests[safe].delay = delay;
        emit RecoveryDelaySet(safe, delay);
    }
}

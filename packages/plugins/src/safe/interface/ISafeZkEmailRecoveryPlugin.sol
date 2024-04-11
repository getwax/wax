// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ISafeZkEmailRecoveryPlugin {
    struct RecoveryConfig {
        uint256 guardianCount; // the number of guardians configured for the specific recovery config
        uint256 threshold; // the number of approvals needed to execute a recovery request
        uint256 recoveryDelay; // the delay from the recovery request being initiated with enough appovals until it can be executed. Protects against malicious recovery attempts
        address ownerToSwap; // the old owner that will be swapped out for pendingNewOwner
    }

    struct RecoveryRequest {
        uint256 executeAfter; // the timestamp from which the recovery request can be executed
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

    /** Errors */

    /**
     * TODO:
     */
    error ModuleNotFound();

    /**
     * TODO:
     */
    error InvalidOwner(address owner);

    /**
     * TODO:
     */
    error InvalidThreshold();

    /**
     * TODO:
     */
    error InvalidGuardianCount();

    /**
     * TODO:
     */
    error InvalidNewOwner();

    /**
     * TODO:
     */
    error RecoveryAlreadyInitiated();

    /**
     * TODO:
     */
    error RecoveryNotInitiated();

    /**
     * TODO:
     */
    error DelayNotPassed();

    /** Events */

    /**
     * TODO:
     */
    event RecoveryConfigured(
        address indexed safe,
        address indexed owner,
        uint256 customDelay
    );

    /**
     * TODO:
     */
    event RecoveryInitiated(
        address indexed safe,
        address newOwner,
        uint256 executeAfter
    );

    /**
     * TODO:
     */
    event OwnerRecovered(
        address indexed safe,
        address oldOwner,
        address newOwner
    );

    /**
     * TODO:
     */
    event RecoveryCancelled(address indexed safe);

    /** Functions */

    /**
     * @notice Returns recovery config accociated with a safe address
     * @param safe address to query storage with
     */
    function getRecoveryConfig(
        address safe
    ) external view returns (RecoveryConfig memory);

    /**
     * @notice Returns recovery request accociated with a safe address
     * @param safe address to query storage with
     */
    function getRecoveryRequest(
        address safe
    ) external view returns (RecoveryRequest memory);

    /**
     * @notice Returns guardian request accociated with a safe address
     * @param safe address to query storage with
     */
    function getGuardianRequest(
        address safe
    ) external view returns (GuardianRequest memory);

    /**
     * @notice Returns the recovery router address that corresponds to the specified Safe account
     * @param safe address to query storage with
     */
    function getRouterForSafe(address safe) external view returns (address);

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
        address previousOwnerInLinkedList,
        uint256 recoveryDelay,
        uint256 guardianCount,
        uint256 threshold
    ) external returns (address emailAccountRecoveryRouterAddress);

    /**
     * @notice Recovers a safe owner using a zk email proof.
     * @dev Rotates the safe owner address to a new address.
     *      This function is designed so it can be called from any account and account type.
     *      This function is the third and final function that needs to be called in the
     *      recovery process. After configureRecovery & initiateRecovery
     * @param safe The safe for the owner being rotated
     * @param previousOwner The previous owner in the safe owners linked list // TODO: (merge-ok) retrieve this automatically
     */
    function recoverPlugin(address safe, address previousOwner) external;

    /**
     * @notice Cancels the recovery process of the sender if it exits.
     * @dev Deletes the recovery request accociated with a safe. Assumes
     *      the msg.sender is the safe that the recovery request is being deleted for
     */
    function cancelRecovery() external;

    // TODO: add natspec
    function updateRecoveryConfig(
        uint256 guardianCount,
        uint256 threshold,
        uint256 recoveryDelay
    ) external;

    // TODO: add natspec
    function updateGuardian() external;
}

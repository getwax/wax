// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ISafeZkEmailRecoveryPlugin {
    struct RecoveryRequest {
        uint256 executeAfter; // the timestamp from which the recovery request can be executed
        address pendingNewOwner; // the pending new owner to be rotated
        uint256 approvalCount; // number of guardian approvals for the recovery request
        address oldOwner; // the old owner that will be swapped out for pendingNewOwner
    }

    /** Errors */

    /** TODO: */
    error ModuleNotEnabled();

    /** TODO: */
    error InvalidOwner(address owner);

    /** TODO: */
    error InvalidGuardian();

    /** TODO: */
    error InvalidTemplateIndex();

    /** TODO: */
    error InvalidSubjectParams();

    /** TODO: */
    error InvalidNewOwner();

    /** TODO: */
    error InvalidAccountForRouter();

    /** TODO: */
    error GuardianInvalidForSafeInEmail();

    /** TODO: */
    error GuardianAlreadyAccepted();

    /** TODO: */
    error GuardianHasNotAccepted();

    /** TODO: */
    error RecoveryAlreadyInitiated();

    /** TODO: */
    error RecoveryNotInitiated();

    /** TODO: */
    error NotEnoughApprovals();

    /** TODO: */
    error DelayNotPassed();

    /** Events */

    /** TODO: */
    event RecoveryConfigured(
        address indexed safe,
        uint256 guardianCount,
        uint256 threshold,
        uint256 recoveryDelay
    );

    /** TODO: */
    event RecoveryInitiated(
        address indexed safe,
        address newOwner,
        uint256 executeAfter
    );

    /** TODO: */
    event OwnerRecovered(
        address indexed safe,
        address oldOwner,
        address newOwner
    );

    /** TODO: */
    event RecoveryCancelled(address indexed safe);

    /** Functions */

    /**
     * @notice Returns recovery request accociated with a safe address
     * @param safe address to query storage with
     */
    function getRecoveryRequest(
        address safe
    ) external view returns (RecoveryRequest memory);

    /**
     * @notice Returns the recovery delay that corresponds to the specified Safe account
     * @param safe address to query storage with
     */
    function getRecoveryDelay(address safe) external view returns (uint256);

    /**
     * @notice Stores a recovery hash that can be used to recover a safe owner
     *         at a later stage.
     * @dev dkimRegistry can be a zero address if the user wants to use the
     *      defaultDkimRegistry. customDelay can be 0 if the user wants to use defaultDelay
     *      This function assumes it is being called from a safe - see how msg.sender
     *      is interpreted. This is the first function that must be called when setting up recovery.
     * @param guardians The EmailAuth guardian address that has permissions to recover an owner on the account
     * @param recoveryDelay A custom delay for recovery that is associated with a safe.
     * This is needed to rotate the owner at the end of the recovery flow
     */
    function configureRecovery(
        address[] memory guardians,
        uint256 recoveryDelay,
        uint256 threshold
    ) external returns (address emailAccountRecoveryRouterAddress);

    /**
     * @notice Cancels the recovery process of the sender if it exits.
     * @dev Deletes the recovery request accociated with a safe. Assumes
     *      the msg.sender is the safe that the recovery request is being deleted for
     */
    function cancelRecovery() external;

    // TODO: add natspec
    function updateRecoveryDelay(uint256 recoveryDelay) external;
}

// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.0;

/**
 * @title IGuardianManager - Interface for contract which manages Safe zk email recovery plugin guardians and a threshold to authorize recovery attempts.
 */
interface IGuardianManager {
    struct GuardianStorage {
        address guardian;
        bool accepted;
    }

    event AddedGuardian(address indexed guardian);
    event RemovedGuardian(address indexed guardian);
    event ChangedThreshold(uint256 threshold);

    /**
     * @notice Adds the guardian `guardian` to the Safe and updates the threshold to `_threshold`.
     * @dev TODO: comment on access control
     * @param guardian New guardian address.
     * @param _threshold New threshold.
     * @param safe The Safe account that the guardians should recover.
     */
    function addGuardianWithThreshold(
        address guardian,
        uint256 _threshold,
        address safe
    ) external;

    /**
     * @notice Removes the guardian `guardian` from the Safe and updates the threshold to `_threshold`.
     * @dev TODO: comment on access control
     * @param prevGuardian Guardian that pointed to the guardian to be removed in the linked list
     * @param guardian Guardian address to be removed.
     * @param _threshold New threshold.
     * @param safe The Safe account that the guardians should recover.
     */
    function removeGuardian(
        address prevGuardian,
        address guardian,
        uint256 _threshold,
        address safe
    ) external;

    /**
     * @notice Replaces the guardian `oldGuardian` in the Safe with `newGuardian`.
     * @dev TODO: comment on access control
     * @param prevGuardian Guardian that pointed to the guardian to be replaced in the linked list
     * @param oldGuardian Guardian address to be replaced.
     * @param newGuardian New guardian address.
     * @param safe The Safe account that the guardians should recover.
     */
    function swapGuardian(
        address prevGuardian,
        address oldGuardian,
        address newGuardian,
        address safe
    ) external;

    /**
     * @notice Changes the threshold of the Safe to `_threshold`.
     * @dev TODO: comment on access control
     * @param _threshold New threshold.
     * @param safe The Safe account that the guardians should recover.
     */
    function changeThreshold(uint256 _threshold, address safe) external;

    /**
     * @notice Returns the number of required confirmations for a Safe transaction aka the threshold.
     * @param safe The Safe account that the guardians should recover.
     * @return Threshold number.
     */
    function getThreshold(address safe) external view returns (uint256);

    /**
     * @notice Returns if `guardian` is an guardian of the Safe.
     * @param guardian The guardian address that is being checked.
     * @param safe The Safe account that the guardians should recover.
     * @return Boolean if guardian is an guardian of the Safe.
     */
    function isGuardian(
        address guardian,
        address safe
    ) external view returns (bool);

    /**
     * @notice Returns a list of Safe guardians.
     * @param safe The Safe account that the guardians should recover.
     * @return Array of Safe guardians.
     */
    function getGuardians(
        address safe
    ) external view returns (address[] memory);
}

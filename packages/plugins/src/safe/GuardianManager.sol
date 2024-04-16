// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.0;
import {IGuardianManager} from "./interface/IGuardianManager.sol";

/**
 * @title GuardianManager - Manages Safe zk email recovery plugin guardians and a threshold to authorize recovery attempts.
 * @dev Uses a linked list to store the guardians because the code generate by the solidity compiler
 *      is more efficient than using a dynamic array.
 */
abstract contract GuardianManager is IGuardianManager {
    address internal constant SENTINEL_OWNERS = address(0x1);

    /** Safe to guardian to guardian */
    mapping(address => mapping(address => address)) internal guardians;
    /** Safe to guardian to recovery acceptance */
    mapping(address => mapping(address => bool)) internal acceptedRecovery;
    /** Safe to guardian count */
    mapping(address => uint256) internal guardianCount;
    /** Safe to threshold */
    mapping(address => uint256) internal threshold; // the number of approvals needed to execute a recovery request

    /**
     * @notice Sets the initial storage of the contract.
     * @param safe The Safe account.
     * @param _guardians List of Safe guardians.
     * @param _threshold Number of required confirmations for a Safe transaction.
     */
    function setupGuardians(
        address safe,
        address[] memory _guardians,
        uint256 _threshold
    ) internal {
        // Initializing Safe guardians.
        address currentGuardian = SENTINEL_OWNERS;
        for (uint256 i = 0; i < _guardians.length; i++) {
            // Guardian address cannot be null.
            address guardian = _guardians[i];
            if (
                guardian == address(0) ||
                guardian == SENTINEL_OWNERS ||
                guardian == address(this) ||
                currentGuardian == guardian
            ) revert("Invalid guardian address provided");
            // No duplicate guardians allowed.
            if (guardians[safe][guardian] != address(0))
                revert("Address is already an guardian");

            require(
                acceptedRecovery[safe][guardian] == false,
                "guardian already requested"
            );

            guardians[safe][currentGuardian] = guardian;
            currentGuardian = guardian;
        }
        guardians[safe][currentGuardian] = SENTINEL_OWNERS;
        guardianCount[safe] = _guardians.length;
        threshold[safe] = _threshold;
    }

    // @inheritdoc IGuardianManager
    // FIXME: replace authorized modifier with proper access control
    function addGuardianWithThreshold(
        address guardian,
        uint256 _threshold,
        address safe
    ) public override {
        // Guardian address cannot be null, the sentinel or the Safe itself.
        if (
            guardian == address(0) ||
            guardian == SENTINEL_OWNERS ||
            guardian == address(this)
        ) revert("Invalid guardian address provided");
        // No duplicate guardians allowed.
        if (guardians[safe][guardian] != address(0))
            revert("Address is already an guardian");
        guardians[safe][guardian] = guardians[safe][SENTINEL_OWNERS];
        guardians[safe][SENTINEL_OWNERS] = guardian;
        guardianCount[safe]++;
        emit AddedGuardian(guardian);
        // Change threshold if threshold was changed.
        if (threshold[safe] != _threshold) changeThreshold(_threshold, safe);
    }

    // @inheritdoc IGuardianManager
    // FIXME: replace authorized modifier with proper access control
    function removeGuardian(
        address prevGuardian,
        address guardian,
        uint256 _threshold,
        address safe
    ) public override {
        // Only allow to remove an guardian, if threshold can still be reached.
        if (guardianCount[safe] - 1 < _threshold)
            revert("Threshold cannot exceed guardian count");
        // Validate guardian address and check that it corresponds to guardian index.
        if (guardian == address(0) || guardian == SENTINEL_OWNERS)
            revert("Invalid guardian address provided");
        if (guardians[safe][prevGuardian] != guardian)
            revert("Invalid prevGuardian, guardian pair provided");
        guardians[safe][prevGuardian] = guardians[safe][guardian];
        guardians[safe][guardian] = address(0);
        guardianCount[safe]--;
        emit RemovedGuardian(guardian);
        // Change threshold if threshold was changed.
        if (threshold[safe] != _threshold) changeThreshold(_threshold, safe);
    }

    // @inheritdoc IGuardianManager
    // FIXME: replace authorized modifier with proper access control
    function swapGuardian(
        address prevGuardian,
        address oldGuardian,
        address newGuardian,
        address safe
    ) public override {
        // Guardian address cannot be null, the sentinel or the Safe itself.
        if (
            newGuardian == address(0) ||
            newGuardian == SENTINEL_OWNERS ||
            newGuardian == address(this)
        ) revert("Invalid guardian address provided");
        // No duplicate guardians allowed.
        if (guardians[safe][newGuardian] != address(0))
            revert("Address is already an guardian");
        // Validate oldGuardian address and check that it corresponds to guardian index.
        if (oldGuardian == address(0) || oldGuardian == SENTINEL_OWNERS)
            revert("Invalid guardian address provided");
        if (guardians[safe][prevGuardian] != oldGuardian)
            revert("Invalid prevGuardian, guardian pair provided");
        guardians[safe][newGuardian] = guardians[safe][oldGuardian];
        guardians[safe][prevGuardian] = newGuardian;
        guardians[safe][oldGuardian] = address(0);
        emit RemovedGuardian(oldGuardian);
        emit AddedGuardian(newGuardian);
    }

    // @inheritdoc IGuardianManager
    // FIXME: replace authorized modifier with proper access control
    function changeThreshold(uint256 _threshold, address safe) public override {
        // Validate that threshold is smaller than number of guardians.
        if (_threshold > guardianCount[safe])
            revert("Threshold cannot exceed guardian count");
        // There has to be at least one Safe guardian.
        if (_threshold == 0) revert("Threshold needs to be greater than 0");
        threshold[safe] = _threshold;
        emit ChangedThreshold(threshold[safe]);
    }

    // @inheritdoc IGuardianManager
    function getThreshold(address safe) public view override returns (uint256) {
        return threshold[safe];
    }

    // TODO: natspec
    // FIXME: replace authorized modifier with proper access control
    function changeRecoveryAcceptance(
        address safe,
        address guardian,
        bool accepted
    ) public {
        acceptedRecovery[safe][guardian] = accepted;
        // emit ChangedThreshold(threshold[safe]);
    }

    // TODO: natspec
    function getRecoveryAcceptance(
        address safe,
        address guardian
    ) public view returns (bool) {
        return acceptedRecovery[safe][guardian];
    }

    // @inheritdoc IGuardianManager
    function isGuardian(
        address guardian,
        address safe
    ) public view override returns (bool) {
        return
            !(guardian == SENTINEL_OWNERS ||
                guardians[safe][guardian] == address(0));
    }

    // @inheritdoc IGuardianManager
    function getGuardians(
        address safe
    ) public view override returns (address[] memory) {
        address[] memory array = new address[](guardianCount[safe]);

        // populate return array
        uint256 index = 0;
        address currentGuardian = guardians[safe][SENTINEL_OWNERS];
        while (currentGuardian != SENTINEL_OWNERS) {
            array[index] = currentGuardian;
            currentGuardian = guardians[safe][currentGuardian];
            index++;
        }
        return array;
    }
}

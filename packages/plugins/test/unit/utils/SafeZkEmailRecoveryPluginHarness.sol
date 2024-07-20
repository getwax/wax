// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import {SafeZkEmailRecoveryPlugin} from "../../../src/safe/recovery/SafeZkEmailRecoveryPlugin.sol";

/** Helper contract to expose internal functions for testing */
contract SafeZkEmailRecoveryPluginHarness is SafeZkEmailRecoveryPlugin {
    constructor(
        address _verifier,
        address _dkimRegistry,
        address _emailAuthImpl
    ) SafeZkEmailRecoveryPlugin(_verifier, _dkimRegistry, _emailAuthImpl) {}

    function exposedAcceptGuardian(
        address guardian,
        uint templateIdx,
        bytes[] memory subjectParams,
        bytes32 emailNullifier
    ) external {
        acceptGuardian(guardian, templateIdx, subjectParams, emailNullifier);
    }

    function exposedProcessRecovery(
        address guardian,
        uint templateIdx,
        bytes[] memory subjectParams,
        bytes32 emailNullifier
    ) external {
        processRecovery(guardian, templateIdx, subjectParams, emailNullifier);
    }
}

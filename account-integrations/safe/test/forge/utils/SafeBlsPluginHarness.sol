// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import {UserOperation} from "account-abstraction/contracts/interfaces/IEntryPoint.sol";
import {SafeBlsPlugin} from "../../../src/SafeBlsPlugin.sol";

/** Helper contract to expose internal functions for testing */
contract SafeBlsPluginHarness is SafeBlsPlugin {
    constructor(
        address entryPointAddress,
        uint256[4] memory blsPublicKey
    ) SafeBlsPlugin(entryPointAddress, blsPublicKey) {}

    function exposed_validateNonce(uint256 nonce) external view {
        _validateNonce(nonce);
    }
}

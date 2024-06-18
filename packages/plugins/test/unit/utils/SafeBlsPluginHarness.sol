// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import {SafeBlsPlugin} from "../../../src/safe/SafeBlsPlugin.sol";

/** Helper contract to expose internal functions for testing */
contract SafeBlsPluginHarness is SafeBlsPlugin {
    constructor(
        address entryPointAddress,
        address aggregatorAddress,
        uint256[4] memory blsPublicKey
    ) SafeBlsPlugin(entryPointAddress, aggregatorAddress, blsPublicKey) {}

    function exposed_validateNonce(uint256 nonce) external view {
        _validateNonce(nonce);
    }
}

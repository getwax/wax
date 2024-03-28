// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import {SafeECDSAPlugin} from "../../../src/safe/SafeECDSAPlugin.sol";

/** Helper contract to expose internal functions for testing */
contract SafeECDSAPluginHarness is SafeECDSAPlugin {
    constructor(address entryPointAddress) SafeECDSAPlugin(entryPointAddress) {}

    function exposedValidateNonce(uint256 nonce) external pure {
        _validateNonce(nonce);
    }
}

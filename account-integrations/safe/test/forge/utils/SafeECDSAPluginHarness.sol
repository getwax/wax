// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import {UserOperation} from "account-abstraction/contracts/interfaces/IEntryPoint.sol";
import {SafeECDSAPlugin} from "../../../src/SafeECDSAPlugin.sol";

/** Helper contract to expose internal functions for testing */
contract SafeECDSAPluginHarness is SafeECDSAPlugin {
    constructor(
        address entryPointAddress,
        address ownerAddress
    ) SafeECDSAPlugin(entryPointAddress, ownerAddress) {}

    function exposed_validateNonce(uint256 nonce) external view {
        _validateNonce(nonce);
    }
}

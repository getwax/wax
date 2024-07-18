// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import {PackedUserOperation} from "account-abstraction/interfaces/IEntryPoint.sol";
import {SafeWebAuthnPlugin} from "../../../src/safe/validators/SafeWebAuthnPlugin.sol";

/** Helper contract to expose internal functions for testing */
contract SafeWebAuthnPluginHarness is SafeWebAuthnPlugin {
    constructor(
        address entryPointAddress,
        uint256[2] memory pubKey
    ) SafeWebAuthnPlugin(entryPointAddress, pubKey) {}

    function exposed_validateSignature(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash
    ) external returns (uint256) {
        return _validateSignature(userOp, userOpHash);
    }

    function exposed_validateNonce(uint256 nonce) external view {
        _validateNonce(nonce);
    }
}

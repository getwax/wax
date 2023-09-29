// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import {WebAuthn} from "../../src/WebAuthn.sol";

/** Helper contract to expose internal functions for testing */
contract WebAuthnHarness is WebAuthn {
    constructor() WebAuthn() {}

    function exposed_verifySignature(
        bytes calldata authenticatorData,
        bytes1 authenticatorDataFlagMask,
        bytes calldata clientData,
        bytes32 clientChallenge,
        uint256 clientChallengeDataOffset,
        uint256[2] calldata signature,
        uint256[2] calldata publicKey
    ) external returns (bool) {
        return verifySignature(
            authenticatorData,
            authenticatorDataFlagMask,
            clientData,
            clientChallenge,
            clientChallengeDataOffset,
            signature,
            publicKey
        );
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import {FCL_WebAuthn} from "./libraries/FCL_Webauthn.sol";

contract WebAuthn {
    function verifySignature(
        bytes calldata authenticatorData,
        bytes1 authenticatorDataFlagMask,
        bytes calldata clientData,
        bytes32 clientChallenge,
        uint256 clientChallengeDataOffset,
        uint256[2] calldata signature,
        uint256[2] calldata publicKey
    ) internal returns (bool verified) {
        verified =
            FCL_WebAuthn.checkSignature(
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

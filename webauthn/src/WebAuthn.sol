// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {FCL_WebAuthn} from "./lib/FCL_WebAuthn.sol";

contract Webauthn {
    function verifySignature(
        bytes calldata authenticatorData,
        bytes1 authenticatorDataFlagMask,
        bytes calldata clientData,
        bytes32 messageHash,
        uint256 clientChallengeDataOffset,
        uint256[2] calldata signature,
        uint256[2] calldata publicKey
    ) external returns (bool) {
        return
            FCL_WebAuthn.checkSignature(
                authenticatorData,
                authenticatorDataFlagMask,
                clientData,
                messageHash,
                clientChallengeDataOffset,
                signature,
                publicKey
            );
    }
}

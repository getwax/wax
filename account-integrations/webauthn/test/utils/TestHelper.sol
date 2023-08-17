// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "forge-std/Test.sol";
import {Webauthn} from "../../src/Webauthn.sol";

abstract contract TestHelper is Test {
    Webauthn public webauthn;

    function getPublicKeyAndSignature()
        internal
        pure
        returns (
            bytes memory authenticatorData,
            bytes1 authenticatorDataFlagMask,
            bytes memory clientData,
            bytes32 messageHash,
            uint256 clientChallengeDataOffset,
            uint256[2] memory signature,
            uint256[2] memory publicKey
        )
    {
        authenticatorData = hex"1584482fdf7a4d0b7eb9d45cf835288cb59e55b8249fff356e33be88ecc546d11d00000000";
        authenticatorDataFlagMask = 0x01;
        clientData = hex"7b2274797065223a22776562617574686e2e676574222c226368616c6c656e6765223a22efbfbd22efbfbd5f21efbfbd1b113e63efbfbdefbfbd6defbfbd4fefbfbdefbfbd11efbfbd11efbfbd40efbfbdefbfbdefbfbd64efbfbdefbfbd3cefbfbd58222c226f726967696e223a2268747470733a2f2f646576656c6f706d656e742e666f72756d64616f732e636f6d227d";
        messageHash = keccak256("test");
        clientChallengeDataOffset = 36;
        signature = [
            36788204816852931931532076736929768488646494203674172515272861180041446565109,
            60595451626159535380360537025565143491223093262105891867977188941268073626113
        ];
        publicKey = [
            84983235508986227069118519878575107221347312419117152995971180204793547896817,
            65342283463016373417889909198331793507107976344099657471582098851386861908802
        ];
    }
}

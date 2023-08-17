// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "forge-std/Test.sol";
import {Webauthn} from "../src/Webauthn.sol";

/* solhint-disable func-name-mixedcase */
/* solhint-disable private-vars-leading-underscore */
/* solhint-disable var-name-mixedcase */
/* solhint-disable func-param-name-mixedcase */

contract WebauthnTest is Test {
    Webauthn webauthn = new Webauthn{salt: 0}();

    function test_verifySignature_ValidSignature() public {
        // Arrange
        bytes
            memory authenticatorData = hex"1584482fdf7a4d0b7eb9d45cf835288cb59e55b8249fff356e33be88ecc546d11d00000000";
        bytes1 authenticatorDataFlagMask = 0x01;
        bytes
            memory clientData = hex"7b2274797065223a22776562617574686e2e676574222c226368616c6c656e6765223a22efbfbd22efbfbd5f21efbfbd1b113e63efbfbdefbfbd6defbfbd4fefbfbdefbfbd11efbfbd11efbfbd40efbfbdefbfbdefbfbd64efbfbdefbfbd3cefbfbd58222c226f726967696e223a2268747470733a2f2f646576656c6f706d656e742e666f72756d64616f732e636f6d227d";
        bytes32 messageHash = keccak256("test");
        uint256 clientChallengeDataOffset = 36;
        uint256[2] memory signature = [
            36788204816852931931532076736929768488646494203674172515272861180041446565109,
            60595451626159535380360537025565143491223093262105891867977188941268073626113
        ];
        uint256[2] memory publicKey = [
            84983235508986227069118519878575107221347312419117152995971180204793547896817,
            65342283463016373417889909198331793507107976344099657471582098851386861908802
        ];

        // Act
        bool verified = webauthn.verifySignature(
            authenticatorData,
            authenticatorDataFlagMask,
            clientData,
            messageHash,
            clientChallengeDataOffset,
            signature,
            publicKey
        );

        // Assert
        assertTrue(verified, "Invalid signature");
    }
}

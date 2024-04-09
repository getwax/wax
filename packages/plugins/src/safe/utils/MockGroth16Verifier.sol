// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;
pragma abicoder v2;

import {IGroth16Verifier} from "../interface/IGroth16Verifier.sol";

struct EmailProof {
    string domainName; // Domain name of the sender's email
    bytes32 publicKeyHash; // Hash of the DKIM public key used in email/proof
    uint timestamp; // Timestamp of the email
    string maskedSubject; // Masked subject of the email
    bytes32 emailNullifier; // Nullifier of the email to prevent its reuse.
    bytes32 accountSalt; // Create2 salt of the account
    bool isCodeExist; // Check if the account code is exist
    bytes proof; // ZK Proof of Email
}

// Mock/stub of snarkjs Groth16 Solidity verifier.
// We can't allow the result to change via a flag in storage as
// that would break ERC-4337 validation storage rules.
//
// This will eventually be removed in favor of real ZKP verfication contract.
// https://github.com/getwax/wax/issues/143
contract MockGroth16Verifier is IGroth16Verifier {
    function verifyProof(
        uint256[2] memory a,
        uint256[2][2] memory b,
        uint256[2] memory c,
        uint256[1] memory publicSignals
    ) external pure returns (bool r) {
        a;
        b;
        c;
        publicSignals;

        r = true;
    }

    function verifyProof(
        uint256[2] memory a,
        uint256[2][2] memory b,
        uint256[2] memory c,
        uint256[4] memory publicSignals
    ) external pure returns (bool r) {
        a;
        b;
        c;
        publicSignals;

        // arbitary condition to mock invalid verification
        if (a[0] == 1) {
            return r = false;
        }

        r = true;
    }

    function verifyEmailProof(
        EmailProof memory proof
    ) public view returns (bool) {
        proof;

        return true;
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title Interface for ZKP Passwrod Groth16 verifier
interface IDKIMRegsitry {
    function isDKIMPublicKeyHashValid(
        string memory domainName,
        bytes32 publicKeyHash
    ) external view returns (bool);
}

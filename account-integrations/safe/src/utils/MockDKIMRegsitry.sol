// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IDKIMRegsitry} from "../interface/IDKIMRegsitry.sol";

// Mock/stub of DKIM Registry.
//
// This will eventually be removed in favor of real DKIM Registry.
// https://github.com/getwax/wax/issues/171
contract MockDKIMRegsitry is IDKIMRegsitry {
    function isDKIMPublicKeyHashValid(
        string memory domainName,
        bytes32 publicKeyHash
    ) public pure returns (bool) {
        domainName;
        publicKeyHash;

        return true;
    }
}

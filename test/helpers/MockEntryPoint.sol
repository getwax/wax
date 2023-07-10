//SPDX-License-Identifier: Unlicense
pragma solidity >=0.7.0 <0.9.0;
pragma abicoder v2;

import "forge-std/Test.sol";

import {IEntryPoint, ISimplifiedEntryPoint} from "../../src/I4337.sol";

contract MockEntryPoint is ISimplifiedEntryPoint {
    bytes public params;

    function handleAggregatedOps(
        IEntryPoint.UserOpsPerAggregator[] calldata opsPerAggregator,
        address payable beneficiary
    ) external {
        params = abi.encode(opsPerAggregator, beneficiary);
    }
}

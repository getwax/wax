//SPDX-License-Identifier: Unlicense
pragma solidity >=0.7.0 <0.9.0;
pragma abicoder v2;

import "forge-std/Test.sol";

import {IEntryPoint, UserOperation, UserOpsPerAggregator} from "../../src/I4337.sol";

contract MockEntryPoint is IEntryPoint {
    bytes public handleOpsParams;
    bytes public handleAggregatedOpsParams;

    function handleOps(
        UserOperation[] calldata ops,
        address payable beneficiary
    ) external {
        handleOpsParams = abi.encode(ops, beneficiary);
    }

    function handleAggregatedOps(
        UserOpsPerAggregator[] calldata opsPerAggregator,
        address payable beneficiary
    ) external {
        handleAggregatedOpsParams = abi.encode(opsPerAggregator, beneficiary);
    }
}

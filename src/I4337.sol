//SPDX-License-Identifier: Unlicense
pragma solidity >=0.7.0 <0.9.0;
pragma abicoder v2;

import {IEntryPoint} from "@account-abstraction/interfaces/IEntryPoint.sol";
import {IAggregator} from "@account-abstraction/interfaces/IAggregator.sol";
import {UserOperation} from "@account-abstraction/interfaces/UserOperation.sol";

interface ISimplifiedEntryPoint {
    function handleAggregatedOps(
        IEntryPoint.UserOpsPerAggregator[] calldata opsPerAggregator,
        address payable beneficiary
    ) external;
}

interface ISimplifiedAggregator {}

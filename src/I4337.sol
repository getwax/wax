//SPDX-License-Identifier: Unlicense
pragma solidity >=0.7.0 <0.9.0;
pragma abicoder v2;

import {IEntryPoint} from "lib/account-abstraction/contracts/interfaces/IEntryPoint.sol";
import {IAggregator} from "lib/account-abstraction/contracts/interfaces/IAggregator.sol";
import {UserOperation} from "lib/account-abstraction/contracts/interfaces/UserOperation.sol";

interface ISimplifiedEntryPoint {
    function handleAggregatedOps(
        IEntryPoint.UserOpsPerAggregator[] calldata opsPerAggregator,
        address payable beneficiary
    ) external;
}

interface ISimplifiedAggregator {}

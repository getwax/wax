//SPDX-License-Identifier: Unlicense
pragma solidity >=0.7.0 <0.9.0;
pragma abicoder v2;

import {WaxLib as WL} from "../WaxLib.sol";

interface IDecompressor {
    function decompress(
        bytes calldata stream
    ) external returns (WL.Action[] memory);
}

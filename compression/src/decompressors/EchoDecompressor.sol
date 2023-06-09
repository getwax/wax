//SPDX-License-Identifier: Unlicense
pragma solidity >=0.7.0 <0.9.0;
pragma abicoder v2;

import {WaxLib as WL} from "../WaxLib.sol";
import {IDecompressor} from "./IDecompressor.sol";

contract EchoDecompressor is IDecompressor {
    function decompress(
        bytes calldata stream
    ) external pure returns (WL.Action[] memory) {
        return abi.decode(stream, (WL.Action[]));
    }
}

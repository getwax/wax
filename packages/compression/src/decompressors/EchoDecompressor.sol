//SPDX-License-Identifier: Unlicense
pragma solidity >=0.7.0 <0.9.0;
pragma abicoder v2;

import {WaxLib as W} from "../WaxLib.sol";
import {IDecompressor} from "./IDecompressor.sol";

contract EchoDecompressor is IDecompressor {
    function decompress(
        bytes calldata stream
    ) external pure returns (W.Action[] memory, uint256) {
        W.Action[] memory actions = abi.decode(stream, (W.Action[]));

        return (actions, stream.length);
    }
}

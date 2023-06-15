//SPDX-License-Identifier: Unlicense
pragma solidity >=0.7.0 <0.9.0;
pragma abicoder v2;

import {WaxLib as W} from "../WaxLib.sol";
import {IDecompressor} from "./IDecompressor.sol";
import {VLQ} from "../VLQ.sol";
import {PseudoFloat} from "../PseudoFloat.sol";

contract SimpleDecompressor is IDecompressor {
    function decompress(
        bytes calldata stream
    ) external pure returns (W.Action[] memory, uint256) {
        uint256 actionLen;
        uint256 originalStreamLen = stream.length;
        (actionLen, stream) = VLQ.decode(stream);

        W.Action[] memory actions = new W.Action[](actionLen);

        for (uint256 i = 0; i < actionLen; i++) {
            W.Action memory action;

            action.to = address(bytes20(stream[:20]));
            stream = stream[20:];

            (action.value, stream) = PseudoFloat.decode(stream);

            uint256 dataLen;
            (dataLen, stream) = VLQ.decode(stream);

            action.data = stream[:dataLen];
            stream = stream[dataLen:];

            actions[i] = action;
        }

        return (actions, originalStreamLen - stream.length);
    }
}

//SPDX-License-Identifier: Unlicense
pragma solidity >=0.7.0 <0.9.0;
pragma abicoder v2;

import {WaxLib as W} from "../WaxLib.sol";
import {IDecompressor} from "./IDecompressor.sol";
import {VLQ} from "../VLQ.sol";
import {PseudoFloat} from "../PseudoFloat.sol";
import {AddressRegistry} from "../AddressRegistry.sol";
import {RegIndex} from "../RegIndex.sol";

contract FallbackDecompressor is IDecompressor {
    AddressRegistry public addressRegistry;

    constructor(AddressRegistry addressRegistryParam) {
        addressRegistry = addressRegistryParam;
    }

    function decompress(
        bytes calldata stream
    ) external view returns (W.Action[] memory, uint256) {
        uint256 originalStreamLen = stream.length;

        uint256 actionLen;
        (actionLen, stream) = VLQ.decode(stream);

        W.Action[] memory actions = new W.Action[](actionLen);

        uint256 bitStream;
        (bitStream, stream) = VLQ.decode(stream);

        for (uint256 i = 0; i < actionLen; i++) {
            W.Action memory action;

            bool useRegistry;
            (useRegistry, bitStream) = decodeBit(bitStream);

            if (useRegistry) {
                uint256 addressIndex;
                (addressIndex, stream) = RegIndex.decode(stream);
                action.to = addressRegistry.lookup(addressIndex);
            } else {
                action.to = address(bytes20(stream[:20]));
                stream = stream[20:];
            }

            (action.value, stream) = PseudoFloat.decode(stream);

            uint256 dataLen;
            (dataLen, stream) = VLQ.decode(stream);

            action.data = stream[:dataLen];
            stream = stream[dataLen:];

            actions[i] = action;
        }

        return (actions, originalStreamLen - stream.length);
    }

    function decodeBit(uint256 bitStream) internal pure returns (bool, uint256) {
        return ((bitStream & 1) == 1, bitStream >> 1);
    }
}

//SPDX-License-Identifier: Unlicense
pragma solidity >=0.7.0 <0.9.0;
pragma abicoder v2;

import {WaxLib as W} from "../WaxLib.sol";
import {IDecompressor} from "./IDecompressor.sol";
import {VLQ} from "../VLQ.sol";
import {PseudoFloat} from "../PseudoFloat.sol";

contract SwitchDecompressor is IDecompressor {
    mapping(uint256 => IDecompressor) public decompressors;
    uint256 public decompressorCount;
    address public owner;

    constructor() {
        owner = msg.sender;
    }

    event DecompressorRegistered(uint256 index, IDecompressor indexed decompressor);

    function register(IDecompressor decompressor) public onlyOwner {
        decompressors[decompressorCount] = decompressor;
        emit DecompressorRegistered(decompressorCount, decompressor);

        decompressorCount++;
    }

    function transfer(address newOwner) public onlyOwner {
        owner = newOwner;
    }

    function decompress(
        bytes calldata stream
    ) external view returns (W.Action[] memory, uint256) {
        uint256 originalStreamLen = stream.length;

        uint256 decompressorIndex;
        (decompressorIndex, stream) = VLQ.decode(stream);

        IDecompressor decompressor = decompressors[decompressorIndex];
        require(decompressor != IDecompressor(address(0)), "Decompressor not found");

        W.Action[] memory actions;
        uint256 bytesRead;
        (actions, bytesRead) = decompressor.decompress(stream);
        stream = stream[bytesRead:];

        return (actions, originalStreamLen - stream.length);
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Failed onlyOwner");
        _;
    }
}

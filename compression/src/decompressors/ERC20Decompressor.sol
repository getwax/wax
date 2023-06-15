//SPDX-License-Identifier: Unlicense
pragma solidity >=0.7.0 <0.9.0;
pragma abicoder v2;

import "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";

import {WaxLib as W} from "../WaxLib.sol";
import {IDecompressor} from "./IDecompressor.sol";
import {VLQ} from "../VLQ.sol";
import {PseudoFloat} from "../PseudoFloat.sol";
import {AddressRegistry} from "../AddressRegistry.sol";
import {RegIndex} from "../RegIndex.sol";

contract ERC20Decompressor is IDecompressor {
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
            (
                actions[i].to,
                stream,
                bitStream
            ) = decodeAddress(
                stream,
                bitStream
            );

            (
                actions[i].data,
                stream,
                bitStream
            ) = decodeData(
                stream,
                bitStream
            );
        }

        return (actions, originalStreamLen - stream.length);
    }

    function decodeBit(
        uint256 bitStream
    ) internal pure returns (bool, uint256) {
        return ((bitStream & 1) == 1, bitStream >> 1);
    }

    function decodeData(
        bytes calldata stream,
        uint256 bitStream
    ) internal view returns (
        bytes memory,
        bytes calldata,
        uint256
    ) {
        uint256 methodIndex;
        (methodIndex, stream) = VLQ.decode(stream);

        if (methodIndex == 0) {
            return decodeTransfer(stream, bitStream);
        }

        if (methodIndex == 1) {
            return decodeTransferFrom(stream, bitStream);
        }

        if (methodIndex == 2) {
            return decodeApprove(stream, bitStream);
        }

        if (methodIndex == 3) {
            // Not a real method, but uint256Max is common for approve, and is
            // not represented efficiently by PseudoFloat.
            return decodeApproveMax(stream, bitStream);
        }

        if (methodIndex == 4) {
            return decodeMint(stream, bitStream);
        }

        revert("Unrecognized ERC20 method index");
    }

    function decodeTransfer(
        bytes calldata stream,
        uint256 bitStream
    ) internal view returns (
        bytes memory,
        bytes calldata,
        uint256
    ) {
        address to;
        (to, stream, bitStream) = decodeAddress(stream, bitStream);

        uint256 value;
        (value, stream) = PseudoFloat.decode(stream);

        return (
            abi.encodeCall(IERC20.transfer, (to, value)),
            stream,
            bitStream
        );
    }
    
    function decodeTransferFrom(
        bytes calldata stream,
        uint256 bitStream
    ) internal view returns (
        bytes memory,
        bytes calldata,
        uint256
    ) {
        address from;
        (from, stream, bitStream) = decodeAddress(stream, bitStream);

        address to;
        (to, stream, bitStream) = decodeAddress(stream, bitStream);

        uint256 value;
        (value, stream) = PseudoFloat.decode(stream);

        return (
            abi.encodeCall(IERC20.transferFrom, (from, to, value)),
            stream,
            bitStream
        );
    }
    
    function decodeApprove(
        bytes calldata stream,
        uint256 bitStream
    ) internal view returns (
        bytes memory,
        bytes calldata,
        uint256
    ) {
        address spender;
        (spender, stream, bitStream) = decodeAddress(stream, bitStream);

        uint256 value;
        (value, stream) = PseudoFloat.decode(stream);

        return (
            abi.encodeCall(IERC20.approve, (spender, value)),
            stream,
            bitStream
        );
    }
    
    function decodeApproveMax(
        bytes calldata stream,
        uint256 bitStream
    ) internal view returns (
        bytes memory,
        bytes calldata,
        uint256
    ) {
        address spender;
        (spender, stream, bitStream) = decodeAddress(stream, bitStream);

        return (
            abi.encodeCall(IERC20.approve, (spender, type(uint256).max)),
            stream,
            bitStream
        );
    }

    function decodeMint(
        bytes calldata stream,
        uint256 bitStream
    ) internal view returns (
        bytes memory,
        bytes calldata,
        uint256
    ) {
        address to;
        (to, stream, bitStream) = decodeAddress(stream, bitStream);

        uint256 value;
        (value, stream) = PseudoFloat.decode(stream);

        return (
            abi.encodeWithSignature("mint(address,uint256)", to, value),
            stream,
            bitStream
        );
    }

    function decodeAddress(
        bytes calldata stream,
        uint256 bitStream
    ) internal view returns (
        address,
        bytes calldata,
        uint256
    ) {
        uint256 decodedValue;
        bool decodedBit;

        (decodedBit, bitStream) = decodeBit(bitStream);

        if (decodedBit) {
            (decodedValue, stream) = RegIndex.decode(stream);
            return (addressRegistry.lookup(decodedValue), stream, bitStream);
        }

        return (address(bytes20(stream[:20])), stream[20:], bitStream);
    }
}


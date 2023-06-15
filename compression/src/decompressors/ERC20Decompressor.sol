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

    function compress(
        W.Action[] calldata actions,

        // These need to be passed in because the reverse mapping is not stored
        // on-chain. Instead, wallets should use the AddressRegistered events
        // and do an off-chain lookup to figure out which registered addresses
        // will be relevant for this call.
        AddressRegistry.Entry[] calldata registeredAddresses
    ) external pure returns (bytes memory) {
        bytes memory res = "";
        uint256 bitStream = 0;

        for (uint256 i = 0; i < actions.length; i++) {
            W.Action calldata action = actions[i];

            bytes memory tokenAddressBytes;
            (tokenAddressBytes, bitStream) = encodeAddress(
                action.to,
                bitStream,
                registeredAddresses
            );

            require(action.value == 0, "ERC20 action must not send ETH");

            bytes memory dataBytes;
            bytes4 selector = bytes4(action.data);

            if (selector == IERC20.transfer.selector) {
                (dataBytes, bitStream) = encodeTransfer(
                    action.data,
                    bitStream,
                    registeredAddresses
                );
            } else if (selector == IERC20.transferFrom.selector) {
                (dataBytes, bitStream) = encodeTransferFrom(
                    action.data,
                    bitStream,
                    registeredAddresses
                );
            } else if (selector == IERC20.approve.selector) {
                (dataBytes, bitStream) = encodeApprove(
                    action.data,
                    bitStream,
                    registeredAddresses
                );
            } else if (
                selector == bytes4(keccak256("mint(address,uint256)"))
            ) {
                (dataBytes, bitStream) = encodeMint(
                    action.data,
                    bitStream,
                    registeredAddresses
                );
            }

            res = bytes.concat(
                res,
                tokenAddressBytes,
                dataBytes
            );
        }

        res = bytes.concat(
            VLQ.encode(actions.length),
            VLQ.encode(bitStream),
            res
        );

        return res;
    }

    function encodeAddress(
        address addr,
        uint256 bitStream,
        AddressRegistry.Entry[] calldata registeredAddresses
    ) internal pure returns (bytes memory, uint256) {
        bitStream <<= 1;

        for (uint256 i = 0; i < registeredAddresses.length; i++) {
            if (registeredAddresses[i].addr == addr) {
                bitStream += 1;
                return (RegIndex.encode(registeredAddresses[i].id), bitStream);
            }
        }

        return (bytes.concat(bytes20(addr)), bitStream);
    }

    function encodeTransfer(
        bytes calldata data,
        uint256 bitStream,
        AddressRegistry.Entry[] calldata registeredAddresses
    ) internal pure returns (bytes memory, uint256) {
        (address to, uint256 amount) = abi.decode(
            data[4:],
            (address, uint256)
        );

        bytes memory toAddressBytes;
        (toAddressBytes, bitStream) = encodeAddress(
            to,
            bitStream,
            registeredAddresses
        );

        bytes memory dataBytes = bytes.concat(
            hex"00",
            toAddressBytes,
            PseudoFloat.encode(amount)
        );

        return (dataBytes, bitStream);
    }

    function encodeTransferFrom(
        bytes calldata data,
        uint256 bitStream,
        AddressRegistry.Entry[] calldata registeredAddresses
    ) internal pure returns (bytes memory, uint256) {
        (address from, address to, uint256 amount) = abi.decode(
            data[4:],
            (address, address, uint256)
        );

        bytes memory fromAddressBytes;
        (fromAddressBytes, bitStream) = encodeAddress(
            from,
            bitStream,
            registeredAddresses
        );

        bytes memory toAddressBytes;
        (toAddressBytes, bitStream) = encodeAddress(
            to,
            bitStream,
            registeredAddresses
        );

        bytes memory dataBytes = bytes.concat(
            hex"01",
            fromAddressBytes,
            toAddressBytes,
            PseudoFloat.encode(amount)
        );

        return (dataBytes, bitStream);
    }

    function encodeApprove(
        bytes calldata data,
        uint256 bitStream,
        AddressRegistry.Entry[] calldata registeredAddresses
    ) internal pure returns (bytes memory, uint256) {
        (address spender, uint256 amount) = abi.decode(
            data[4:],
            (address, uint256)
        );

        bytes memory spenderAddressBytes;
        (spenderAddressBytes, bitStream) = encodeAddress(
            spender,
            bitStream,
            registeredAddresses
        );

        bytes memory dataBytes;

        if (amount != type(uint256).max) {
            dataBytes = bytes.concat(
                hex"02",
                spenderAddressBytes,
                PseudoFloat.encode(amount)
            );
        } else {
            dataBytes = bytes.concat(
                hex"03",
                spenderAddressBytes
            );
        }

        return (dataBytes, bitStream);
    }

    function encodeMint(
        bytes calldata data,
        uint256 bitStream,
        AddressRegistry.Entry[] calldata registeredAddresses
    ) internal pure returns (bytes memory, uint256) {
        (address to, uint256 amount) = abi.decode(
            data[4:],
            (address, uint256)
        );

        bytes memory toAddressBytes;
        (toAddressBytes, bitStream) = encodeAddress(
            to,
            bitStream,
            registeredAddresses
        );

        bytes memory dataBytes = bytes.concat(
            hex"04",
            toAddressBytes,
            PseudoFloat.encode(amount)
        );

        return (dataBytes, bitStream);
    }
}

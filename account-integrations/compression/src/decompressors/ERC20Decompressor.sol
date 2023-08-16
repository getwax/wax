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
import {BitStack} from "../BitStack.sol";

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

        uint256 bitStack;
        (bitStack, stream) = VLQ.decode(stream);

        for (uint256 i = 0; i < actionLen; i++) {
            (
                actions[i].to,
                stream,
                bitStack
            ) = decodeAddress(
                stream,
                bitStack
            );

            (
                actions[i].data,
                stream,
                bitStack
            ) = decodeData(
                stream,
                bitStack
            );
        }

        return (actions, originalStreamLen - stream.length);
    }

    function decodeData(
        bytes calldata stream,
        uint256 bitStack
    ) internal view returns (
        bytes memory,
        bytes calldata,
        uint256
    ) {
        uint256 methodIndex;
        (methodIndex, stream) = VLQ.decode(stream);

        if (methodIndex == 0) {
            return decodeTransfer(stream, bitStack);
        }

        if (methodIndex == 1) {
            return decodeTransferFrom(stream, bitStack);
        }

        if (methodIndex == 2) {
            return decodeApprove(stream, bitStack);
        }

        if (methodIndex == 3) {
            // Not a real method, but uint256Max is common for approve, and is
            // not represented efficiently by PseudoFloat.
            return decodeApproveMax(stream, bitStack);
        }

        if (methodIndex == 4) {
            return decodeMint(stream, bitStack);
        }

        revert("Unrecognized ERC20 method index");
    }

    function decodeTransfer(
        bytes calldata stream,
        uint256 bitStack
    ) internal view returns (
        bytes memory,
        bytes calldata,
        uint256
    ) {
        address to;
        (to, stream, bitStack) = decodeAddress(stream, bitStack);

        uint256 value;
        (value, stream) = PseudoFloat.decode(stream);

        return (
            abi.encodeCall(IERC20.transfer, (to, value)),
            stream,
            bitStack
        );
    }
    
    function decodeTransferFrom(
        bytes calldata stream,
        uint256 bitStack
    ) internal view returns (
        bytes memory,
        bytes calldata,
        uint256
    ) {
        address from;
        (from, stream, bitStack) = decodeAddress(stream, bitStack);

        address to;
        (to, stream, bitStack) = decodeAddress(stream, bitStack);

        uint256 value;
        (value, stream) = PseudoFloat.decode(stream);

        return (
            abi.encodeCall(IERC20.transferFrom, (from, to, value)),
            stream,
            bitStack
        );
    }
    
    function decodeApprove(
        bytes calldata stream,
        uint256 bitStack
    ) internal view returns (
        bytes memory,
        bytes calldata,
        uint256
    ) {
        address spender;
        (spender, stream, bitStack) = decodeAddress(stream, bitStack);

        uint256 value;
        (value, stream) = PseudoFloat.decode(stream);

        return (
            abi.encodeCall(IERC20.approve, (spender, value)),
            stream,
            bitStack
        );
    }
    
    function decodeApproveMax(
        bytes calldata stream,
        uint256 bitStack
    ) internal view returns (
        bytes memory,
        bytes calldata,
        uint256
    ) {
        address spender;
        (spender, stream, bitStack) = decodeAddress(stream, bitStack);

        return (
            abi.encodeCall(IERC20.approve, (spender, type(uint256).max)),
            stream,
            bitStack
        );
    }

    function decodeMint(
        bytes calldata stream,
        uint256 bitStack
    ) internal view returns (
        bytes memory,
        bytes calldata,
        uint256
    ) {
        address to;
        (to, stream, bitStack) = decodeAddress(stream, bitStack);

        uint256 value;
        (value, stream) = PseudoFloat.decode(stream);

        return (
            abi.encodeWithSignature("mint(address,uint256)", to, value),
            stream,
            bitStack
        );
    }

    function decodeAddress(
        bytes calldata stream,
        uint256 bitStack
    ) internal view returns (
        address,
        bytes calldata,
        uint256
    ) {
        uint256 decodedValue;
        bool decodedBit;

        (decodedBit, bitStack) = BitStack.pop(bitStack);

        if (decodedBit) {
            (decodedValue, stream) = RegIndex.decode(stream);
            return (addressRegistry.lookup(decodedValue), stream, bitStack);
        }

        return (address(bytes20(stream[:20])), stream[20:], bitStack);
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
        uint256 bitStack = BitStack.empty;

        for (uint256 i = 0; i < actions.length; i++) {
            W.Action calldata action = actions[i];

            bytes memory tokenAddressBytes;
            (tokenAddressBytes, bitStack) = encodeAddress(
                action.to,
                bitStack,
                registeredAddresses
            );

            require(action.value == 0, "ERC20 action must not send ETH");

            bytes memory dataBytes;
            bytes4 selector = bytes4(action.data);

            if (selector == IERC20.transfer.selector) {
                (dataBytes, bitStack) = encodeTransfer(
                    action.data,
                    bitStack,
                    registeredAddresses
                );
            } else if (selector == IERC20.transferFrom.selector) {
                (dataBytes, bitStack) = encodeTransferFrom(
                    action.data,
                    bitStack,
                    registeredAddresses
                );
            } else if (selector == IERC20.approve.selector) {
                (dataBytes, bitStack) = encodeApprove(
                    action.data,
                    bitStack,
                    registeredAddresses
                );
            } else if (
                selector == bytes4(keccak256("mint(address,uint256)"))
            ) {
                (dataBytes, bitStack) = encodeMint(
                    action.data,
                    bitStack,
                    registeredAddresses
                );
            }

            res = bytes.concat(
                res,
                tokenAddressBytes,
                dataBytes
            );
        }

        // So that the decompressor can pop the bits in the order we pushed
        // them.
        bitStack = BitStack.reverse(bitStack);

        res = bytes.concat(
            VLQ.encode(actions.length),
            VLQ.encode(bitStack),
            res
        );

        return res;
    }

    function encodeAddress(
        address addr,
        uint256 bitStack,
        AddressRegistry.Entry[] calldata registeredAddresses
    ) internal pure returns (bytes memory, uint256) {
        for (uint256 i = 0; i < registeredAddresses.length; i++) {
            if (registeredAddresses[i].addr == addr) {
                return (
                    RegIndex.encode(registeredAddresses[i].id),
                    BitStack.push(bitStack, true)
                );
            }
        }

        return (
            bytes.concat(bytes20(addr)),
            BitStack.push(bitStack, false)
        );
    }

    function encodeTransfer(
        bytes calldata data,
        uint256 bitStack,
        AddressRegistry.Entry[] calldata registeredAddresses
    ) internal pure returns (bytes memory, uint256) {
        (address to, uint256 amount) = abi.decode(
            data[4:],
            (address, uint256)
        );

        bytes memory toAddressBytes;
        (toAddressBytes, bitStack) = encodeAddress(
            to,
            bitStack,
            registeredAddresses
        );

        bytes memory dataBytes = bytes.concat(
            hex"00",
            toAddressBytes,
            PseudoFloat.encode(amount)
        );

        return (dataBytes, bitStack);
    }

    function encodeTransferFrom(
        bytes calldata data,
        uint256 bitStack,
        AddressRegistry.Entry[] calldata registeredAddresses
    ) internal pure returns (bytes memory, uint256) {
        (address from, address to, uint256 amount) = abi.decode(
            data[4:],
            (address, address, uint256)
        );

        bytes memory fromAddressBytes;
        (fromAddressBytes, bitStack) = encodeAddress(
            from,
            bitStack,
            registeredAddresses
        );

        bytes memory toAddressBytes;
        (toAddressBytes, bitStack) = encodeAddress(
            to,
            bitStack,
            registeredAddresses
        );

        bytes memory dataBytes = bytes.concat(
            hex"01",
            fromAddressBytes,
            toAddressBytes,
            PseudoFloat.encode(amount)
        );

        return (dataBytes, bitStack);
    }

    function encodeApprove(
        bytes calldata data,
        uint256 bitStack,
        AddressRegistry.Entry[] calldata registeredAddresses
    ) internal pure returns (bytes memory, uint256) {
        (address spender, uint256 amount) = abi.decode(
            data[4:],
            (address, uint256)
        );

        bytes memory spenderAddressBytes;
        (spenderAddressBytes, bitStack) = encodeAddress(
            spender,
            bitStack,
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

        return (dataBytes, bitStack);
    }

    function encodeMint(
        bytes calldata data,
        uint256 bitStack,
        AddressRegistry.Entry[] calldata registeredAddresses
    ) internal pure returns (bytes memory, uint256) {
        (address to, uint256 amount) = abi.decode(
            data[4:],
            (address, uint256)
        );

        bytes memory toAddressBytes;
        (toAddressBytes, bitStack) = encodeAddress(
            to,
            bitStack,
            registeredAddresses
        );

        bytes memory dataBytes = bytes.concat(
            hex"04",
            toAddressBytes,
            PseudoFloat.encode(amount)
        );

        return (dataBytes, bitStack);
    }
}

//SPDX-License-Identifier: Unlicense
pragma solidity >=0.7.0 <0.9.0;
pragma abicoder v2;

import {WaxLib as W} from "./WaxLib.sol";
import {IDecompressor} from "./decompressors/IDecompressor.sol";

contract DemoAccount {
    address public owner;
    IDecompressor public decompressor = IDecompressor(address(0));

    constructor(address ownerParam) {
        owner = ownerParam;
    }

    function perform(
        W.Action[] memory actions
    ) public isTrusted returns (bytes[] memory) {
        bytes[] memory results = new bytes[](actions.length);

        for (uint256 i = 0; i < actions.length; i++) {
            W.Action memory a = actions[i];

            if (a.to != W.contractCreationAddress) {
                (bool success, bytes memory result) = payable(a.to)
                    .call{value: a.value}(a.data);

                if (!success) {
                    revert W.ActionError(i, result);
                }

                results[i] = result;
            } else {
                address addr;
                uint256 value = a.value;
                bytes memory data = a.data;
                
                assembly {
                    addr := create(
                        value,
                        add(data, 0x20),
                        mload(data)
                    )

                    if iszero(addr) {
                        revert(0, 0)
                    }
                }

                results[i] = abi.encode(addr);
            }
        }

        return results;
    }

    function setDecompressor(
        IDecompressor decompressorParam
    ) public isTrusted {
        decompressor = decompressorParam;
    }

    function decompressAndPerform(
        bytes calldata stream
    ) public isTrusted returns (bytes[] memory) {
        (W.Action[] memory actions,) = decompressor.decompress(stream);
        return perform(actions);
    }

    /**
     * This is the normal way to pass calldata.
     *
     * Using `decompressAndPerform` directly costs about 51.5 bytes more
     * because the solidity ABI encodes a call with bytes as:
     * - 4 byte function signature
     * - 32 bytes for a uint256 field indicating the byte length
     * - The actual bytes
     * - Padding bytes (zeros) to ensure a multiple of 32 (+15.5 on average)
     *
     * Having the fallback function allows us to just pass the actual bytes
     * most of the time. However, wallets need to ensure they don't
     * accidentally encode one of the other methods. When they hit this case,
     * they need to encode a call to `decompressAndPerform` instead.
     */
    fallback(bytes calldata stream) external isTrusted returns (bytes memory) {
        return abi.encode(decompressAndPerform(stream));
    }

    receive() external payable {}

    modifier isTrusted() {
        require(
            msg.sender == owner ||
            msg.sender == address(this)
        );
        _;
    }
}

// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;
pragma abicoder v2;

import {UserOperation} from "account-abstraction/contracts/interfaces/IEntryPoint.sol";

import {WaxLib as W} from "./compression/WaxLib.sol";
import {IDecompressor} from "./compression/decompressors/IDecompressor.sol";

interface ISafe {
    function enableModule(address module) external;

    function execTransactionFromModule(
        address to,
        uint256 value,
        bytes memory data,
        uint8 operation
    ) external returns (bool success);
}

contract SafeCompressionPlugin {
    address public immutable myAddress;
    address private immutable entryPoint;
    uint256 public value;
    IDecompressor public decompressor;

    address internal constant _SENTINEL_MODULES = address(0x1);

    constructor(address entryPointParam, IDecompressor decompressorParam) {
        myAddress = address(this);
        entryPoint = entryPointParam;
        decompressor = decompressorParam;
    }

    function decompressAndPerform(
        bytes calldata stream
    ) public fromThisOrEntryPoint {
        (W.Action[] memory actions,) = decompressor.decompress(stream);

        ISafe safe = ISafe(msg.sender);

        for (uint256 i = 0; i < actions.length; i++) {
            W.Action memory a = actions[i];

            require(
                safe.execTransactionFromModule(a.to, a.value, a.data, 0),
                "tx failed"
            );
        }
    }

    function setDecompressor(
        IDecompressor decompressorParam
    ) public fromThisOrEntryPoint {
        decompressor = decompressorParam;
    }

    function foo() public pure returns (uint256) {
        return 123;
    }

    function execTransaction(uint256 valueParam) public {
        value = valueParam;
    }

    function enableMyself() public {
        ISafe(address(this)).enableModule(myAddress);
    }

    modifier fromThisOrEntryPoint() {
        require(
            msg.sender == entryPoint ||
            msg.sender == address(this)
        );
        _;
    }
}

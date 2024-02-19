// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;
pragma abicoder v2;

import {Safe} from "safe-contracts/contracts/Safe.sol";
import {SafeProxyFactory} from "safe-contracts/contracts/proxies/SafeProxyFactory.sol";
import {SafeProxy} from "safe-contracts/contracts/proxies/SafeProxy.sol";

import {EntryPoint} from "account-abstraction/contracts/core/EntryPoint.sol";

import {SafeCompressionPlugin} from "./SafeCompressionPlugin.sol";
import {IDecompressor} from "./compression/decompressors/IDecompressor.sol";

contract SafeCompressionFactory {
    function create(
        Safe safeSingleton,
        EntryPoint entryPoint,
        IDecompressor defaultDecompressor,
        address owner,
        uint256 saltNonce
    ) external returns (SafeCompressionPlugin) {
        bytes32 salt = keccak256(abi.encodePacked(owner, saltNonce));

        Safe safe = Safe(payable(new SafeProxy{salt: salt}(
            address(safeSingleton)
        )));

        address[] memory owners = new address[](1);
        owners[0] = owner;

        SafeCompressionPlugin plugin = new SafeCompressionPlugin{salt: salt}(
            address(entryPoint),
            defaultDecompressor
        );

        safe.setup(
            owners,
            1,
            address(plugin),
            abi.encodeCall(SafeCompressionPlugin.enableMyself, (owner)),
            address(plugin),
            address(0),
            0,
            payable(address(0))
        );

        return SafeCompressionPlugin(address(safe));
    }
}

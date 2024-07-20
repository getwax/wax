// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;
pragma abicoder v2;

import {Safe} from "safe-contracts/contracts/Safe.sol";
import {SafeProxyFactory} from "safe-contracts/contracts/proxies/SafeProxyFactory.sol";
import {SafeProxy} from "safe-contracts/contracts/proxies/SafeProxy.sol";

import {EntryPoint} from "account-abstraction/core/EntryPoint.sol";

import {SafeCompressionPlugin} from "../validators/SafeCompressionPlugin.sol";
import {IDecompressor} from "../../compression/decompressors/IDecompressor.sol";

/*//////////////////////////////////////////////////////////////////////////
    THIS CONTRACT IS STILL IN ACTIVE DEVELOPMENT. NOT FOR PRODUCTION USE        
//////////////////////////////////////////////////////////////////////////*/

contract SafeCompressionFactory {
    function create(
        Safe safeSingleton,
        EntryPoint entryPoint,
        address aggregatorAddress,
        uint256[4] memory blsPublicKey,
        IDecompressor defaultDecompressor,
        address owner,
        uint256 saltNonce
    ) external returns (SafeCompressionPlugin) {
        bytes32 salt = keccak256(abi.encodePacked(owner, saltNonce));

        Safe safe = Safe(
            payable(new SafeProxy{salt: salt}(address(safeSingleton)))
        );

        address[] memory owners = new address[](1);
        owners[0] = owner;

        SafeCompressionPlugin plugin = new SafeCompressionPlugin{salt: salt}(
            address(entryPoint),
            aggregatorAddress,
            blsPublicKey,
            defaultDecompressor
        );

        safe.setup(
            owners,
            1,
            address(plugin),
            abi.encodeCall(SafeCompressionPlugin.enableMyself, ()),
            address(plugin),
            address(0),
            0,
            payable(address(0))
        );

        return SafeCompressionPlugin(address(safe));
    }
}

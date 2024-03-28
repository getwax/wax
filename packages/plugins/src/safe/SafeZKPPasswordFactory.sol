// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;
pragma abicoder v2;

import {Safe} from "safe-contracts/contracts/Safe.sol";
import {SafeProxyFactory} from "safe-contracts/contracts/proxies/SafeProxyFactory.sol";
import {SafeProxy} from "safe-contracts/contracts/proxies/SafeProxy.sol";

import {EntryPoint} from "account-abstraction/core/EntryPoint.sol";

import {SafeZKPPasswordPlugin} from "./SafeZKPPasswordPlugin.sol";
import {IGroth16Verifier} from "./interface/IGroth16Verifier.sol";

contract SafeZKPPasswordFactory {
    function create(
        Safe safeSingleton,
        EntryPoint entryPoint,
        address owner,
        uint256 saltNonce,
        IGroth16Verifier verifier
    ) external returns (SafeZKPPasswordPlugin) {
        bytes32 salt = keccak256(abi.encodePacked(owner, saltNonce));

        Safe safe = Safe(
            payable(new SafeProxy{salt: salt}(address(safeSingleton)))
        );

        address[] memory owners = new address[](1);
        owners[0] = owner;

        SafeZKPPasswordPlugin plugin = new SafeZKPPasswordPlugin{salt: salt}(
            address(entryPoint),
            verifier
        );

        safe.setup(
            owners,
            1,
            address(plugin),
            abi.encodeCall(SafeZKPPasswordPlugin.enableMyself, (owner)),
            address(plugin),
            address(0),
            0,
            payable(address(0))
        );

        return SafeZKPPasswordPlugin(address(safe));
    }
}

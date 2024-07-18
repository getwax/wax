// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;
pragma abicoder v2;

import {Safe} from "safe-contracts/contracts/Safe.sol";
import {SafeProxyFactory} from "safe-contracts/contracts/proxies/SafeProxyFactory.sol";
import {SafeProxy} from "safe-contracts/contracts/proxies/SafeProxy.sol";

import {EntryPoint} from "account-abstraction/core/EntryPoint.sol";

import {SafeECDSAPlugin} from "../validators/SafeECDSAPlugin.sol";

/*//////////////////////////////////////////////////////////////////////////
    THIS CONTRACT IS STILL IN ACTIVE DEVELOPMENT. NOT FOR PRODUCTION USE        
//////////////////////////////////////////////////////////////////////////*/

contract SafeECDSAFactory {
    function create(
        Safe safeSingleton,
        EntryPoint entryPoint,
        address owner,
        uint256 saltNonce
    ) external returns (SafeECDSAPlugin) {
        bytes32 salt = keccak256(abi.encodePacked(owner, saltNonce));

        Safe safe = Safe(
            payable(new SafeProxy{salt: salt}(address(safeSingleton)))
        );

        address[] memory owners = new address[](1);
        owners[0] = owner;

        SafeECDSAPlugin plugin = new SafeECDSAPlugin{salt: salt}(
            address(entryPoint)
        );

        safe.setup(
            owners,
            1,
            address(plugin),
            abi.encodeCall(SafeECDSAPlugin.enableMyself, (owner)),
            address(plugin),
            address(0),
            0,
            payable(address(0))
        );

        return SafeECDSAPlugin(address(safe));
    }
}

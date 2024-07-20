// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;
pragma abicoder v2;

import {Safe} from "safe-contracts/contracts/Safe.sol";
import {SafeProxyFactory} from "safe-contracts/contracts/proxies/SafeProxyFactory.sol";
import {SafeProxy} from "safe-contracts/contracts/proxies/SafeProxy.sol";

import {EntryPoint} from "account-abstraction/core/EntryPoint.sol";

import {SafeAnonAadhaarPlugin} from "../validators/SafeAnonAadhaarPlugin.sol";

/*//////////////////////////////////////////////////////////////////////////
    THIS CONTRACT IS STILL IN ACTIVE DEVELOPMENT. NOT FOR PRODUCTION USE        
//////////////////////////////////////////////////////////////////////////*/

contract SafeAnonAadhaarFactory {
    function create(
        Safe safeSingleton,
        EntryPoint entryPoint,
        address owner,
        uint256 saltNonce,
        address _anonAadhaarAddr,
        uint256 _userDataHash
    ) external returns (SafeAnonAadhaarPlugin) {
        bytes32 salt = keccak256(abi.encodePacked(owner, saltNonce));

        Safe safe = Safe(
            payable(new SafeProxy{salt: salt}(address(safeSingleton)))
        );

        address[] memory owners = new address[](1);
        owners[0] = owner;

        SafeAnonAadhaarPlugin plugin = new SafeAnonAadhaarPlugin{salt: salt}(
            address(entryPoint),
            _anonAadhaarAddr,
            address(safe),
            _userDataHash
        );

        safe.setup(
            owners,
            1,
            address(plugin),
            abi.encodeCall(
                SafeAnonAadhaarPlugin.enableMyself,
                (owner, _userDataHash)
            ),
            address(plugin),
            address(0),
            0,
            payable(address(0))
        );

        return SafeAnonAadhaarPlugin(address(safe));
    }
}

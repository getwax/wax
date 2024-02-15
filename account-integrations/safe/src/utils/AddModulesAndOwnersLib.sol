// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0 <0.9.0;

import {ISafe} from "./Safe4337Base.sol";

interface IModule {
    function enableModule(address owner) external;
}

/// @title AddModulesLib
contract AddModulesAndOwnersLib {
    function enableModulesWithOwners(address[] calldata modules, address[] calldata owners) external {
        for (uint256 i = modules.length; i > 0; i--) {
            // This call will only work properly if used via a delegatecall
            ISafe(address(this)).enableModule(modules[i - 1]);
            IModule(modules[i - 1]).enableModule(owners[i - 1]);
        }
    }
}

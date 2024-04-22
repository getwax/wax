// SPDX-License.Idenitifer: MIT
pragma solidity ^0.8.0;

import {EmailAccountRecoveryRouter} from "./EmailAccountRecoveryRouter.sol";

interface IRouterManager {
    struct SafeAccountInfo {
        address safe;
        address previousOwnerInLinkedList;
    }

    /** TODO: */
    error RouterAlreadyDeployed();

    function getSafeAccountInfo(
        address recoveryRouter
    ) external view returns (SafeAccountInfo memory);

    function getRouterForSafe(address safe) external view returns (address);
}

abstract contract RouterManager is IRouterManager {
    /** Mapping of email account recovery router contracts to safe details needed to complete recovery */
    mapping(address => SafeAccountInfo) internal recoveryRouterToSafeInfo;

    /** Mapping of safe account addresses to email account recovery router contracts**/
    /** These are stored for frontends to easily find the router contract address from the given safe account address**/
    mapping(address => address) internal safeToRecoveryRouter;

    /// @inheritdoc IRouterManager
    function getSafeAccountInfo(
        address recoveryRouter
    ) public view override returns (SafeAccountInfo memory) {
        return recoveryRouterToSafeInfo[recoveryRouter];
    }

    /// @inheritdoc IRouterManager
    function getRouterForSafe(
        address safe
    ) public view override returns (address) {
        return safeToRecoveryRouter[safe];
    }

    function deployRouterForAccount(
        address account,
        address previousOwnerInLinkedList
    ) internal returns (address) {
        if (safeToRecoveryRouter[account] != address(0))
            revert RouterAlreadyDeployed();

        EmailAccountRecoveryRouter emailAccountRecoveryRouter = new EmailAccountRecoveryRouter(
                address(this)
            );
        address routerAddress = address(emailAccountRecoveryRouter);

        recoveryRouterToSafeInfo[routerAddress] = SafeAccountInfo(
            account,
            previousOwnerInLinkedList
        );
        safeToRecoveryRouter[account] = routerAddress;

        return routerAddress;
    }
}

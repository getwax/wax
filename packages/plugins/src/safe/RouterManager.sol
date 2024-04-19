// SPDX-License.Idenitifer: MIT
pragma solidity ^0.8.0;

interface IRouterManager {
    struct SafeAccountInfo {
        address safe;
        address previousOwnerInLinkedList;
    }

    function getSafeAccountInfo(
        address recoveryRouter
    ) external view returns (SafeAccountInfo memory);

    function getRouterForSafe(address safe) external view returns (address);
}

abstract contract RouterManager is IRouterManager {
    /** Mapping of email account recovery router contracts to safe details needed to complete recovery */
    mapping(address => SafeAccountInfo) public recoveryRouterToSafeInfo;

    /** Mapping of safe account addresses to email account recovery router contracts**/
    /** These are stored for frontends to easily find the router contract address from the given safe account address**/
    mapping(address => address) public safeToRecoveryRouter;

    /// @inheritdoc IRouterManager
    function getSafeAccountInfo(
        address recoveryRouter
    ) external view override returns (SafeAccountInfo memory) {
        return recoveryRouterToSafeInfo[recoveryRouter];
    }

    /// @inheritdoc IRouterManager
    function getRouterForSafe(
        address safe
    ) external view override returns (address) {
        return safeToRecoveryRouter[safe];
    }
}

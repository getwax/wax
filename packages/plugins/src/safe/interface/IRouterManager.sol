// SPDX-License.Idenitifer: MIT
pragma solidity ^0.8.0;

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

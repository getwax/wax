// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;
pragma abicoder v2;

import {HandlerContext} from "safe-contracts/contracts/handler/HandlerContext.sol";
import {SIG_VALIDATION_FAILED} from "account-abstraction/core/Helpers.sol";
import {BaseAccount} from "account-abstraction/core/BaseAccount.sol";

interface ISafe {
    /**
     * @notice Enables the module `module` for the Safe.
     * @dev This can only be done via a Safe transaction.
     * @param module Module to be enabled.
     */
    function enableModule(address module) external;

    /**
     * @dev Allows a Module to execute a Safe transaction without any further confirmations.
     * @param to Destination address of module transaction.
     * @param value Ether value of module transaction.
     * @param data Data payload of module transaction.
     * @param operation Operation type of module transaction.
     */
    function execTransactionFromModule(
        address to,
        uint256 value,
        bytes memory data,
        uint8 operation
    ) external returns (bool success);

    /**
     * @notice Returns if an module is enabled
     * @return True if the module is enabled
     */
    function isModuleEnabled(address module) external view returns (bool);

    /**
     * @notice Returns if `owner` is an owner of the Safe.
     * @return Boolean if owner is an owner of the Safe.
     */
    function isOwner(address owner) external view returns (bool);

    /**
     * @notice Returns a list of Safe owners.
     * @return Array of Safe owners.
     */
    function getOwners() external view returns (address[] memory);
}

/**
 * Base contract with common code for implementing a 4337 plugin for a Safe.
 *
 * In particular, this modifies eth-infinitism's BaseAccount to use
 * `_msgSender()` when checking the call comes from the entry point, and pays
 * the prefund using `execTransactionFromModule`.
 */
abstract contract Safe4337Base is BaseAccount, HandlerContext {
    error NONCE_NOT_SEQUENTIAL();

    function _requireFromEntryPoint() internal view virtual override {
        require(
            _msgSender() == address(entryPoint()),
            "account: not from EntryPoint"
        );
    }

    function _requireFromCurrentSafeOrEntryPoint() internal view virtual {
        require(
            _msgSender() == address(entryPoint()) ||
                _msgSender() == address(_currentSafe()),
            "account: not from EntryPoint nor current safe"
        );
    }

    /**
     * This function is overridden as this plugin does not hold funds, so the
     * transaction has to be executed from the sender Safe
     * @param missingAccountFunds The minimum value this method should send to
     *   the entrypoint
     */
    function _payPrefund(
        uint256 missingAccountFunds
    ) internal virtual override {
        if (missingAccountFunds != 0) {
            _currentSafe().execTransactionFromModule(
                address(entryPoint()),
                missingAccountFunds,
                "",
                0
            );
        }
    }

    /**
     * Ensures userOp nonce is sequential. Nonce uniqueness is already managed
     * by the EntryPoint. This function prevents using a “key” different from
     * the first “zero” key.
     * @param nonce to validate
     */
    function _validateNonce(uint256 nonce) internal pure override {
        if (nonce >= type(uint64).max) {
            revert NONCE_NOT_SEQUENTIAL();
        }
    }

    /**
     * Get the current safe.
     *
     * This can be a bit counter-intuitive. The safe only does a delegatecall
     * into the plugin during setup. In regular usage, it uses a regular call,
     * which is why we can use `msg.sender` to refer to the safe. Additionally,
     * `this` will be the plugin for those calls, so it won't work when trying
     * to do safe operations like `execTransactionFromModule`.
     */
    function _currentSafe() internal view virtual returns (ISafe) {
        return ISafe(msg.sender);
    }
}

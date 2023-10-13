// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;
pragma abicoder v2;

import {HandlerContext} from "safe-contracts/contracts/handler/HandlerContext.sol";

import {BaseAccount} from "account-abstraction/contracts/core/BaseAccount.sol";

interface ISafe {
    function enableModule(address module) external;

    function execTransactionFromModule(
        address to,
        uint256 value,
        bytes memory data,
        uint8 operation
    ) external returns (bool success);
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

    function _requireFromEntryPoint() internal virtual view override {
        require(
            _msgSender() == address(entryPoint()),
            "account: not from EntryPoint"
        );
    }

    function _requireFromCurrentSafeOrEntryPoint() internal virtual view {
        require(
            _msgSender() == address(entryPoint()) ||
            _msgSender() == address(_currentSafe()),
            "account: not from EntryPoint"
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
    function _currentSafe() internal virtual view returns (ISafe) {
        return ISafe(msg.sender);
    }
}

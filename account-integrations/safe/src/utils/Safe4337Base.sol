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

    /**
     * ensure the request comes from the known entrypoint.
     */
    function _requireFromEntryPoint() internal virtual view override {
        require(
            _msgSender() == address(entryPoint()),
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
            _thisSafe().execTransactionFromModule(
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

    function _thisSafe() internal virtual view returns (ISafe) {
        // There is some confusion about whether `msg.sender` should be used
        // instead of `this` for referring to the current Safe. There is a PR
        // here to get feedback from Safe about this:
        //   https://github.com/safe-global/safe-contracts/pull/682
        return ISafe(address(this));
    }
}

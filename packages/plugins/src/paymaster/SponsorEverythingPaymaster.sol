// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

import {IEntryPoint} from 'account-abstraction/interfaces/IEntryPoint.sol';

import {BasePaymaster} from 'account-abstraction/core/BasePaymaster.sol';
import {UserOperationLib} from 'account-abstraction/core/UserOperationLib.sol';
import {PackedUserOperation} from 'account-abstraction/interfaces/PackedUserOperation.sol';

/*//////////////////////////////////////////////////////////////////////////
    THIS CONTRACT IS STILL IN ACTIVE DEVELOPMENT. NOT FOR PRODUCTION USE        
//////////////////////////////////////////////////////////////////////////*/

/// @title This paymaster sponsors everything.
contract SponsorEverythingPaymaster is BasePaymaster {
    using UserOperationLib for PackedUserOperation;

    constructor(IEntryPoint _entryPoint) BasePaymaster(_entryPoint) {}

    /**
     * Validate a user operation.
     * @param userOp     - The user operation.
     * @param userOpHash - The hash of the user operation.
     * @param maxCost    - The maximum cost of the user operation.
     */
    function _validatePaymasterUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    ) internal virtual override returns (bytes memory context, uint256 validationData) {
        // Validation logic comes here.
        // Approve everything.
        return ("", 0);
    }
}

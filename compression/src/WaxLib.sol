//SPDX-License-Identifier: Unlicense
pragma solidity >=0.7.0 <0.9.0;
pragma abicoder v2;

library WaxLib {
    struct Action {
        address to;
        uint256 value;
        bytes data;
    }

    error ActionError(uint256 i, bytes result);

    address constant contractCreationAddress = address(bytes20(
        keccak256("Placeholder address to signal contract creation.")
    ));
}

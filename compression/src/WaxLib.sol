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

    function oneAction(
        address to,
        uint256 value,
        bytes memory data
    ) internal pure returns (Action[] memory) {
        Action[] memory actions = new Action[](1);
        actions[0] = Action({ to: to, value: value, data: data });

        return actions;
    }
}

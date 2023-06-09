//SPDX-License-Identifier: Unlicense
pragma solidity >=0.7.0 <0.9.0;
pragma abicoder v2;

import {WaxLib as WL} from "./WaxLib.sol";

contract DemoWallet {
    error ActionError(uint256 i, bytes result);

    address public owner;

    constructor(address ownerParam) {
        owner = ownerParam;
    }

    function perform(
        WL.Action[] calldata actions
    ) public isTrusted returns (bytes[] memory) {
        bytes[] memory results = new bytes[](actions.length);

        for (uint256 i = 0; i < actions.length; i++) {
            WL.Action calldata a = actions[i];

            if (a.to != WL.contractCreationAddress) {
                (bool success, bytes memory result) = payable(a.to)
                    .call{value: a.value}(a.data);

                if (!success) {
                    revert ActionError(i, result);
                }

                results[i] = result;
            } else {
                address addr;
                uint256 value = a.value;
                bytes memory data = a.data;
                
                assembly {
                    addr := create(
                        value,
                        add(data, 0x20),
                        mload(data)
                    )

                    if iszero(addr) {
                        revert(0, 0)
                    }
                }

                results[i] = abi.encode(addr);
            }
        }

        return results;
    }

    modifier isTrusted() {
        require(msg.sender == owner);
        _;
    }
}

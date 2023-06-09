//SPDX-License-Identifier: Unlicense
pragma solidity >=0.7.0 <0.9.0;
pragma abicoder v2;

import "forge-std/console.sol";

contract DeployTester {
    uint256 public x;
    address public addr;

    constructor(uint256 xParam, address addrParam) payable {
        require(msg.value == 1 ether);

        x = xParam;
        addr = addrParam;
    }
}

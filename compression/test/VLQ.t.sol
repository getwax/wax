// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.13;

import "forge-std/Test.sol";
import "../src/VLQ.sol";

contract VLQTest is Test {
    function test_0x00_is_0() public {
        (uint256 value, ) = this.decode(hex"00");

        assertEq(value, 0);
    }

    function decode(bytes calldata stream) public pure returns (uint256, bytes calldata) {
        return VLQ.decode(stream);
    }
}

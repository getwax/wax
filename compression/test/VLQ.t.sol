// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.13;

import "forge-std/Test.sol";
import "../src/VLQ.sol";

contract VLQTest is Test {
    function test_0x00_is_0() public {
        check(hex"00", 0);
    }

    function check(bytes memory input, uint256 output) internal {
        (uint256 value, bytes memory stream) = this.decode(input);

        assertEq(value, output);
        assertEq(stream.length, 0);
    }

    /**
     * This indirection allows making an external call, which converts bytes
     * memory into the required bytes calldata.
     */
    function decode(bytes calldata stream) public pure
        returns (uint256, bytes calldata)
    {
        return VLQ.decode(stream);
    }
}


// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.13;

import "forge-std/Test.sol";
import "../src/VLQ.sol";

contract VLQTest is Test {
    function test_0x00_is_0() public {
        check(hex"00", 0);
    }

    function test_0x8203_is_259() public {
        check(hex"8203", 259);
    }

    function test_0x828003_is_32771() public {
        check(hex"828003", 32_771);
    }

    function test_leftover_bytes() public {
        (uint256 value, bytes memory stream) = this.decode(hex"828003aabbccdd");

        assertEq(value, 32_771);
        assertEq(stream, hex"aabbccdd");
    }

    function test_variety() public {
        check(hex"01", 1);
        check(hex"21", 33);
        check(hex"812d", 173);
        check(hex"830b", 395);
        check(hex"9b77", 3575);
        check(hex"828c38", 34360);
        check(hex"8ba97d", 185597);
        check(hex"a6b733", 629683);
        check(hex"8289cd75", 4351733);
        check(hex"8a8adc18", 21147160);
        check(hex"c0e9c01c", 135946268);
        check(hex"898b81f649", 2439019337);
        check(hex"9fbdb29c75", 8450248309);
        check(hex"81bdaeaa9c26", 50831461926);
        check(hex"8881ccb59157", 275306596567);
        check(hex"f38fe8c9ed29", 3955615757993);
        check(hex"8899b5a9cca66f", 36057679860591);
        check(hex"ad83bdebf7d646", 198031773133638);
        check(hex"82d8c794f3abd718", 1515373151841176);
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


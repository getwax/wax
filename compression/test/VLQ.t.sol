// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.13;

import "forge-std/Test.sol";
import {VLQ} from "../src/VLQ.sol";

contract VLQTest is Test {
    function test_0x00_is_0() public {
        checkEqual(0, hex"00");
    }

    function test_0x8203_is_259() public {
        checkEqual(259, hex"8203");
    }

    function test_0x828003_is_32771() public {
        checkEqual(32_771, hex"828003");
    }

    function test_leftover_bytes() public {
        (uint256 value, bytes memory stream) = this.decode(hex"828003aabbccdd");

        assertEq(value, 32_771);
        assertEq(stream, hex"aabbccdd");
    }

    function test_variety() public {
        checkEqual(1, hex"01");
        checkEqual(33, hex"21");
        checkEqual(173, hex"812d");
        checkEqual(395, hex"830b");
        checkEqual(3575, hex"9b77");
        checkEqual(34360, hex"828c38");
        checkEqual(185597, hex"8ba97d");
        checkEqual(629683, hex"a6b733");
        checkEqual(4351733, hex"8289cd75");
        checkEqual(21147160, hex"8a8adc18");
        checkEqual(135946268, hex"c0e9c01c");
        checkEqual(2439019337, hex"898b81f649");
        checkEqual(8450248309, hex"9fbdb29c75");
        checkEqual(50831461926, hex"81bdaeaa9c26");
        checkEqual(275306596567, hex"8881ccb59157");
        checkEqual(3955615757993, hex"f38fe8c9ed29");
        checkEqual(36057679860591, hex"8899b5a9cca66f");
        checkEqual(198031773133638, hex"ad83bdebf7d646");
        checkEqual(1515373151841176, hex"82d8c794f3abd718");
    }

    function checkEqual(uint256 value, bytes memory encoded) internal {
        (uint256 decodedValue, bytes memory stream) = this.decode(encoded);

        assertEq(decodedValue, value);
        assertEq(stream.length, 0);

        bytes memory encodedValue = VLQ.encode(value);
        assertEq(encodedValue.length, encoded.length);

        for (uint256 i = 0; i < encodedValue.length; i++) {
            assertEq(encodedValue[i], encoded[i]);
        }
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


//SPDX-License-Identifier: Unlicense
pragma solidity >=0.7.0 <0.9.0;
pragma abicoder v2;

library BitStack {
    // The most significant bit of a bit stack signals the end of the stack.
    // Otherwise there would be an infinite number of ambiguous zeros. This
    // often doesn't matter, but it's useful for reversing bit stacks.
    uint256 constant empty = 1;

    function push(uint256 bitStack, bool bit) internal pure returns (uint256) {
        bitStack <<= 1;
        bitStack += bit ? 1 : 0;

        return bitStack;
    }

    function pop(uint256 bitStack) internal pure returns (bool, uint256) {
        return ((bitStack & 1) == 1, bitStack >> 1);
    }

    function reverse(uint256 bitStack) internal pure returns (uint256) {
        uint256 reverseBitStack = 1;

        while (bitStack != 1) {
            reverseBitStack <<= 1;
            reverseBitStack += (bitStack & 1);
            bitStack >>= 1;
        }

        return reverseBitStack;
    }
}

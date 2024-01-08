//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

contract FeeMeasurer {
    // Note: Linter wants to restrict this to pure but that prevents calling this
    // in an actual transaction.
    function useGas(uint8 size) external {
        require(size != 0, "Size zero works differently due to zero-byte");

        uint256 iterations = 100 * uint256(size);

        for (uint256 i = 0; i < iterations; i++) {}
    }

    function useGasOrdinaryGasUsed(uint8 size) public pure returns (uint256) {
        require(size != 0, "Size zero works differently due to zero-byte");

        return 21629 + 11100 * uint256(size);
    }

    function fallbackOrdinaryGasUsed(
        uint256 nonZeroDataLen
    ) public pure returns (uint256) {
        uint256 result = 21064 + 16 * nonZeroDataLen;

        if (nonZeroDataLen >= 4) {
            // I think this is because a different branch is used if the data
            // might match a method id. Less than 4 bytes and it can't match.
            result += 78;
        }

        return result;
    }

    fallback() external {}
}

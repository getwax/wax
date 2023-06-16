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

    /**
     * Reverses a reverseBitStream to recover the regular bitStream.
     *
     * This is needed because it is most efficient to both read and write the
     * least significant bit of a bit stream. After writing a sequence of bits,
     * the next read would then be the last bit written instead of the first
     * bit written.
     *
     * A reverseBitStream should start with a special 1, to tell us when to
     * stop. Otherwise there are an infinite number of zeros and we don't know
     * whether they were intended or not.
     */
    function calculateOrderedBitStream(
        uint256 reverseBitStream
    ) internal pure returns (uint256) {
        uint256 bitStream = 0;

        while (reverseBitStream != 1) {
            bitStream <<= 1;
            bitStream += (reverseBitStream & 1);
            reverseBitStream >>= 1;
        }

        return bitStream;
    }
}

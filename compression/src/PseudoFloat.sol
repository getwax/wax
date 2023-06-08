//SPDX-License-Identifier: Unlicense
pragma solidity >=0.7.0 <0.9.0;
pragma abicoder v2;

import "./VLQ.sol";

/**
 * Like a float, but technically for integers. Also base 10.
 *
 * The pseudo-float is an encoding that can represent any uint256 value but
 * efficiently represents values with a small number of significant figures
 * (just 2 bytes for 3 significant figures).
 *
 * Zero is a special case, it's just 0x00.
 *
 * Otherwise, start with the value in scientific notation:
 *
 *     1.23 * 10^16 (e.g. 0.0123 ETH)
 *
 * Make the mantissa (1.23) a whole number by adjusting the exponent:
 *
 *     123 * 10^14
 *
 * We add 1 to the exponent and encode it in 5 bits:
 *
 *     01111 (=15)
 *
 *     Note: The maximum value we can encode here is 31 (11111). This means the
 *     maximum exponent is 30. Adjust the left side of the previous equation if
 *     needed.
 *
 * Encode the left side in binary:
 *
 *     1111011 (=123)
 *
 * Our first byte is the 5-bit exponent followed by the three lowest bits of the
 * mantissa:
 * 
 *     01111011
 *     ^^^^^-------- 15 => exponent is 14
 *          ^^^----- lowest 3 bits of the mantissa
 *
 * Encode the remaining bits of the mantissa as a VLQ:
 *
 *     00001111
 *     ^------------ special VLQ bit, zero indicates this is the last byte
 *      ^^^^^^^----- bits to use, put them together with 011 above to get
 *                   0001111011, which is 123.
 *
 * Putting it together is two bytes:
 *
 *     0x7b0f
 *
 * Example 2:
 *
 *     0.883887085 ETH uses 5 bytes: 0x55b4d7c27d
 *     883887085 * 10^9
 *     For exponent 9 we encode 10 as 5 bits: 01010
 *     883887085 is 110100101011110000101111101(101)
 *
 *     01010101 10110100 11010111 11000010 01111101
 *     ^^^^^------------------------------------------- 10 => exponent is 9
 *          ^^^---------------------------------------- lowest 3 bits
 *               ^^^^^^^--^^^^^^^--^^^^^^^--^^^^^^^     higher bits
 *              ^--------^--------^-------------------- 1 => not the last byte
 *                                         ^----------- 0 => the last byte
 *
 * Note that the *encode* process is described above for explanatory purposes.
 * On-chain we need to *decode* to recover the value from the encoded binary
 * instead.
 */
library PseudoFloat {
    function decode(
        bytes calldata stream
    ) internal pure returns (uint256, bytes calldata) {
        uint8 firstByte = uint8(stream[0]);

        if (firstByte == 0) {
            return (0, stream[1:]);
        }

        uint8 exponent = ((firstByte & 0xf8) >> 3) - 1;

        uint256 value;
        (value, stream) = VLQ.decode(stream[1:]);

        value <<= 3;
        value += firstByte & 0x07;

        value *= 10 ** exponent;

        return (value, stream);
    }

    function encode(uint256 value) internal pure returns (bytes memory) {
        if (value == 0) {
            return hex"00";
        }

        uint256 exponent = 0;

        while (value % 10 == 0 && exponent < 30) {
            value /= 10;
            exponent++;
        }

        uint8 firstByte = uint8(((exponent + 1) << 3) + (value & 0x07));
        value >>= 3;

        bytes memory vlqBytes = VLQ.encode(value);
        bytes memory res = new bytes(1 + vlqBytes.length);

        res[0] = bytes1(firstByte);

        for (uint256 i = 0; i < vlqBytes.length; i++) {
            res[1 + i] = vlqBytes[i];
        }

        return res;
    }
}

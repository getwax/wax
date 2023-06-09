//SPDX-License-Identifier: Unlicense
pragma solidity >=0.7.0 <0.9.0;
pragma abicoder v2;

import "./VLQ.sol";

/**
 * Registry Index
 * 
 * This is just a VLQ followed by 2 fixed bytes.
 * 
 * This format has a 3-byte minimum and allows for >8m indexes at 3 bytes. Exact
 * values are:
 * - 3 bytes: 2^23        =       8,388,608 indexes
 * - 4 bytes: 2^30 - 2^23 =   1,065,353,216 indexes
 * - 5 bytes: 2^37 - 2^30 = 136,365,211,648 indexes
 * (In theory, this goes all the way to uint256max, which uses 37 bytes.)
 *
 * This format has following advantages over VLQ:
 * - Provides 4x the number of indexes at each width.
 * - Avoids negative perception caused by the exclusivity of 1 and 2 byte
 *   indexes.
 * - Allows us to say 'we use 3 bytes' as a reasonable approximation, since this
 *   will be true for a long time. If asked, we can explain how this gracefully
 *   expands to additional bytes as they become needed.
 */
library RegIndex {
    function decode(
        bytes calldata stream
    ) internal pure returns (uint256, bytes calldata) {
        uint256 value;
        (value, stream) = VLQ.decode(stream);
        value <<= 16;

        value += (uint256(uint8(stream[0])) << 8);
        value += uint256(uint8(stream[1]));

        return (value, stream[2:]);
    }

    function encode(uint256 value) internal pure returns (bytes memory) {
        uint256 vlqValue = value >> 16;
        uint256 remainder = value & 0xffff;

        bytes memory vlqBytes = VLQ.encode(vlqValue);

        bytes memory res = new bytes(vlqBytes.length + 2);

        for (uint256 i = 0; i < vlqBytes.length; i++) {
            res[i] = vlqBytes[i];
        }

        res[res.length - 2] = bytes1(uint8(remainder >> 8));
        res[res.length - 1] = bytes1(uint8(remainder & 0xff));

        return res;
    }
}

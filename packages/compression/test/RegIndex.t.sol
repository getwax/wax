// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {RegIndex} from "../src/RegIndex.sol";

contract RegIndexTest is Test {
    function test_0_is_0x000000() public {
        checkEqual(0, hex"000000");
    }

    function test_1_is_0x000001() public {
        checkEqual(1, hex"000001");
    }

    function test_256_is_0x000100() public {
        checkEqual(256, hex"000100");
    }

    function test_3_byte_max() public {
        checkEqual(0, hex"000000");
        checkEqual(8_388_607, hex"7fffff");
    }

    function test_4_byte_min_max() public {
        checkEqual(8_388_608, hex"81000000");
        checkEqual(1_073_741_823, hex"ff7fffff");
    }

    function test_5_byte_min_max() public {
        checkEqual(1_073_741_824, hex"8180000000");
        checkEqual(137_438_953_471, hex"ffff7fffff");
    }

    function test_max_uint256() public {
        checkEqual(
            type(uint256).max,
            hex"83ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
            hex"ffffff7fffff"
        );
    }

    function test_variety() public {
        uint64[20] memory values = [
                                  3,
                                 26,
                                120,
                              1_357,
                              1_656,
                             74_775,
                            355_530,
                          4_639_402,
                          7_643_718,
                        336_168_140,
                      2_248_431_734,
                     14_108_050_677,
                     93_972_126_798,
                    758_745_242_416,
                 11_006_691_901_310,
                107_460_085_614_397,
                409_358_331_676_454,
              1_811_951_865_105_052,
             18_302_669_715_470_464,
            341_914_093_032_676_860
        ];

        for (uint256 i = 0; i < 20; i++) {
            checkEncodeAndDecode(values[i]);
        }
    }

    function checkEqual(uint256 value, bytes memory encoded) internal {
        (uint256 decodedValue, bytes memory stream) = this.decode(encoded);

        assertEq(decodedValue, value);
        assertEq(stream.length, 0);

        bytes memory encodedValue = RegIndex.encode(value);
        assertEq(encodedValue.length, encoded.length);

        for (uint256 i = 0; i < encodedValue.length; i++) {
            assertEq(encodedValue[i], encoded[i]);
        }
    }

    function checkEncodeAndDecode(uint256 value) internal {
        bytes memory encoded = RegIndex.encode(value);
        (uint256 decoded, bytes memory stream) = this.decode(encoded);

        assertEq(decoded, value);
        assertEq(stream.length, 0);
    }

    /**
     * This indirection allows making an external call, which converts bytes
     * memory into the required bytes calldata.
     */
    function decode(bytes calldata stream) public pure
        returns (uint256, bytes calldata)
    {
        return RegIndex.decode(stream);
    }
}

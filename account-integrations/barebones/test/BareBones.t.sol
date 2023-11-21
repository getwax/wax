// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Test, console2} from "forge-std/Test.sol";
import {BareBones} from "../src/BareBones.sol";
import {ECDSAVerifier} from "../src/verifiers/ECDSAVerifier.sol";

contract BareBonesTest is Test {
    BareBones public bareBones;
    ECDSAVerifier public ecdsaVerifier;

    function setUp() public {
        ecdsaVerifier = new ECDSAVerifier();
        bareBones = new BareBones(
            ecdsaVerifier,
            abi.encode(msg.sender)
        );

    }

    function test_EAO() public {

    }

    // function test_Increment() public {
    //     bareBones.increment();
    //     assertEq(bareBones.number(), 1);
    // }

    // function testFuzz_SetNumber(uint256 x) public {
    //     bareBones.setNumber(x);
    //     assertEq(bareBones.number(), x);
    // }
}

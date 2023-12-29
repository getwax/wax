// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Test, console2} from "forge-std/Test.sol";
import {BareBones} from "../src/BareBones.sol";
import {ECDSAVerifier, ECDSALib} from "../src/verifiers/ECDSAVerifier.sol";

contract BareBonesTest is Test {
    BareBones public bareBones;
    ECDSAVerifier public ecdsaVerifier;

    function setUp() public {
        ecdsaVerifier = new ECDSAVerifier();

    }

    function test_ECDSA() public {
        bareBones = new BareBones(
            ecdsaVerifier,
            abi.encode(msg.sender)
        );
        ECDSALib.ECDSAState memory adminState = ecdsaVerifier.state(bareBones.adminState());
        assertEq(adminState.owner, msg.sender);
    }

}

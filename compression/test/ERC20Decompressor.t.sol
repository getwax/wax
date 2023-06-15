// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";

import {ERC20Decompressor} from "../src/decompressors/ERC20Decompressor.sol";
import {AddressRegistry} from "../src/AddressRegistry.sol";
import {WaxLib as W} from "../src/WaxLib.sol";

import {SimpleERC20} from "./helpers/SimpleERC20.sol";

contract ERC20DecompressorTest is Test {
    uint256 constant oneToken = 1e18;

    AddressRegistry registry;
    ERC20Decompressor d;

    SimpleERC20 token = new SimpleERC20(
        "Token",
        "TOK",
        address(this),
        type(uint256).max
    );

    function setUp() public {
        registry = new AddressRegistry();
        d = new ERC20Decompressor(registry);

        registry.register(address(0xdead));
        registry.register(address(0xdead));
        registry.register(address(0xdead));
        registry.register(address(0xdead));

        registry.register(address(token)); // 4
        registry.register(address(0xa));   // 5
        registry.register(address(0xb));   // 6
        registry.register(address(0xc));   // 7
    }

    function test_transfer() public {
        bytes memory compressedActions = (
            hex"01"     // 1 action

            hex"03"     // Bit stream: 3 = 11 in binary
                        // - 1: Use registry for token
                        // - 1: Use registry for recipient

            hex"000004" // RegIndex for token's address
            hex"00"     // transfer
            hex"000005" // RegIndex for 0xa
            hex"9900"   // 1 token
        );

        (W.Action[] memory actions,) = d.decompress(compressedActions);

        assertEq(actions.length, 1);

        assertEq(actions[0].to, address(token));
        assertEq(actions[0].value, 0);

        assertEq(
            actions[0].data,
            abi.encodeCall(IERC20.transfer, (address(0xa), oneToken))
        );
    }

    function test_transferFrom() public {
        bytes memory compressedActions = (
            hex"01"     // 1 action

            hex"07"     // Bit stream: 7 = 111 in binary
                        // - 1: Use registry for token
                        // - 1: Use registry for sender
                        // - 1: Use registry for recipient

            hex"000004" // RegIndex for token's address
            hex"01"     // transferFrom
            hex"000005" // RegIndex for 0xa
            hex"000006" // RegIndex for 0xb
            hex"9900"   // 1 token
        );

        (W.Action[] memory actions,) = d.decompress(compressedActions);

        assertEq(actions.length, 1);

        assertEq(actions[0].to, address(token));
        assertEq(actions[0].value, 0);

        assertEq(
            actions[0].data,
            abi.encodeCall(IERC20.transferFrom, (
                address(0xa),
                address(0xb),
                oneToken
            ))
        );
    }

    function test_approve() public {
        bytes memory compressedActions = (
            hex"01"     // 1 action

            hex"03"     // Bit stream: 3 = 11 in binary
                        // - 1: Use registry for token
                        // - 1: Use registry for sender

            hex"000004" // RegIndex for token's address
            hex"02"     // approve
            hex"000005" // RegIndex for 0xa
            hex"9900"   // 1 token
        );

        (W.Action[] memory actions,) = d.decompress(compressedActions);

        assertEq(actions.length, 1);

        assertEq(actions[0].to, address(token));
        assertEq(actions[0].value, 0);

        assertEq(
            actions[0].data,
            abi.encodeCall(IERC20.approve, (
                address(0xa),
                oneToken
            ))
        );
    }

    function test_approveMax() public {
        bytes memory compressedActions = (
            hex"01"     // 1 action

            hex"03"     // Bit stream: 3 = 11 in binary
                        // - 1: Use registry for token
                        // - 1: Use registry for sender

            hex"000004" // RegIndex for token's address
            hex"03"     // approveMax
            hex"000005" // RegIndex for 0xa
        );

        (W.Action[] memory actions,) = d.decompress(compressedActions);

        assertEq(actions.length, 1);

        assertEq(actions[0].to, address(token));
        assertEq(actions[0].value, 0);

        assertEq(
            actions[0].data,
            abi.encodeCall(IERC20.approve, (
                address(0xa),
                type(uint256).max
            ))
        );
    }

    function test_mint() public {
        bytes memory compressedActions = (
            hex"01"     // 1 action

            hex"03"     // Bit stream: 3 = 11 in binary
                        // - 1: Use registry for token
                        // - 1: Use registry for recipient

            hex"000004" // RegIndex for token's address
            hex"04"     // mint
            hex"000005" // RegIndex for 0xa
            hex"9900"   // 1 token
        );

        (W.Action[] memory actions,) = d.decompress(compressedActions);

        assertEq(actions.length, 1);

        assertEq(actions[0].to, address(token));
        assertEq(actions[0].value, 0);

        assertEq(
            actions[0].data,
            abi.encodeWithSignature(
                "mint(address,uint256)",
                address(0xa),
                oneToken
            )
        );
    }
}

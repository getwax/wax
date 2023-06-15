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

        registry.register(address(token));
        registry.register(address(0xa));
        registry.register(address(0xb));
        registry.register(address(0xc));
    }

    function registeredAddresses()
        internal view returns (AddressRegistry.Entry[] memory)
    {
        AddressRegistry.Entry[] memory res = new AddressRegistry.Entry[](4);

        res[0] = AddressRegistry.Entry({ id: 4, addr: address(token) });
        res[1] = AddressRegistry.Entry({ id: 5, addr: address(0xa) });
        res[2] = AddressRegistry.Entry({ id: 6, addr: address(0xb) });
        res[3] = AddressRegistry.Entry({ id: 7, addr: address(0xc) });

        return res;
    }

    function test_transfer() public {
        check(
            W.oneAction(
                address(token),
                0,
                abi.encodeCall(IERC20.transfer, (address(0xa), oneToken))
            ),
            hex"01"     // 1 action

            hex"03"     // Bit stream: 3 = 11 in binary
                        // - 1: Use registry for token
                        // - 1: Use registry for recipient

            hex"000004" // RegIndex for token's address
            hex"00"     // transfer
            hex"000005" // RegIndex for 0xa
            hex"9900"   // 1 token
        );
    }

    function test_transferFrom() public {
        check(
            W.oneAction(
                address(token),
                0,
                abi.encodeCall(IERC20.transferFrom, (
                    address(0xa),
                    address(0xb),
                    oneToken
                ))
            ),
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
    }

    function test_approve() public {
        check(
            W.oneAction(
                address(token),
                0,
                abi.encodeCall(IERC20.approve, (
                    address(0xa),
                    oneToken
                ))
            ),
            hex"01"     // 1 action

            hex"03"     // Bit stream: 3 = 11 in binary
                        // - 1: Use registry for token
                        // - 1: Use registry for sender

            hex"000004" // RegIndex for token's address
            hex"02"     // approve
            hex"000005" // RegIndex for 0xa
            hex"9900"   // 1 token
        );
    }

    function test_approveMax() public {
        check(
            W.oneAction(
                address(token),
                0,
                abi.encodeCall(IERC20.approve, (
                    address(0xa),
                    type(uint256).max
                ))
            ),
            hex"01"     // 1 action

            hex"03"     // Bit stream: 3 = 11 in binary
                        // - 1: Use registry for token
                        // - 1: Use registry for sender

            hex"000004" // RegIndex for token's address
            hex"03"     // approveMax
            hex"000005" // RegIndex for 0xa
        );
    }

    function test_mint() public {
        check(
            W.oneAction(
                address(token),
                0,
                abi.encodeWithSignature(
                    "mint(address,uint256)",
                    address(0xa),
                    oneToken
                )
            ),
            hex"01"     // 1 action

            hex"03"     // Bit stream: 3 = 11 in binary
                        // - 1: Use registry for token
                        // - 1: Use registry for recipient

            hex"000004" // RegIndex for token's address
            hex"04"     // mint
            hex"000005" // RegIndex for 0xa
            hex"9900"   // 1 token
        );
    }

    function check(
        W.Action[] memory actions,
        bytes memory compressedActions
    ) internal {
        assertEq(
            d.compress(actions, registeredAddresses()),
            compressedActions
        );

        (W.Action[] memory decompressedActions,) =
            d.decompress(compressedActions);

        assertEq(
            abi.encode(decompressedActions),
            abi.encode(actions)
        );
    }
}

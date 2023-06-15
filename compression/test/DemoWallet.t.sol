// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";

import {SimpleERC20} from "./helpers/SimpleERC20.sol";
import {DemoWallet} from "../src/DemoWallet.sol";
import {WaxLib as W} from "../src/WaxLib.sol";
import {EchoDecompressor} from "../src/decompressors/EchoDecompressor.sol";
import {SimpleDecompressor} from "../src/decompressors/SimpleDecompressor.sol";
import {SwitchDecompressor} from "../src/decompressors/SwitchDecompressor.sol";
import {FallbackDecompressor} from "../src/decompressors/FallbackDecompressor.sol";
import {PseudoFloat} from "../src/PseudoFloat.sol";
import {AddressRegistry} from "../src/AddressRegistry.sol";

import {DeployTester} from "./helpers/DeployTester.sol";

contract DemoWalletTest is Test {
    SimpleERC20 token = new SimpleERC20(
        "Token",
        "TOK",
        address(this),
        type(uint256).max
    );

    function test_send_eth() public {
        DemoWallet w = new DemoWallet(address(this));
        vm.deal(address(w), 100 ether);

        W.Action[] memory actions = new W.Action[](1);

        actions[0] = W.Action({
            to: address(0),
            value: 1 ether,
            data: ""
        });

        w.perform(actions);

        assertEq(address(w).balance, 99 ether);
        assertEq(address(0).balance, 1 ether);
    }

    function test_call() public {
        DemoWallet w = new DemoWallet(address(this));
        token.transfer(address(w), 100e18);

        W.Action[] memory actions = new W.Action[](1);

        actions[0] = W.Action({
            to: address(token),
            value: 0,
            data: abi.encodeWithSignature(
                "transfer(address,uint256)",
                address(1),
                1e18
            )
        });

        w.perform(actions);

        assertEq(token.balanceOf(address(w)), 99e18);
        assertEq(token.balanceOf(address(1)), 1e18);
    }

    function test_deploy() public {
        DemoWallet w = new DemoWallet(address(this));
        vm.deal(address(w), 100 ether);

        W.Action[] memory actions = new W.Action[](1);

        actions[0] = W.Action({
            to: W.contractCreationAddress,
            value: 1 ether,
            data: abi.encodePacked(
                type(DeployTester).creationCode,
                abi.encode(123, address(456))
            )
        });

        bytes[] memory results = w.perform(actions);
        DeployTester dt = abi.decode(results[0], (DeployTester));

        assertEq(address(dt).balance, 1 ether);
        assertEq(dt.x(), 123);
        assertEq(dt.addr(), address(456));
    }

    function test_echo_decompressor() public {
        DemoWallet w = new DemoWallet(address(this));
        EchoDecompressor ed = new EchoDecompressor();

        vm.deal(address(w), 100 ether);

        W.Action[] memory actions = new W.Action[](1);

        actions[0] = W.Action({
            to: address(w),
            value: 0,
            data: abi.encodeCall(w.setDecompressor, ed)
        });

        w.perform(actions);

        assertEq(address(w.decompressor()), address(ed));

        actions[0] = W.Action({
            to: address(0),
            value: 1 ether,
            data: ""
        });

        w.decompressAndPerform(abi.encode(actions));

        assertEq(address(w).balance, 99 ether);
        assertEq(address(0).balance, 1 ether);

        // Much more efficient version of the above, but it only works if we
        // successfully hit the fallback function. Wallets need to check they
        // don't accidentally encode a method call (very rare, but possible).
        (bool success,) = address(w).call(abi.encode(actions));
        assertEq(success, true);

        assertEq(address(w).balance, 98 ether);
        assertEq(address(0).balance, 2 ether);
    }

    function test_receive() public {
        DemoWallet w = new DemoWallet(address(this));

        vm.deal(address(this), 100 ether);
        (bool success,) = address(w).call{value: 1 ether}("");

        assertEq(success, true);
        assertEq(address(this).balance, 99 ether);
        assertEq(address(w).balance, 1 ether);
    }

    function test_simple_decompressor() public {
        DemoWallet w = new DemoWallet(address(this));
        SimpleDecompressor sd = new SimpleDecompressor();

        vm.deal(address(w), 100 ether);

        W.Action[] memory actions = new W.Action[](1);

        actions[0] = W.Action({
            to: address(w),
            value: 0,
            data: abi.encodeCall(w.setDecompressor, sd)
        });

        w.perform(actions);

        assertEq(address(w.decompressor()), address(sd));

        (bool success,) = address(w).call(
            hex"03" // 3 actions

            hex"0000000000000000000000000000000000000000"
            hex"9900" // 1 ETH
            hex"00"   // Zero bytes of data

            hex"0000000000000000000000000000000000000001"
            hex"9900" // 1 ETH
            hex"00"   // Zero bytes of data

            hex"0000000000000000000000000000000000000002"
            hex"9900" // 1 ETH
            hex"00"   // Zero bytes of data
        );

        assertEq(success, true);

        assertEq(address(w).balance, 97 ether);
        assertEq(address(0).balance, 1 ether);
        assertEq(address(1).balance, 1 ether);
        assertEq(address(2).balance, 1 ether);
    }

    function test_switch_decompressor() public {
        DemoWallet w = new DemoWallet(address(this));
        SwitchDecompressor sd = new SwitchDecompressor();
        AddressRegistry registry = new AddressRegistry();
        sd.register(new FallbackDecompressor(registry));

        vm.deal(address(w), 100 ether);

        W.Action[] memory actions = new W.Action[](1);

        actions[0] = W.Action({
            to: address(w),
            value: 0,
            data: abi.encodeCall(w.setDecompressor, sd)
        });

        w.perform(actions);

        assertEq(address(w.decompressor()), address(sd));

        registry.register(address(0xa));
        registry.register(address(0xb));
        registry.register(address(0xc));

        (bool success,) = address(w).call(
            hex"00" // Use FallbackDecompressor

            hex"03" // 3 actions

            hex"05" // Bit stream: 5 = 101 (in binary)
                    // - 1: Use registry for first action
                    // - 0: Don't use registry for second action
                    // - 1: Use registry for third action

            hex"000000" // Registry index of 0xa
            hex"9900"   // 1 ETH
            hex"00"     // Zero bytes of data

            hex"000000000000000000000000000000000000000b"
            hex"9900"   // 1 ETH
            hex"00"     // Zero bytes of data

            hex"000002" // Registry index of 0xc
            hex"9900"   // 1 ETH
            hex"00"     // Zero bytes of data
        );

        assertEq(success, true);

        assertEq(address(w).balance, 97 ether);
        assertEq(address(0xa).balance, 1 ether);
        assertEq(address(0xb).balance, 1 ether);
        assertEq(address(0xc).balance, 1 ether);
    }
}

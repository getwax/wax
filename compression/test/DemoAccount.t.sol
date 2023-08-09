// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";

import {SimpleERC20} from "./helpers/SimpleERC20.sol";
import {DemoAccount} from "../src/DemoAccount.sol";
import {WaxLib as W} from "../src/WaxLib.sol";
import {EchoDecompressor} from "../src/decompressors/EchoDecompressor.sol";
import {SimpleDecompressor} from "../src/decompressors/SimpleDecompressor.sol";
import {SwitchDecompressor} from "../src/decompressors/SwitchDecompressor.sol";
import {FallbackDecompressor} from "../src/decompressors/FallbackDecompressor.sol";
import {PseudoFloat} from "../src/PseudoFloat.sol";
import {AddressRegistry} from "../src/AddressRegistry.sol";

import {DeployTester} from "./helpers/DeployTester.sol";

contract DemoAccountTest is Test {
    SimpleERC20 token = new SimpleERC20(
        "Token",
        "TOK",
        address(this),
        type(uint256).max
    );

    function test_send_eth() public {
        DemoAccount acc = new DemoAccount(address(this));
        vm.deal(address(acc), 100 ether);

        acc.perform(W.oneAction(address(0), 1 ether, ""));

        assertEq(address(acc).balance, 99 ether);
        assertEq(address(0).balance, 1 ether);
    }

    function test_call() public {
        DemoAccount acc = new DemoAccount(address(this));
        token.transfer(address(acc), 100e18);

        acc.perform(W.oneAction(
            address(token),
            0,
            abi.encodeWithSignature(
                "transfer(address,uint256)",
                address(1),
                1e18
            )
        ));

        assertEq(token.balanceOf(address(acc)), 99e18);
        assertEq(token.balanceOf(address(1)), 1e18);
    }

    function test_deploy() public {
        DemoAccount acc = new DemoAccount(address(this));
        vm.deal(address(acc), 100 ether);

        bytes[] memory results = acc.perform(W.oneAction(
            W.contractCreationAddress,
            1 ether,
            abi.encodePacked(
                type(DeployTester).creationCode,
                abi.encode(123, address(456))
            )
        ));

        DeployTester dt = abi.decode(results[0], (DeployTester));

        assertEq(address(dt).balance, 1 ether);
        assertEq(dt.x(), 123);
        assertEq(dt.addr(), address(456));
    }

    function test_echo_decompressor() public {
        DemoAccount acc = new DemoAccount(address(this));
        EchoDecompressor ed = new EchoDecompressor();

        vm.deal(address(acc), 100 ether);

        acc.perform(W.oneAction(
            address(acc),
            0,
            abi.encodeCall(acc.setDecompressor, ed)
        ));

        assertEq(address(acc.decompressor()), address(ed));

        bytes memory abiEncodedActions = abi.encode(W.oneAction(
            address(0),
            1 ether,
            ""
        ));

        acc.decompressAndPerform(abiEncodedActions);

        assertEq(address(acc).balance, 99 ether);
        assertEq(address(0).balance, 1 ether);

        // Much more efficient version of the above, but it only works if we
        // successfully hit the fallback function. Wallets need to check they
        // don't accidentally encode a method call (very rare, but possible).
        (bool success,) = address(acc).call(abiEncodedActions);
        assertEq(success, true);

        assertEq(address(acc).balance, 98 ether);
        assertEq(address(0).balance, 2 ether);
    }

    function test_receive() public {
        DemoAccount acc = new DemoAccount(address(this));

        vm.deal(address(this), 100 ether);
        (bool success,) = address(acc).call{value: 1 ether}("");

        assertEq(success, true);
        assertEq(address(this).balance, 99 ether);
        assertEq(address(acc).balance, 1 ether);
    }

    function test_simple_decompressor() public {
        DemoAccount acc = new DemoAccount(address(this));
        SimpleDecompressor sd = new SimpleDecompressor();

        vm.deal(address(acc), 100 ether);

        W.Action[] memory actions = new W.Action[](1);

        actions[0] = W.Action({
            to: address(acc),
            value: 0,
            data: abi.encodeCall(acc.setDecompressor, sd)
        });

        acc.perform(actions);

        assertEq(address(acc.decompressor()), address(sd));

        actions = new W.Action[](3);

        actions[0] = W.Action({
            to: address(0),
            value: 1 ether,
            data: ""
        });

        actions[1] = W.Action({
            to: address(1),
            value: 1 ether,
            data: ""
        });

        actions[2] = W.Action({
            to: address(2),
            value: 1 ether,
            data: ""
        });

        bytes memory compressedActions = (
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

        assertEq(sd.compress(actions), compressedActions);

        (bool success,) = address(acc).call(compressedActions);

        assertEq(success, true);

        assertEq(address(acc).balance, 97 ether);
        assertEq(address(0).balance, 1 ether);
        assertEq(address(1).balance, 1 ether);
        assertEq(address(2).balance, 1 ether);
    }

    function test_switch_decompressor() public {
        DemoAccount acc = new DemoAccount(address(this));
        SwitchDecompressor sd = new SwitchDecompressor();
        AddressRegistry registry = new AddressRegistry();
        FallbackDecompressor fd = new FallbackDecompressor(registry);
        sd.register(fd);

        vm.deal(address(acc), 100 ether);

        acc.perform(W.oneAction(
            address(acc),
            0,
            abi.encodeCall(acc.setDecompressor, sd)
        ));

        assertEq(address(acc.decompressor()), address(sd));

        registry.register(address(0xa));
        registry.register(address(0xb));
        registry.register(address(0xc));

        AddressRegistry.Entry[] memory entries =
            new AddressRegistry.Entry[](2);

        entries[0] = AddressRegistry.Entry({ id: 0, addr: address(0xa) });
        // 1 -> 0xb is excluded to demonstrate that addresses can also be
        // directly encoded
        entries[1] = AddressRegistry.Entry({ id: 2, addr: address(0xc) });

        W.Action[] memory actions = new W.Action[](3);

        actions = new W.Action[](3);

        actions[0] = W.Action({
            to: address(0xa),
            value: 1 ether,
            data: ""
        });

        actions[1] = W.Action({
            to: address(0xb),
            value: 1 ether,
            data: ""
        });

        actions[2] = W.Action({
            to: address(0xc),
            value: 1 ether,
            data: ""
        });

        bytes memory compressedActions = (
            hex"00" // Use FallbackDecompressor

            hex"03" // 3 actions

            hex"0d" // Bit stream: d = 1101 (in binary)
                    // - 1: Use registry for first action
                    // - 0: Don't use registry for second action
                    // - 1: Use registry for third action
                    // - 1: End of stack

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

        assertEq(
            sd.compress(0, fd.compress(actions, entries)),
            compressedActions
        );

        (bool success,) = address(acc).call(compressedActions);

        assertEq(success, true);

        assertEq(address(acc).balance, 97 ether);
        assertEq(address(0xa).balance, 1 ether);
        assertEq(address(0xb).balance, 1 ether);
        assertEq(address(0xc).balance, 1 ether);
    }
}

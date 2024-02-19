// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {HandleAggregatedOpsCaller} from "../src/HandleAggregatedOpsCaller.sol";
import {AddressRegistry} from "../src/AddressRegistry.sol";
import {UserOperation, UserOpsPerAggregator} from "../src/I4337.sol";

import {MockEntryPoint} from "./helpers/MockEntryPoint.sol";
import {MockAggregator} from "./helpers/MockAggregator.sol";

contract HandleAggregatedOpsCallerTest is Test {
    MockEntryPoint entryPoint;
    MockAggregator aggregator;
    AddressRegistry registry;
    HandleAggregatedOpsCaller handleAggregatedOpsCaller;

    bytes signature = (
        hex"000102030405060708090a0b0c0d0e0f"
        hex"101112131415161718191a1b1c1d1e1f"
        hex"202122232425262728292a2b2c2d2e2f"
        hex"303132333435363738393a3b3c3d3e3f"
    );

    function setUp() public {
        entryPoint = new MockEntryPoint();
        aggregator = new MockAggregator();
        registry = new AddressRegistry();

        handleAggregatedOpsCaller = new HandleAggregatedOpsCaller(
            entryPoint,
            payable(address(this)),
            aggregator,
            registry
        );

        registry.register(address(0xdead));
        registry.register(address(0xdead));
        registry.register(address(0xdead));
        registry.register(address(0xdead));

        registry.register(address(0xa));
        registry.register(address(0xb));
        registry.register(address(0xc));
    }

    function test_one() public {
        (bool success,) = address(handleAggregatedOpsCaller).call(bytes.concat(
            hex"01" // one operation
            hex"11" // bit stack: (1)0001
                    // - 1: use registry for sender
                    // - 0: no initCode
                    // - 0: don't encode decompressAndPerform
                    // - 0: no paymaster
                    // - 1: end of stack

            hex"000004" // sender = 0xa via registry
            hex"03" // nonce = 3

            hex"0b" // 11 bytes of calldata
            hex"000102030405060708090a" // calldata

            hex"1f53" // callGasLimit = 67,100
            hex"2500" // verificationGasLimit = 5,000
            hex"2b0f" // preVerificationGas = 1,230,000

            hex"3900" // maxFeePerGas = 0.001 gwei
            hex"3100" // maxPriorityFeePerGas = 0.0001 gwei
            ,

            signature
        ));

        assertEq(success, true);

        UserOperation[] memory ops = new UserOperation[](1);

        ops[0] = UserOperation({
            sender: address(0xa),
            nonce: 3,
            initCode: hex"",
            callData: hex"000102030405060708090a",
            callGasLimit: 67_100,
            verificationGasLimit: 5_000,
            preVerificationGas: 1_230_000,
            maxFeePerGas: 1_000_000,
            maxPriorityFeePerGas: 100_000,
            paymasterAndData: hex"",
            signature: hex""
        });

        UserOpsPerAggregator[] memory bundle = new UserOpsPerAggregator[](1);

        bundle[0] = UserOpsPerAggregator({
            userOps: ops,
            aggregator: aggregator,
            signature: signature
        });

        assertEq(
            entryPoint.handleAggregatedOpsParams(),
            abi.encode(bundle, payable(address(this)))
        );
    }

    function test_decompressAndPerform() public {
        (bool success,) = address(handleAggregatedOpsCaller).call(bytes.concat(
            hex"01" // one operation
            hex"15" // bit stack: (1)0101
                    // - 1: use registry for sender
                    // - 0: no initCode
                    // - 1: encode decompressAndPerform
                    // - 0: no paymaster
                    // - 1: end of stack

            hex"000004" // sender = 0xa via registry
            hex"03" // nonce = 3

            hex"0b" // 11 bytes of calldata
            hex"000102030405060708090a" // calldata

            hex"1f53" // callGasLimit = 67,100
            hex"2500" // verificationGasLimit = 5,000
            hex"2b0f" // preVerificationGas = 1,230,000

            hex"3900" // maxFeePerGas = 0.001 gwei
            hex"3100" // maxPriorityFeePerGas = 0.0001 gwei
            ,

            signature
        ));

        assertEq(success, true);

        UserOperation[] memory ops = new UserOperation[](1);

        ops[0] = UserOperation({
            sender: address(0xa),
            nonce: 3,
            initCode: hex"",
            callData: (
                // Method signature of decompressAndPerform(bytes)
                hex"2d1634c5"

                // Location of bytes argument
                hex"0000000000000000000000000000000000000000000000000000000000000020"

                // Length of bytes argument
                hex"000000000000000000000000000000000000000000000000000000000000000b"

                // Actual data to be decompressed inside account
                hex"000102030405060708090a"

                // Padding
                hex"000000000000000000000000000000000000000000"
            ),
            callGasLimit: 67_100,
            verificationGasLimit: 5_000,
            preVerificationGas: 1_230_000,
            maxFeePerGas: 1_000_000,
            maxPriorityFeePerGas: 100_000,
            paymasterAndData: hex"",
            signature: hex""
        });

        UserOpsPerAggregator[] memory bundle = new UserOpsPerAggregator[](1);

        bundle[0] = UserOpsPerAggregator({
            userOps: ops,
            aggregator: aggregator,
            signature: signature
        });

        assertEq(
            entryPoint.handleAggregatedOpsParams(),
            abi.encode(bundle, payable(address(this)))
        );
    }
}

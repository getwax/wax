// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {HandleOpsCaller} from "../src/HandleOpsCaller.sol";
import {AddressRegistry} from "../src/AddressRegistry.sol";
import {UserOperation, UserOpsPerAggregator} from "../src/I4337.sol";

import {MockEntryPoint} from "./helpers/MockEntryPoint.sol";
import {MockAggregator} from "./helpers/MockAggregator.sol";

contract HandleOpsCallerTest is Test {
    MockEntryPoint entryPoint;
    AddressRegistry registry;
    HandleOpsCaller handleOpsCaller;

    bytes signature = (
        hex"0102030405"
    );

    function setUp() public {
        entryPoint = new MockEntryPoint();
        registry = new AddressRegistry();

        handleOpsCaller = new HandleOpsCaller(
            entryPoint,
            payable(address(this)),
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
        (bool success,) = address(handleOpsCaller).call(bytes.concat(
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

            hex"05"   // 5 bytes for signature
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
            signature: signature
        });

        assertEq(
            entryPoint.handleOpsParams(),
            abi.encode(ops, payable(address(this)))
        );
    }

    function test_decompressAndPerform() public {
        (bool success,) = address(handleOpsCaller).call(bytes.concat(
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
            hex"000102030405060708090a" // bytes of decompressAndPerform

            hex"1f53" // callGasLimit = 67,100
            hex"2500" // verificationGasLimit = 5,000
            hex"2b0f" // preVerificationGas = 1,230,000

            hex"3900" // maxFeePerGas = 0.001 gwei
            hex"3100" // maxPriorityFeePerGas = 0.0001 gwei

            hex"05"   // 5 bytes for signature
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
            signature: signature
        });

        assertEq(
            entryPoint.handleOpsParams(),
            abi.encode(ops, payable(address(this)))
        );
    }
}

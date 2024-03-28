// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {KernelFactory} from "kernel/src/factory/KernelFactory.sol";
import {Kernel, UserOperation, ECDSA} from "kernel/src/Kernel.sol";
import {ECDSAValidator} from "kernel/src/validator/ECDSAValidator.sol";
import {IKernelValidator} from "kernel/src/interfaces/IKernelValidator.sol";
import {KernelStorage} from "kernel/src/abstract/KernelStorage.sol";
import {KERNEL_VERSION, KERNEL_NAME} from "kernel/src/common/Constants.sol";
import {ExecutionDetail} from "kernel/src/common/Structs.sol";
import {TestExecutor} from "kernel/test/foundry/mock/TestExecutor.sol";
import {ERC4337Utils} from "kernel/test/foundry/utils/ERC4337Utils.sol";

import {IEntryPoint} from "I4337/interfaces/IEntryPoint.sol";
import {ENTRYPOINT_0_6_ADDRESS, ENTRYPOINT_0_6_BYTECODE, CREATOR_0_6_BYTECODE, CREATOR_0_6_ADDRESS} from "I4337/artifacts/EntryPoint_0_6.sol";
import {EntryPoint} from "account-abstraction/contracts/core/EntryPoint.sol";

import {BLSValidator} from "../../../src/kernel/BLSValidator.sol";
import "forge-std/Test.sol";

using ERC4337Utils for IEntryPoint;

contract BLSValidatorTest is Test {
    Kernel kernel;
    Kernel kernelImpl;
    KernelFactory factory;
    IEntryPoint entryPoint;
    IKernelValidator defaultValidator;
    address owner;
    uint256 ownerKey;
    address payable beneficiary;
    address factoryOwner;

    function setUp() public {
        (owner, ownerKey) = makeAddrAndKey("owner");
        (factoryOwner, ) = makeAddrAndKey("factoryOwner");
        beneficiary = payable(address(makeAddr("beneficiary")));
        
        vm.etch(ENTRYPOINT_0_6_ADDRESS, ENTRYPOINT_0_6_BYTECODE);
        entryPoint = IEntryPoint(payable(ENTRYPOINT_0_6_ADDRESS));
        vm.etch(CREATOR_0_6_ADDRESS, CREATOR_0_6_BYTECODE);

        kernelImpl = new Kernel(entryPoint);
        factory = new KernelFactory(factoryOwner, entryPoint);

        vm.startPrank(factoryOwner);
        factory.setImplementation(address(kernelImpl), true);
        vm.stopPrank();

        defaultValidator = new ECDSAValidator();

        bytes memory initializeData = abi.encodeWithSelector(KernelStorage.initialize.selector, defaultValidator, abi.encodePacked(owner));
        kernel = Kernel(payable(address(factory.createAccount(address(kernelImpl), initializeData, 0))));
        vm.deal(address(kernel), 1e30);
    }

    function test_mode_2_bls() external {
        BLSValidator blsValidator = new BLSValidator();
        TestExecutor testExecutor = new TestExecutor();

        uint48 validAfter = uint48(0);
        uint48 validUntil = uint48(0);
        bytes4 executionSig = TestExecutor.doNothing.selector;

        UserOperation memory op =
            entryPoint.fillUserOp(address(kernel), abi.encodePacked(executionSig));

        // BLS public/private key pair and signatures created using the '@thehubbleproject/bls' library.
        // Hard coded in the test because I don't know of a way to do this in solidity.
        uint256[4] memory blsPublicKey = [
            0x004b1d8408dcc643647e4f32a761853e873cd1da8ffc40f03b00647484b3498a,
            0x248b9979254108c9cbb2005739dc693f1694b7b2058942114a0ab4aa81723a6d,
            0x0edd89947147f52246e1dc3092b62c9020afca38d470b3b827e267c66350da93,
            0x2d3f8d5cc58f02219b73b70a0acf33778335e7b5f5c7bf98a1d596b9270e92bb
        ];

        bytes memory enableData = abi.encodePacked(
            blsPublicKey
        );

        bytes32 digest = getTypedDataHash(
            executionSig,
            validAfter,
            validUntil,
            address(blsValidator),
            address(testExecutor),
            enableData
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ownerKey, ECDSA.toEthSignedMessageHash(digest));
        bytes memory ecdsaSignature = abi.encodePacked(r, s, v);

        op.signature = abi.encodePacked(
            bytes4(0x00000002),
            validAfter,
            validUntil,
            address(blsValidator),
            address(testExecutor),
            uint256(enableData.length),
            enableData,
            ecdsaSignature.length,
            ecdsaSignature
        );

        // The signature is hardcoded because the userOpHash is signed outside
        // the test in a seperate script.
        // bytes32 hash = entryPoint.getUserOpHash(op);
        uint256[2] memory blsSignature = [
            0x24be0af8d5ea3090ede5bfb58d9a23fa094614f8e2e0ffeb6bea0cf17640cf53,
            0x2f12fff5b8d783745e12c641a4474917fefc03b93a30066ae8bd7c7ad6ad46ba
        ]; 
        // First signature is the ecdsa signature for the default (ecdsa) validator. We
        // need that signature to validate the BLSValidator for the kernel account.
        // Second signature is the BLS signature for the BLSValidator. We are calling
        // the TestExecutor with the BLSValidator as the validator.
        op.signature = bytes.concat(op.signature, abi.encodePacked(blsSignature));
        UserOperation[] memory ops = new UserOperation[](1);
        ops[0] = op;

        logGas(op);

        entryPoint.handleOps(ops, beneficiary);
    }

    function logGas(UserOperation memory op) internal returns (uint256 used) {
        try this.consoleGasUsage(op) {
            revert("should revert");
        } catch Error(string memory reason) {
            used = abi.decode(bytes(reason), (uint256));
            console.log("validation gas usage :", used);
        }
    }

    function consoleGasUsage(UserOperation memory op) external {
        uint256 gas = gasleft();
        vm.startPrank(address(entryPoint));
        kernel.validateUserOp(op, entryPoint.getUserOpHash(op), 0);
        vm.stopPrank();
        revert(string(abi.encodePacked(gas - gasleft())));
    }

    // computes the hash of a permit
    function getStructHash(
        bytes4 sig,
        uint48 validUntil,
        uint48 validAfter,
        address validator,
        address executor,
        bytes memory enableData
    ) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                keccak256("ValidatorApproved(bytes4 sig,uint256 validatorData,address executor,bytes enableData)"),
                bytes4(sig),
                uint256(uint256(uint160(validator)) | (uint256(validAfter) << 160) | (uint256(validUntil) << (48 + 160))),
                executor,
                keccak256(enableData)
            )
        );
    }

    // computes the hash of the fully encoded EIP-712 message for the domain, which can be used to recover the signer
    function getTypedDataHash(
        bytes4 sig,
        uint48 validUntil,
        uint48 validAfter,
        address validator,
        address executor,
        bytes memory enableData
    ) internal view returns (bytes32) {
        return keccak256(
            abi.encodePacked(
                "\x19\x01",
                ERC4337Utils._buildDomainSeparator(KERNEL_NAME, KERNEL_VERSION, address(kernel)),
                ERC4337Utils.getStructHash(sig, validUntil, validAfter, validator, executor, enableData)
            )
        );
    }
}




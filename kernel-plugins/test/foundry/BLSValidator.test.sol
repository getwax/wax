// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "kernel/src/factory/KernelFactory.sol";
import "kernel/src/factory/ECDSAKernelFactory.sol";

// // test artifacts
import "kernel/src/test/TestExecutor.sol";
import "kernel/src/test/TestERC721.sol";
// // test utils
import "forge-std/Test.sol";
import {ERC4337Utils} from "kernel/test/foundry/ERC4337Utils.sol";
// // BLS validator
import {BLSValidator} from "../../src/BLSValidator.sol";

using ERC4337Utils for EntryPoint;

contract BLSValidatorTest is Test {
    Kernel kernel;
    KernelFactory factory;
    ECDSAKernelFactory ecdsaFactory;
    EntryPoint entryPoint;
    ECDSAValidator validator;
    address owner;
    uint256 ownerKey;
    address payable beneficiary;

    function setUp() public {
        (owner, ownerKey) = makeAddrAndKey("owner");
        entryPoint = new EntryPoint();
        factory = new KernelFactory(entryPoint);

        validator = new ECDSAValidator();
        ecdsaFactory = new ECDSAKernelFactory(factory, validator, entryPoint);

        kernel = Kernel(payable(address(ecdsaFactory.createAccount(owner, 0))));
        vm.deal(address(kernel), 1e30);
        beneficiary = payable(address(makeAddr("beneficiary")));
    }

    function test_mode_2_bls() external {
        BLSValidator blsValidator = new BLSValidator();
        // Note: With the Kernel wallet validation and execution are seperate
        // Executors are plugins that add custom functions to Kernel and each function
        // is tied to a validator.  In this test we will be enabling the blsValidator and
        // tying the TextExecutor to it.
        TestExecutor testExecutor = new TestExecutor();
        UserOperation memory op =
            entryPoint.fillUserOp(address(kernel), abi.encodeWithSelector(TestExecutor.doNothing.selector));

        // BLS public/private key pair and signatures created using the '@thehubbleproject/bls' library.
        // Hard coded in the test because I don't know of a way to do this in solidity.
        uint256[4] memory publicKey = [
            0x004b1d8408dcc643647e4f32a761853e873cd1da8ffc40f03b00647484b3498a,
            0x248b9979254108c9cbb2005739dc693f1694b7b2058942114a0ab4aa81723a6d,
            0x0edd89947147f52246e1dc3092b62c9020afca38d470b3b827e267c66350da93,
            0x2d3f8d5cc58f02219b73b70a0acf33778335e7b5f5c7bf98a1d596b9270e92bb
        ];

        bytes memory enableData = abi.encodePacked(
            publicKey,
            uint48(0),
            TestExecutor.doNothing.selector,
            uint48(0),
            uint48(0),
            uint32(16)
        );

        bytes32 digest = getTypedDataHash(
            address(kernel),
            TestExecutor.doNothing.selector,
            0,
            0,
            address(blsValidator),
            address(testExecutor),
            enableData
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ownerKey, digest);

        op.signature = abi.encodePacked(
            bytes4(0x00000002),
            uint48(0),
            uint48(0),
            address(blsValidator),
            address(testExecutor),
            uint256(enableData.length),
            enableData,
            uint256(65),
            r,
            s,
            v
        );

        // The signature is hardcoded because the userOpHash is signed outside
        // the test is a seperate script.
        // bytes32 hash = entryPoint.getUserOpHash(op);
        uint256[2] memory signature = [
            0x238bd40a43095cc868aa13820ced70e0deedc62f588a029cd9aad8a6b72a2283,
            0x21f8022a28193d60e8f28bb4ce35086c28b1bbe5bb5bf1564bc7b63a2e544f54
        ];

        // First signature is the ecdsa signature for the default (ecdsa) validator. We
        // need that signature to validate the BLSValidator for the kernel account.
        // Second signature is the BLS signature for the BLSValidator. We are calling
        // the TestExecutor with the BLSValidator as the validator.
        op.signature = bytes.concat(op.signature, abi.encodePacked(signature));
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
}

// computes the hash of a permit
function getStructHash(
    bytes4 sig,
    uint48 validUntil,
    uint48 validAfter,
    address validator,
    address executor,
    bytes memory enableData
) pure returns (bytes32) {
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
    address sender,
    bytes4 sig,
    uint48 validUntil,
    uint48 validAfter,
    address validator,
    address executor,
    bytes memory enableData
) view returns (bytes32) {
    return keccak256(
        abi.encodePacked(
            "\x19\x01",
            _buildDomainSeparator("Kernel", "0.0.2", sender),
            getStructHash(sig, validUntil, validAfter, validator, executor, enableData)
        )
    );
}

function _buildDomainSeparator(string memory name, string memory version, address verifyingContract)
    view
    returns (bytes32)
{
    bytes32 hashedName = keccak256(bytes(name));
    bytes32 hashedVersion = keccak256(bytes(version));
    bytes32 typeHash = keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");

    return keccak256(abi.encode(typeHash, hashedName, hashedVersion, block.chainid, address(verifyingContract)));
}

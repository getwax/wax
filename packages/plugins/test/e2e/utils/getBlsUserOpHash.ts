import { ethers, keccak256 } from "ethers";
import { solG2 } from "@thehubbleproject/bls/dist/mcl";
import { PackedUserOperation } from "./userOpUtils";

export default function getBlsUserOpHash(
  chainId: bigint,
  aggregatorAddress: string,
  publicKey: solG2,
  userOp: PackedUserOperation,
  entryPointAddress: string,
): string {
  const abi = ethers.AbiCoder.defaultAbiCoder();

  const publicKeyHash = keccak256(abi.encode(["uint256[4]"], [publicKey]));

  return keccak256(
    abi.encode(
      ["bytes32", "bytes32", "address", "uint256", "address"],
      [
        internalUserOpHash(userOp),
        publicKeyHash,
        aggregatorAddress,
        chainId,
        entryPointAddress,
      ],
    ),
  );
}

/**
 * Replicates the internalUserOpHash function in BLSSignatureAggregator.sol.
 *
 * (Also the same as UserOperationLib.hash, but *different* from EntryPoint's
 * getUserOpHash and BLSSignatureAggregator's getUserOpHash.)
 */
function internalUserOpHash(userOp: PackedUserOperation): string {
  const abi = ethers.AbiCoder.defaultAbiCoder();

  return keccak256(
    abi.encode(
      [
        "address", // userOp.sender,
        "uint256", // userOp.nonce,
        "bytes32", // keccak256(userOp.initCode),
        "bytes32", // keccak256(userOp.callData),
        "bytes32", // userOp.accountGasLimits,
        "uint256", // userOp.preVerificationGas,
        "bytes32", // userOp.gasFees,
        "bytes32", // keccak256(userOp.paymasterAndData),
      ],
      [
        userOp.sender,
        userOp.nonce,
        keccak256(userOp.initCode),
        keccak256(userOp.callData),
        userOp.accountGasLimits,
        userOp.preVerificationGas,
        userOp.gasFees,
        keccak256(userOp.paymasterAndData),
      ],
    ),
  );
}

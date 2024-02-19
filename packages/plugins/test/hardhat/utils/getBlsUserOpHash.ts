import { ethers, keccak256 } from "ethers";
import { ResolvedUserOp } from "./resolveUserOp";
import { solG2 } from "@thehubbleproject/bls/dist/mcl";

export default function getBlsUserOpHash(
  chainId: bigint,
  aggregatorAddress: string,
  publicKey: solG2,
  userOp: ResolvedUserOp,
): string {
  const abi = ethers.AbiCoder.defaultAbiCoder();

  const publicKeyHash = keccak256(abi.encode(["uint256[4]"], [publicKey]));

  return keccak256(
    abi.encode(
      ["bytes32", "bytes32", "address", "uint256"],
      [internalUserOpHash(userOp), publicKeyHash, aggregatorAddress, chainId],
    ),
  );
}

/**
 * Replicates the internalUserOpHash function in BLSSignatureAggregator.sol.
 *
 * (Also the same as UserOperationLib.hash, but *different* from EntryPoint's
 * getUserOpHash and BLSSignatureAggregator's getUserOpHash.)
 */
function internalUserOpHash(userOp: ResolvedUserOp): string {
  const abi = ethers.AbiCoder.defaultAbiCoder();

  return keccak256(
    abi.encode(
      [
        "address", // userOp.sender,
        "uint256", // userOp.nonce,
        "bytes32", // keccak256(userOp.initCode),
        "bytes32", // keccak256(userOp.callData),
        "uint256", // userOp.callGasLimit,
        "uint256", // userOp.verificationGasLimit,
        "uint256", // userOp.preVerificationGas,
        "uint256", // userOp.maxFeePerGas,
        "uint256", // userOp.maxPriorityFeePerGas,
        "bytes32", // keccak256(userOp.paymasterAndData),
      ],
      [
        userOp.sender,
        userOp.nonce,
        keccak256(userOp.initCode),
        keccak256(userOp.callData),
        userOp.callGasLimit,
        userOp.verificationGasLimit,
        userOp.preVerificationGas,
        userOp.maxFeePerGas,
        userOp.maxPriorityFeePerGas,
        keccak256(userOp.paymasterAndData),
      ],
    ),
  );
}

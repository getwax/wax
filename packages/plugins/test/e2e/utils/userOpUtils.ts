import {
  AbiCoder,
  BigNumberish,
  BytesLike,
  concat,
  hexlify,
  isHexString,
  keccak256,
} from "ethers";
import { PackedUserOperationStruct } from "../../../typechain-types/lib/account-abstraction/contracts/core/EntryPoint";

/**
 * @notice these utils have been largely copied from ERC4337Utils.ts in eth-infinitism's
 * bundler repo, which form part of @account-abstraction/utils. This is because
 * @account-abstraction/utils v0.7.0 has not been published on npm yet. These utility
 * function can be swapped out once v0.7.0 has been published.
 *
 * The only changes were to update ethers functionality from v5 to v6
 */

export type PackedUserOperation = PackedUserOperationStruct;

export type UserOperation = {
  sender: string;
  nonce: BigNumberish;
  factory?: string;
  factoryData?: BytesLike;
  callData: BytesLike;
  callGasLimit: BigNumberish;
  verificationGasLimit: BigNumberish;
  preVerificationGas: BigNumberish;
  maxFeePerGas: BigNumberish;
  maxPriorityFeePerGas: BigNumberish;
  paymaster?: string;
  paymasterVerificationGasLimit?: BigNumberish;
  paymasterPostOpGasLimit?: BigNumberish;
  paymasterData?: BytesLike;
  signature: BytesLike;
};

export type FactoryParams = {
  factory: string;
  factoryData?: BytesLike;
};

/**
 * calculate the userOpHash of a given userOperation.
 * The userOpHash is a hash of all UserOperation fields, except the "signature" field.
 * The entryPoint uses this value in the emitted UserOperationEvent.
 * A wallet may use this value as the hash to sign (the SampleWallet uses this method)
 * @param op
 * @param entryPoint
 * @param chainId
 */
export function getUserOpHash(
  op: UserOperation,
  entryPoint: string,
  chainId: number,
): string {
  const userOpHash = keccak256(encodeUserOp(op, true));
  const defaultAbiCoder = AbiCoder.defaultAbiCoder();
  const enc = defaultAbiCoder.encode(
    ["bytes32", "address", "uint256"],
    [userOpHash, entryPoint, chainId],
  );
  return keccak256(enc);
}

/**
 * abi-encode the userOperation
 * @param op a PackedUserOp
 * @param forSignature "true" if the hash is needed to calculate the getUserOpHash()
 *  "false" to pack entire UserOp, for calculating the calldata cost of putting it on-chain.
 */
export function encodeUserOp(
  op1: PackedUserOperation | UserOperation,
  forSignature = true,
): string {
  // if "op" is unpacked UserOperation, then pack it first, before we ABI-encode it.

  let op: PackedUserOperation;
  if ("callGasLimit" in op1) {
    op = packUserOp(op1);
  } else {
    op = op1;
  }

  const defaultAbiCoder = AbiCoder.defaultAbiCoder();
  if (forSignature) {
    return defaultAbiCoder.encode(
      [
        "address",
        "uint256",
        "bytes32",
        "bytes32",
        "bytes32",
        "uint256",
        "bytes32",
        "bytes32",
      ],
      [
        op.sender,
        op.nonce,
        keccak256(op.initCode),
        keccak256(op.callData),
        op.accountGasLimits,
        op.preVerificationGas,
        op.gasFees,
        keccak256(op.paymasterAndData),
      ],
    );
  } else {
    // for the purpose of calculating gas cost encode also signature (and no keccak of bytes)
    return defaultAbiCoder.encode(
      [
        "address",
        "uint256",
        "bytes",
        "bytes",
        "bytes32",
        "uint256",
        "bytes32",
        "bytes",
        "bytes",
      ],
      [
        op.sender,
        op.nonce,
        op.initCode,
        op.callData,
        op.accountGasLimits,
        op.preVerificationGas,
        op.gasFees,
        op.paymasterAndData,
        op.signature,
      ],
    );
  }
}

export function packUserOp(op: UserOperation): PackedUserOperation {
  let paymasterAndData: BytesLike;
  if (op.paymaster == null) {
    paymasterAndData = "0x";
  } else {
    if (
      op.paymasterVerificationGasLimit == null ||
      op.paymasterPostOpGasLimit == null
    ) {
      throw new Error("paymaster with no gas limits");
    }
    paymasterAndData = packPaymasterData(
      op.paymaster,
      op.paymasterVerificationGasLimit,
      op.paymasterPostOpGasLimit,
      op.paymasterData,
    );
  }

  return {
    sender: op.sender,
    nonce: "0x" + BigInt(op.nonce).toString(16),
    initCode:
      op.factory == null ? "0x" : concat([op.factory, op.factoryData ?? ""]),
    callData: op.callData,
    accountGasLimits: packUint(op.verificationGasLimit, op.callGasLimit),
    preVerificationGas: "0x" + BigInt(op.preVerificationGas).toString(16),
    gasFees: packUint(op.maxPriorityFeePerGas, op.maxFeePerGas),
    paymasterAndData,
    signature: op.signature,
  };
}

export function packPaymasterData(
  paymaster: string,
  paymasterVerificationGasLimit: BigNumberish,
  postOpGasLimit: BigNumberish,
  paymasterData?: BytesLike,
): BytesLike {
  return concat([
    paymaster,
    packUint(paymasterVerificationGasLimit, postOpGasLimit),
    paymasterData ?? "0x",
  ]);
}

export function packUint(high128: BigNumberish, low128: BigNumberish): string {
  high128 = BigInt(high128);
  low128 = BigInt(low128);
  const packed = "0x" + ((high128 << 128n) + low128).toString(16);
  return hexZeroPad(packed, 32);
}

/**
 * @notice Copied from ethers v5.7 as the ethers v6 equivalent behaves
 * in a way the bundler doesn't expect and an error is thrown
 */
export function hexZeroPad(value: BytesLike, length: number): string {
  if (typeof value !== "string") {
    value = hexlify(value);
  } else if (!isHexString(value)) {
    console.log("invalid hex string", "value", value);
  }

  if (value.length > 2 * length + 2) {
    console.log("value out of range", "value", arguments[1]);
  }

  while (value.length < 2 * length + 2) {
    value = "0x0" + value.substring(2);
  }

  return value;
}

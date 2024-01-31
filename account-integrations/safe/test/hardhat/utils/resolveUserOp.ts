import { UserOperationStruct } from "@account-abstraction/contracts";

export default async function resolveUserOp(
  userOp: UserOperationStruct,
): Promise<ResolvedUserOp> {
  return {
    sender: await userOp.sender,
    nonce: await userOp.nonce,
    initCode: await userOp.initCode,
    callData: await userOp.callData,
    callGasLimit: await userOp.callGasLimit,
    verificationGasLimit: await userOp.verificationGasLimit,
    preVerificationGas: await userOp.preVerificationGas,
    maxFeePerGas: await userOp.maxFeePerGas,
    maxPriorityFeePerGas: await userOp.maxPriorityFeePerGas,
    paymasterAndData: await userOp.paymasterAndData,
    signature: await userOp.signature,
  };
}

export type ResolvedUserOp = {
  [K in keyof UserOperationStruct]: Awaited<UserOperationStruct[K]>;
};

import { UserOperationStruct } from '../../hardhat/typechain-types/account-abstraction/contracts/interfaces/IEntryPoint';

export default async function resolveUserOp(
  userOp: UserOperationStruct,
): Promise<ResolvedUserOp> {
  return {
    sender: await userOp.sender,
    nonce: userOp.nonce,
    initCode: userOp.initCode,
    callData: userOp.callData,
    callGasLimit: userOp.callGasLimit,
    verificationGasLimit: userOp.verificationGasLimit,
    preVerificationGas: userOp.preVerificationGas,
    maxFeePerGas: userOp.maxFeePerGas,
    maxPriorityFeePerGas: userOp.maxPriorityFeePerGas,
    paymasterAndData: userOp.paymasterAndData,
    signature: userOp.signature,
  };
}

export type ResolvedUserOp = {
  [K in keyof UserOperationStruct]: Awaited<UserOperationStruct[K]>;
};

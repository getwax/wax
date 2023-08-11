import z from 'zod';

// eslint-disable-next-line @typescript-eslint/no-namespace
namespace EthereumRpc {
  export const emptyParams = z.union([z.tuple([]), z.undefined()]);

  export const BigNumberish = z.union([z.string(), z.number(), z.bigint()]);
  export type BigNumberish = z.infer<typeof BigNumberish>;

  export const TransactionReceipt = z.object({
    blockHash: z.union([z.string(), z.null()]),
    blockNumber: z.union([z.string(), z.null()]),
    from: z.string(),
    gas: z.string(),
    hash: z.string(),
    input: z.string(),
    nonce: z.string(),
    to: z.union([z.string(), z.null()]),
    transactionIndex: z.union([z.string(), z.null()]),
    value: z.string(),
    v: z.string(),
    r: z.string(),
    s: z.string(),
    type: z.optional(z.string()),
    accessList: z.array(z.unknown()),
    chainId: z.string(),
    gasPrice: z.optional(z.string()),
    maxFeePerGas: z.optional(z.string()),
    maxPriorityFeePerGas: z.optional(z.string()),
  });

  export type TransactionReceipt = z.infer<typeof TransactionReceipt>;

  export const UserOperation = z.object({
    sender: z.string(),
    nonce: BigNumberish,
    initCode: z.string(),
    callData: z.string(),
    callGasLimit: BigNumberish,
    verificationGasLimit: BigNumberish,
    preVerificationGas: BigNumberish,
    maxFeePerGas: BigNumberish,
    maxPriorityFeePerGas: BigNumberish,
    paymasterAndData: z.string(),
    signature: z.string(),
  });

  export type UserOperation = z.infer<typeof UserOperation>;

  export const UserOperationReceipt = z.object({
    userOpHash: z.string(),
    entryPoint: z.string(),
    sender: z.string(),
    nonce: z.string(),
    paymaster: z.string(),
    actualGasCost: z.string(),
    actualGasUsed: z.string(),
    success: z.boolean(),
    reason: z.string(),
    logs: z.string(),
    receipt: TransactionReceipt,
  });

  export type UserOperationReceipt = z.infer<typeof UserOperationReceipt>;

  export const schema = {
    eth_requestAccounts: {
      params: emptyParams,
      output: z.array(z.string()).min(1),
    },
    eth_accounts: {
      params: emptyParams,
      output: z.array(z.string()),
    },
    eth_chainId: {
      params: emptyParams,
      output: z.string(),
    },
    eth_sendTransaction: {
      params: z
        .array(
          z.object({
            from: z.string(),
          }),
        )
        .min(1),
      output: z.string(),
    },
    eth_getTransactionByHash: {
      params: z.tuple([z.string()]),
      output: z.union([z.null(), TransactionReceipt]),
    },
    eth_estimateGas: {
      params: z.tuple([
        z.object({
          from: z.string(),
          to: z.optional(z.string()),
          gas: z.optional(BigNumberish),
          gasPrice: z.optional(BigNumberish),
          value: z.optional(BigNumberish),
          data: z.optional(z.string()),
        }),
      ]),
      output: z.string(),
    },
    eth_sendUserOperation: {
      params: z.tuple([UserOperation]),
      output: z.string(),
    },
    eth_estimateUserOperationGas: {
      params: z.tuple([UserOperation]),
      output: z.object({
        preVerificationGas: z.string(),
        verificationGasLimit: z.string(),
        callGasLimit: z.string(),
      }),
    },
    eth_getUserOperationReceipt: {
      params: z.tuple([z.string()]),
      output: z.union([z.null(), UserOperationReceipt]),
    },
    eth_supportedEntryPoints: {
      params: emptyParams,
      output: z.array(z.string()),
    },
  };

  export type Schema = typeof schema;

  export type RequestParams<M extends string> = M extends keyof Schema
    ? undefined extends z.infer<Schema[M]['params']>
      ? { params?: z.infer<Schema[M]['params']> }
      : { params: z.infer<Schema[M]['params']> }
    : { params?: unknown[] };

  export type Response<M extends string> = M extends keyof Schema
    ? z.infer<Schema[M]['output']>
    : unknown;

  export type Handlers = {
    [M in keyof Schema]: (
      ...params: Exclude<z.infer<Schema[M]['params']>, undefined>
    ) => Promise<Response<M>>;
  };
}

export default EthereumRpc;

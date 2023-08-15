import z from 'zod';

// eslint-disable-next-line @typescript-eslint/no-namespace
namespace EthereumRpc {
  export const emptyParams = z.union([z.tuple([]), z.undefined()]);

  export const Transaction = z.object({
    blockHash: z.union([z.string(), z.null()]),
    blockNumber: z.union([z.string(), z.null()]),
    from: z.string(),
    gas: z.string(),
    hash: z.string(),
    input: z.string(),
    nonce: z.string(),
    to: z.string(),
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

  export type Transaction = z.infer<typeof Transaction>;

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
      output: z.union([z.null(), Transaction]),
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

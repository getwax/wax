import z from 'zod';

// eslint-disable-next-line @typescript-eslint/no-namespace
namespace EthereumRpc {
  export const emptyParams = z.union([z.tuple([]), z.undefined()]);

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
      params: z.array(z.unknown()),
      output: z.string(),
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

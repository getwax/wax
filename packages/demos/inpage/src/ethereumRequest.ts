import { z } from 'zod';
import JsonRpcError from './JsonRpcError';
import ZodNotUndefined from './helpers/ZodNotUndefined';
import assert from './helpers/assert';
import randomId from './helpers/randomId';
import EthereumRpc from './EthereumRpc';

export default async function ethereumRequest<M extends string>({
  url,
  method,
  params = [],
}: {
  url: string;
  method: M;
} & EthereumRpc.RequestParams<M>): Promise<EthereumRpc.Response<M>> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(
      {
        jsonrpc: '2.0',
        method,
        params,
        id: randomId(),
      },
      (_key, value) => {
        if (typeof value === 'bigint') {
          return `0x${value.toString(16)}`;
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return value;
      },
    ),
  });

  const json = z
    .union([
      z.object({ result: ZodNotUndefined() }),
      z.object({ error: ZodNotUndefined() }),
    ])
    .parse(await res.json());

  if ('result' in json) {
    return parseResponse(method, json.result);
  }

  assert('error' in json);
  throw JsonRpcError.parse(json.error);
}

function parseResponse<M extends string>(
  method: M,
  response: unknown,
): EthereumRpc.Response<M> {
  if (!(method in EthereumRpc.schema)) {
    return response as EthereumRpc.Response<M>;
  }

  const methodSchema = EthereumRpc.schema[method as keyof EthereumRpc.Schema];

  const parsedResponse = methodSchema.output.safeParse(response);

  if (!parsedResponse.success) {
    throw new JsonRpcError({
      code: -32602,
      message: parsedResponse.error.toString(),
    });
  }

  return response as EthereumRpc.Response<M>;
}

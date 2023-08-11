import { z } from 'zod';
import JsonRpcError from './JsonRpcError';
import ZodNotUndefined from './helpers/ZodNotUndefined';
import assert from './helpers/assert';
import randomId from './helpers/randomId';

export default async function networkRequest({
  rpcUrl,
  method,
  params = [],
}: {
  rpcUrl: string;
  method: string;
  params?: unknown[];
}) {
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method,
      params,
      id: randomId(),
    }),
  });

  const json = z
    .union([
      z.object({ result: ZodNotUndefined() }),
      z.object({ error: ZodNotUndefined() }),
    ])
    .parse(await res.json());

  if ('result' in json) {
    return json.result;
  }

  assert('error' in json);
  throw JsonRpcError.parse(json.error);
}

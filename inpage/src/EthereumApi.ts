import z from 'zod';

import assert from './helpers/assert';
import randomId from './helpers/randomId';

// TODO: Separate file
const RawJsonRpcError = z.object({
  code: z.number().int(),
  data: z.unknown(),
  message: z.string(),
});

type RawJsonRpcError = z.infer<typeof RawJsonRpcError>;

export default class EthereumApi {
  #networkUrl = 'http://127.0.0.1:8545';
  #testAddress = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
  #requestPermission: (message: string) => Promise<boolean>;

  #connectedAccounts: string[] = [];

  constructor(requestPermission: (message: string) => Promise<boolean>) {
    this.#requestPermission = requestPermission;
  }

  async request({
    method,
    params = [],
  }: {
    method: string;
    params?: unknown[];
  }) {
    if (method === 'eth_requestAccounts') {
      return await this.#requestAccounts();
    }

    if (method === 'eth_accounts') {
      return await this.#accounts();
    }

    return await this.#networkRequest({ method, params });
  }

  async #requestAccounts() {
    if (this.#connectedAccounts.length > 0) {
      return structuredClone(this.#connectedAccounts);
    }

    const granted = await this.#requestPermission(
      'Allow this page to see your account address?',
    );

    if (!granted) {
      throw new JsonRpcError({
        code: 4001,
        message: 'User rejected request',
      });
    }

    this.#connectedAccounts = [this.#testAddress];

    return await this.#accounts();
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async #accounts() {
    return structuredClone(this.#connectedAccounts);
  }

  async #networkRequest({
    method,
    params = [],
  }: {
    method: string;
    params?: unknown[];
  }) {
    const res = await fetch(this.#networkUrl, {
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

    const json: unknown = await res.json();
    assert(typeof json === 'object' && json !== null);

    if ('result' in json) {
      return json.result;
    }

    assert('error' in json);

    throw new JsonRpcError(RawJsonRpcError.parse(json.error));
  }
}

class JsonRpcError extends Error {
  code: number;
  data: unknown;

  constructor({ code, data, message }: RawJsonRpcError) {
    super(message);

    this.code = code;
    this.data = data;
  }
}

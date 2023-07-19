import assert from './helpers/assert';
import randomId from './helpers/randomId';

export default class EthereumApi {
  #networkUrl = 'http://127.0.0.1:8545';
  #testAddress = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
  #requestPermission: (message: string) => Promise<boolean>;

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

    return await this.#networkRequest({ method, params });
  }

  async #requestAccounts() {
    const granted = await this.#requestPermission(
      'Allow this page to see your account address?',
    );

    if (!granted) {
      throw new JsonRpcError({
        code: 4001,
        message: 'User rejected request',
      });
    }

    return this.#testAddress;
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
    const rawError = json.error;
    assert(typeof rawError === 'object' && rawError !== null);
    assert('code' in rawError && typeof rawError.code === 'number');
    assert('message' in rawError && typeof rawError.message === 'string');

    throw new JsonRpcError({
      code: rawError.code,
      data: ('data' in rawError && rawError.data) || undefined,
      message: rawError.message,
    });
  }
}

class JsonRpcError extends Error {
  code: number;
  data: unknown;

  constructor({
    code,
    data,
    message,
  }: {
    code: number;
    data?: unknown;
    message: string;
  }) {
    super(message);

    this.code = code;
    this.data = data;
  }
}

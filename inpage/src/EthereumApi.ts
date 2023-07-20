import z from 'zod';

import JsonRpcError from './JsonRpcError';
import assert from './helpers/assert';
import randomId from './helpers/randomId';
import { WaxStorage } from './WaxStorage';

export default class EthereumApi {
  #storage: WaxStorage;

  #networkUrl = 'http://127.0.0.1:8545';
  #testAddress = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
  #requestPermission: (message: string) => Promise<boolean>;

  constructor(
    requestPermission: (message: string) => Promise<boolean>,
    storage: WaxStorage,
  ) {
    this.#requestPermission = requestPermission;
    this.#storage = storage;
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
    let connectedAccounts = await this.#storage.connectedAccounts.get();

    if (connectedAccounts.length > 0) {
      return connectedAccounts;
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

    connectedAccounts = [this.#testAddress];

    await this.#storage.connectedAccounts.set(connectedAccounts);

    return connectedAccounts;
  }

  async #accounts() {
    return await this.#storage.connectedAccounts.get();
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

    const json = z
      .union([
        z.object({ result: z.unknown() }),
        z.object({ error: z.unknown() }),
      ])
      .parse(await res.json());

    if ('result' in json) {
      return json.result;
    }

    assert('error' in json);
    throw JsonRpcError.parse(json.error);
  }
}

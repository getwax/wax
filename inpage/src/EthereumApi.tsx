import z from 'zod';

import { ethers, BigNumberish, BytesLike } from 'ethers';
import JsonRpcError from './JsonRpcError';
import randomId from './helpers/randomId';
import WaxInPage from '.';
import EthereumRpc from './EthereumRpc';
import ZodNonNullable from './helpers/ZodNonNullable';
import { UserOperationStruct } from '../hardhat/typechain-types/@account-abstraction/contracts/interfaces/IEntryPoint';
import { SimpleAccount__factory } from '../hardhat/typechain-types';
import todo from './helpers/todo';

export default class EthereumApi {
  #waxInPage: WaxInPage;

  #networkUrl = 'http://127.0.0.1:8545';
  #testAddress = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

  constructor(waxInPage: WaxInPage) {
    this.#waxInPage = waxInPage;
  }

  async request<M extends string>({
    method,
    params,
  }: {
    method: M;
  } & EthereumRpc.RequestParams<M>): Promise<EthereumRpc.Response<M>> {
    if (!(method in EthereumRpc.schema)) {
      return (await this.#requestImpl({
        method,
        params,
      })) as EthereumRpc.Response<M>;
    }

    const methodSchema = EthereumRpc.schema[method as keyof EthereumRpc.Schema];

    const parsedParams = methodSchema.params.parse(params);
    const response = await this.#requestImpl({ method, params: parsedParams });

    const parsedResponse = methodSchema.output.parse(response);
    return parsedResponse as EthereumRpc.Response<M>;
  }

  async #requestImpl({
    method,
    params,
  }: {
    method: string;
    params?: unknown[];
  }): Promise<unknown> {
    if (method in this.#customHandlers) {
      // eslint-disable-next-line
      return await (this.#customHandlers as any)[method](...(params ?? []));
    }

    return await this.#networkRequest({ method, params });
  }

  #customHandlers: Partial<EthereumRpc.Handlers> = {
    eth_requestAccounts: async () => {
      let connectedAccounts =
        await this.#waxInPage.storage.connectedAccounts.get();

      if (connectedAccounts.length > 0) {
        return connectedAccounts;
      }

      const granted = await this.#waxInPage.requestPermission(
        'Allow this page to see your account address?',
      );

      if (!granted) {
        throw new JsonRpcError({
          code: 4001,
          message: 'User rejected request',
        });
      }

      const account = await this.#getAccount();

      connectedAccounts = [account.address];

      await this.#waxInPage.storage.connectedAccounts.set(connectedAccounts);

      return connectedAccounts;
    },

    eth_accounts: async () =>
      await this.#waxInPage.storage.connectedAccounts.get(),

    eth_sendTransaction: async (...txs) => {
      const question =
        txs.length === 1
          ? 'Send this transaction?'
          : 'Send these transactions?';

      const txData = txs.length === 1 ? txs[0] : txs;

      const granted = await this.#waxInPage.requestPermission(
        <pre style={{ overflowX: 'auto', maxWidth: '100%', fontSize: '1em' }}>
          {question} {JSON.stringify(txData, null, 2)}
        </pre>,
      );

      if (!granted) {
        throw new JsonRpcError({
          code: 4001,
          message: 'User rejected request',
        });
      }

      const account = await this.#getAccount();

      const userOps: UserOperationStruct[] = await Promise.all(
        txs.map(async (tx): Promise<UserOperationStruct> => {
          const parsedTx = z
            .object({
              gas: z.string(), // TODO: should be optional (calculate gas here)
              from: z.string(),
              to: z.string(),
              data: z.optional(z.string()),
              value: z.optional(z.string()),
            })
            .safeParse(tx);

          if (!parsedTx.success) {
            throw new JsonRpcError({
              code: -32000,
              message: `Failed to parse tx: ${parsedTx.error.toString()}`,
            });
          }

          const { to, from, gas, data, value } = parsedTx.data;

          if (from !== account.address) {
            throw new JsonRpcError({
              code: -32000,
              message: `unknown account ${from}`,
            });
          }

          let nonce: bigint;

          const accountBytecode = await this.#waxInPage.ethersProvider.getCode(
            from,
          );

          const simpleAccount = SimpleAccount__factory.connect(
            account.address,
            this.#waxInPage.ethersProvider,
          );

          if (accountBytecode === '0x') {
            nonce = 0n;
          } else {
            nonce = await simpleAccount.getNonce();
          }

          return {
            sender: from,
            nonce: `0x${nonce.toString(16)}`,
            initCode: todo<BytesLike>(),
            callData: simpleAccount.interface.encodeFunctionData('execute', [
              to,
              value ?? 0,
              data ?? '0x',
            ]),
            callGasLimit: gas,
            verificationGasLimit: '0x0', // TODO
            preVerificationGas: '0x0', // TODO
            maxFeePerGas: todo<BigNumberish>(),
            maxPriorityFeePerGas: todo<BigNumberish>(),
            paymasterAndData: '0x',
            signature: todo<BytesLike>(),
          };
        }),
      );

      // const userOp: UserOperationStruct = {};

      return (await this.#networkRequest({
        method: 'eth_sendTransaction',
        params: txs,
      })) as string;
    },
  };

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
        z.object({ result: ZodNonNullable() }),
        z.object({ error: ZodNonNullable() }),
      ])
      .parse(await res.json());

    if ('result' in json) {
      return json.result;
    }

    throw JsonRpcError.parse(json.error);
  }

  async #getAccount() {
    let account = await this.#waxInPage.storage.account.get();

    if (account) {
      return account;
    }

    const contracts = await this.#waxInPage.getContracts();

    const wallet = ethers.Wallet.createRandom();

    account = {
      privateKey: wallet.privateKey,
      address: await contracts.simpleAccountFactory.getAddress(
        wallet.address,
        0,
      ),
    };

    await this.#waxInPage.storage.account.set(account);

    return account;
  }
}

import z from 'zod';

import { ethers } from 'ethers';
import JsonRpcError from './JsonRpcError';
import randomId from './helpers/randomId';
import WaxInPage from '.';
import EthereumRpc from './EthereumRpc';
import ZodNotUndefined from './helpers/ZodNotUndefined';
import { UserOperationStruct } from '../hardhat/typechain-types/@account-abstraction/contracts/interfaces/IEntryPoint';
import { SimpleAccount__factory } from '../hardhat/typechain-types';
import assert from './helpers/assert';

const baseVerificationGas = 100_000n;

type StrictUserOperation = {
  sender: string;
  nonce: string;
  initCode: string;
  callData: string;
  callGasLimit: bigint;
  verificationGasLimit: bigint;
  preVerificationGas: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  paymasterAndData: string;
  signature: string;
};

export default class EthereumApi {
  #waxInPage: WaxInPage;
  #rpcUrl: string;
  #chainIdPromise: Promise<string>;

  #userOps = new Map<
    string,
    {
      chainId: bigint;
      userOp: StrictUserOperation;
      actions: {
        to: string;
        value: bigint;
        data: string;
      }[];
      batch: boolean;
    }
  >();

  constructor(rpcUrl: string, waxInPage: WaxInPage) {
    this.#rpcUrl = rpcUrl;
    this.#waxInPage = waxInPage;

    this.#chainIdPromise = this.#networkRequest({ method: 'eth_chainId' }).then(
      (res) => z.string().parse(res),
    );
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

    const parsedParams = methodSchema.params.safeParse(params);

    if (!parsedParams.success) {
      throw new JsonRpcError({
        code: -32601,
        message: parsedParams.error.toString(),
      });
    }

    const response = await this.#requestImpl({ method, params });

    const parsedResponse = methodSchema.output.safeParse(response);

    if (!parsedResponse.success) {
      throw new JsonRpcError({
        code: -32602,
        message: parsedResponse.error.toString(),
      });
    }

    return parsedResponse.data as EthereumRpc.Response<M>;
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
    eth_chainId: () => this.#chainIdPromise,

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
      const sender = txs[0].from;

      if (txs.find((tx) => tx.from !== sender)) {
        throw new JsonRpcError({
          code: -32602,
          message: 'All txs must have the same sender (aka `.from`)',
        });
      }

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
      const contracts = await this.#waxInPage.getContracts();

      const actions = txs.map((tx) => {
        const parsedTx = z
          .object({
            to: z.string(),
            gas: z.string(), // TODO: should be optional (calculate gas here)
            data: z.optional(z.string()),
            value: z.optional(z.string()),
          })
          .safeParse(tx);

        if (!parsedTx.success) {
          throw new JsonRpcError({
            code: -32601,
            message: `Failed to parse tx: ${parsedTx.error.toString()}`,
          });
        }

        return parsedTx.data;
      });

      const simpleAccount = SimpleAccount__factory.connect(
        account.address,
        this.#waxInPage.ethersProvider,
      );

      let callData;

      if (actions.length === 1) {
        const action = actions[0];

        callData = simpleAccount.interface.encodeFunctionData('execute', [
          action.to,
          action.value ?? 0n,
          action.data ?? '0x',
        ]);
      } else {
        const totalValue = actions
          .map((a) => (a.value === undefined ? 0n : BigInt(a.value)))
          .reduce((a, b) => a + b);

        if (totalValue > 0n) {
          throw new Error(
            [
              "TODO: SimpleAccount doesn't yet support batch operations that",
              'send ETH. Fixed in PR#281 but not published yet:',
              'https://github.com/eth-infinitism/account-abstraction/pull/281.',
            ].join(' '),
          );
        }

        callData = simpleAccount.interface.encodeFunctionData('executeBatch', [
          actions.map((a) => a.to),
          actions.map((a) => a.data ?? '0x'),
        ]);
      }

      let nonce: bigint;

      const accountBytecode = await this.#waxInPage.ethersProvider.getCode(
        sender,
      );

      let initCode: string;
      let verificationGasLimit = baseVerificationGas;

      if (accountBytecode === '0x') {
        nonce = 0n;

        initCode = await this.#waxInPage.getSimpleAccountFactoryAddress();

        initCode += contracts.simpleAccountFactory.interface
          .encodeFunctionData('createAccount', [account.ownerAddress, 0])
          .slice(2);

        verificationGasLimit +=
          await contracts.simpleAccountFactory.createAccount.estimateGas(
            account.ownerAddress,
            0,
          );
      } else {
        nonce = await simpleAccount.getNonce();
        initCode = '0x';
      }

      const feeData = await this.#waxInPage.ethersProvider.getFeeData();
      assert(feeData.maxFeePerGas !== null);
      assert(feeData.maxPriorityFeePerGas !== null);

      const ownerWallet = new ethers.Wallet(account.privateKey);

      const userOp: StrictUserOperation = {
        sender,
        nonce: `0x${nonce.toString(16)}`,
        initCode,
        callData,
        callGasLimit: actions.map((a) => BigInt(a.gas)).reduce((a, b) => a + b),
        verificationGasLimit,
        preVerificationGas: 0n, // TODO
        maxFeePerGas: feeData.maxFeePerGas,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
        paymasterAndData: '0x',
        signature: '0x',
      } satisfies UserOperationStruct;

      const userOpHash = await contracts.entryPoint.getUserOpHash(userOp);

      userOp.signature = await ownerWallet.signMessage(
        ethers.getBytes(userOpHash),
      );

      await this.request({
        method: 'eth_sendUserOperation',
        params: [userOp],
      });

      this.#userOps.set(userOpHash, {
        chainId: BigInt(await this.request({ method: 'eth_chainId' })),
        userOp,
        actions: actions.map((a) => ({
          to: a.to,
          value: a.value === undefined ? 0n : BigInt(a.value),
          data: a.data ?? '0x',
        })),
        batch: actions.length !== 1,
      });

      return userOpHash;
    },

    eth_getTransactionByHash: async (txHash) => {
      const opInfo = this.#userOps.get(txHash);

      if (opInfo === undefined) {
        return (await this.#networkRequest({
          method: 'eth_getTransactionByHash',
          params: [txHash],
        })) as EthereumRpc.TransactionReceipt | null;
      }

      const receipt = await this.request({
        method: 'eth_getUserOperationReceipt',
        params: [txHash],
      });

      if (receipt === null) {
        return null;
      }

      const { userOp } = opInfo;

      // eth_getTransactionByHash doesn't really have the right shape for batch
      // operations. There should maybe be an eth_getUserOperationByHash method.
      assert(opInfo.actions.length === 1);
      assert(opInfo.batch === false);
      const action = opInfo.actions[0];

      return {
        blockHash: receipt.receipt.blockHash,
        blockNumber: receipt.receipt.blockNumber,
        from: receipt.sender,
        gas: receipt.actualGasUsed,
        hash: receipt.userOpHash,
        input: userOp.callData,
        nonce: receipt.nonce,
        to: action.to,
        transactionIndex: receipt.receipt.transactionIndex,
        value: `0x${action.value.toString(16)}`,
        accessList: [],

        // Note: We could maybe provide these for SimpleAccount since it uses
        // ECDSA, but in general we can't necessarily provide these values.
        // Ethers needs them to work though.
        r: '0x0',
        s: '0x0',
        v: '0x0',

        chainId: `0x${opInfo.chainId.toString(16)}`,
        gasPrice: receipt.actualGasCost,
        maxFeePerGas: `0x${userOp.maxFeePerGas.toString(16)}`,
        maxPriorityFeePerGas: `0x${userOp.maxPriorityFeePerGas.toString(16)}`,
      } satisfies EthereumRpc.TransactionReceipt;
    },

    eth_sendUserOperation: async (userOp) => {
      const adminAccount = await this.#waxInPage.requestAdminAccount(
        'simulate-bundler',
      );

      const contracts = await this.#waxInPage.getContracts();

      // *not* the confirmation, just the response (don't add .wait(), that's
      // wrong).
      await contracts.entryPoint
        .connect(adminAccount)
        .handleOps([userOp], adminAccount.getAddress());

      return await contracts.entryPoint.getUserOpHash(userOp);
    },

    eth_getUserOperationReceipt: async (userOpHash) => {
      const opInfo = this.#userOps.get(userOpHash);

      if (opInfo === undefined) {
        return null;
      }

      const contracts = await this.#waxInPage.getContracts();

      const events = await contracts.entryPoint.queryFilter(
        contracts.entryPoint.filters.UserOperationEvent(userOpHash),
      );

      if (events.length === 0) {
        return null;
      }

      const event = events[0];

      const { userOp } = opInfo;

      const txReceipt = await this.request({
        method: 'eth_getTransactionByHash',
        params: [event.transactionHash],
      });

      if (txReceipt === null) {
        return null;
      }

      let revertReason = '0x';

      if (!event.args.success) {
        const errorEvents = await contracts.entryPoint.queryFilter(
          contracts.entryPoint.filters.UserOperationRevertReason(userOpHash),
        );

        const errorEvent = errorEvents.at(0);

        if (errorEvent !== undefined) {
          revertReason = errorEvent.args.revertReason;
        }
      }

      return {
        userOpHash,
        entryPoint: await contracts.entryPoint.getAddress(),
        sender: event.args.sender,
        nonce: `0x${event.args.nonce.toString(16)}`,
        paymaster: userOp.paymasterAndData.slice(0, 22),
        actualGasCost: `0x${event.args.actualGasCost.toString(16)}`,
        actualGasUsed: `0x${event.args.actualGasUsed.toString(16)}`,
        success: event.args.success,
        reason: revertReason,
        logs: '0x', // TODO: Logs
        receipt: txReceipt,
      } satisfies EthereumRpc.UserOperationReceipt;
    },
  };

  async #networkRequest({
    method,
    params = [],
  }: {
    method: string;
    params?: unknown[];
  }) {
    const res = await fetch(this.#rpcUrl, {
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

  async #getAccount() {
    let account = await this.#waxInPage.storage.account.get();

    if (account) {
      return account;
    }

    const contracts = await this.#waxInPage.getContracts();

    const wallet = ethers.Wallet.createRandom();

    account = {
      privateKey: wallet.privateKey,
      ownerAddress: wallet.address,
      address: await contracts.simpleAccountFactory.createAccount.staticCall(
        wallet.address,
        0,
      ),
    };

    await this.#waxInPage.storage.account.set(account);

    return account;
  }
}

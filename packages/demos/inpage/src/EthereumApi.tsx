import z from 'zod';

import JsonRpcError from './JsonRpcError';
import WaxInPage from '.';
import EthereumRpc from './EthereumRpc';
import { UserOperationStruct } from '../hardhat/typechain-types/account-abstraction/contracts/interfaces/IEntryPoint';
import assert from './helpers/assert';
import IBundler from './bundlers/IBundler';
import waxPrivate from './waxPrivate';
import ethereumRequest from './ethereumRequest';
import calculateUserOpHash from './helpers/calculateUserOpHash';
import { roundUpPseudoFloat } from './helpers/encodeUtils';

// We need a UserOperation in order to estimate the gas fields of a
// UserOperation, so we use these values as placeholders.
const temporaryEstimationGas = '0x01234567';
const temporarySignature = [
  '0x',
  '123456fe2807660c417ca1a38760342fa70135fcab89a8c7c879a77da8ce7a0b5a3805735e',
  '95170906b11c6f30dcc74e463e1e6990c68a3998a7271b728b123456',
].join('');
const preVerificationGasBuffer = 1000n;

type StrictUserOperation = {
  sender: string;
  nonce: string;
  initCode: string;
  callData: string;
  callGasLimit: bigint;
  verificationGasLimit: string;
  preVerificationGas: string;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  paymasterAndData: string;
  signature: string;
};

export default class EthereumApi {
  #rpcUrl: string;
  #waxInPage: WaxInPage;
  #bundler: IBundler;
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

  constructor(rpcUrl: string, waxInPage: WaxInPage, bundler: IBundler) {
    this.#rpcUrl = rpcUrl;
    this.#waxInPage = waxInPage;
    this.#bundler = bundler;

    this.#chainIdPromise = ethereumRequest({
      url: this.#rpcUrl,
      method: 'eth_chainId',
    }).then((res) => z.string().parse(res));
  }

  async request<M extends string>({
    method,
    params,
  }: {
    method: M;
  } & EthereumRpc.RequestParams<M>): Promise<EthereumRpc.Response<M>> {
    let res;

    try {
      res = await this.#requestImpl({ method, params } as {
        method: M;
      } & EthereumRpc.RequestParams<M>);
    } catch (error) {
      if (this.#waxInPage.getConfig('logRequests')) {
        // eslint-disable-next-line no-console
        console.log('ethereum.request', {
          method,
          params,
          error,
        });
      }

      throw error;
    }

    if (this.#waxInPage.getConfig('logRequests')) {
      // eslint-disable-next-line no-console
      console.log('ethereum.request', {
        method,
        params,
        response: res,
      });
    }

    return res as EthereumRpc.Response<M>;
  }

  async #requestImpl<M extends string>({
    method,
    params,
  }: {
    method: M;
  } & EthereumRpc.RequestParams<M>): Promise<EthereumRpc.Response<M>> {
    if (!(method in EthereumRpc.schema)) {
      return await ethereumRequest({
        url: this.#rpcUrl,
        method,
        params,
      } as {
        url: string;
        method: M;
      } & EthereumRpc.RequestParams<M>);
    }

    const methodSchema = EthereumRpc.schema[method as keyof EthereumRpc.Schema];

    const parsedParams = methodSchema.params.safeParse(params);

    if (!parsedParams.success) {
      throw new JsonRpcError({
        code: -32602,
        message: parsedParams.error.toString(),
      });
    }

    let response: EthereumRpc.Response<M>;

    if (method in this.#customHandlers) {
      // eslint-disable-next-line
      response = await (this.#customHandlers as any)[method](...(params ?? []));
    } else {
      response = await ethereumRequest({
        url: this.#rpcUrl,
        method,
        params,
      } as {
        url: string;
        method: M;
      } & EthereumRpc.RequestParams<M>);
    }

    return response;
  }

  async #getEntryPointAddress() {
    const contracts = await this.#waxInPage.getContracts();
    return await contracts.entryPoint.getAddress();
  }

  async #calculateUserOpHash(userOp: EthereumRpc.UserOperation) {
    const contracts = await this.#waxInPage.getContracts();

    const rpcUserOpHash = await contracts.entryPoint.getUserOpHash(userOp);

    const userOpHash = calculateUserOpHash(
      userOp,
      await contracts.entryPoint.getAddress(),
      Number(await this.#chainIdPromise),
    );

    assert(
      userOpHash === rpcUserOpHash,
      [
        'Locally calculated userOpHash does not match userOpHash from rpc',
        '(entryPoint.getUserOpHash)',
      ].join(' '),
    );

    return userOpHash;
  }

  #maybeRoundUpPseudoFloats(userOp: StrictUserOperation): StrictUserOperation {
    if (!this.#waxInPage.getConfig('useTopLevelCompression')) {
      return userOp;
    }

    return {
      ...userOp,
      maxFeePerGas: roundUpPseudoFloat(userOp.maxFeePerGas),
      maxPriorityFeePerGas: roundUpPseudoFloat(userOp.maxPriorityFeePerGas),
      callGasLimit: roundUpPseudoFloat(userOp.callGasLimit),
    };
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

      const account = await this.#waxInPage._getOrCreateAccount(waxPrivate);

      connectedAccounts = [account.address];

      await this.#waxInPage.storage.connectedAccounts.set(connectedAccounts);

      return connectedAccounts;
    },

    eth_accounts: async () =>
      await this.#waxInPage.storage.connectedAccounts.get(),

    eth_sendTransaction: async (...txs) => {
      const account = await this.#waxInPage._getOrCreateAccount(waxPrivate);
      const contracts = await this.#waxInPage.getContracts();

      const sender = txs[0].from ?? account.address;

      if (txs.find((tx) => tx.from !== txs[0].from)) {
        throw new JsonRpcError({
          code: -32602,
          message: 'All txs must have the same sender (aka `.from`)',
        });
      }

      if (sender.toLowerCase() !== account.address.toLowerCase()) {
        throw new JsonRpcError({
          code: -32000,
          message: `unknown account ${sender}`,
        });
      }

      const question =
        txs.length === 1
          ? 'Send this transaction?'
          : 'Send these transactions?';

      const txData = txs.length === 1 ? txs[0] : txs;

      const granted = await this.#waxInPage.requestPermission(
        <pre style={{ overflowX: 'auto', maxWidth: '100%', fontSize: '1em' }}>
          {question}{' '}
          {JSON.stringify(
            txData,
            (_key, value) => {
              if (typeof value === 'bigint') {
                return `0x${value.toString(16)}`;
              }

              // eslint-disable-next-line @typescript-eslint/no-unsafe-return
              return value;
            },
            2,
          )}
        </pre>,
      );

      if (!granted) {
        throw new JsonRpcError({
          code: 4001,
          message: 'User rejected request',
        });
      }

      const actions = await Promise.all(
        txs.map(async (tx) => {
          let { value } = tx;

          if (typeof value === 'number' || typeof value === 'bigint') {
            value = `0x${value.toString(16)}`;
          }

          // eslint-disable-next-line prefer-destructuring
          let gas: string | bigint | undefined = tx.gas;

          if (gas === undefined) {
            gas = BigInt(
              await this.request({
                method: 'eth_estimateGas',
                params: [
                  {
                    ...tx,
                    value,
                  },
                ],
              }),
            );
          }

          return {
            to: tx.to,
            gas,
            data: tx.data ?? '0x',
            value: tx.value ?? 0n,
          };
        }),
      );

      const callData = await account.encodeActions(actions);

      this.#waxInPage.logBytes('userOp.calldata', callData);

      let nonce: bigint;

      const accountBytecode = await this.#waxInPage.ethersProvider.getCode(
        sender,
      );

      let initCode: string;

      if (accountBytecode === '0x') {
        nonce = 0n;
        initCode = await account.makeInitCode();
      } else {
        nonce = await account.getNonce();
        initCode = '0x';
      }

      const { maxFeePerGas, maxPriorityFeePerGas } =
        await this.#waxInPage.ethersProvider.getFeeData();

      assert(maxFeePerGas !== null);
      assert(maxPriorityFeePerGas !== null);

      let userOp: StrictUserOperation = {
        sender,
        nonce: `0x${nonce.toString(16)}`,
        initCode,
        callData,
        callGasLimit: actions.map((a) => BigInt(a.gas)).reduce((a, b) => a + b),
        verificationGasLimit: temporaryEstimationGas,
        preVerificationGas: '0x0',
        maxFeePerGas,
        maxPriorityFeePerGas,
        paymasterAndData: '0x',
        signature: temporarySignature,
      } satisfies UserOperationStruct;

      userOp = this.#maybeRoundUpPseudoFloats(userOp);

      let userOpHash = await this.#calculateUserOpHash(userOp);

      userOp.signature = await account.sign(userOp, userOpHash);

      const { verificationGasLimit, preVerificationGas } = await this.request({
        method: 'eth_estimateUserOperationGas',
        params: [userOp, await contracts.entryPoint.getAddress()],
      });

      userOp.verificationGasLimit = verificationGasLimit;
      userOp.preVerificationGas = `0x${(
        BigInt(preVerificationGas) + preVerificationGasBuffer
      ).toString(16)}`;

      userOpHash = await this.#calculateUserOpHash(userOp);

      userOp.signature = await account.sign(userOp, userOpHash);

      await this.request({
        method: 'eth_sendUserOperation',
        params: [userOp, await contracts.entryPoint.getAddress()],
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

    eth_estimateGas: async (tx) => {
      const account = await this.#waxInPage._getAccount(waxPrivate);
      const from = tx.from ?? account?.address;

      if (
        account === undefined ||
        from?.toLowerCase() !== account.address.toLowerCase()
      ) {
        const res = await ethereumRequest({
          url: this.#rpcUrl,
          method: 'eth_estimateGas',
          params: [tx],
        });

        return z.string().parse(res);
      }

      if (tx.to === undefined) {
        throw new Error('Not implemented: estimateGas for contract creation');
      }

      const contracts = await this.#waxInPage.getContracts();

      return await ethereumRequest({
        url: this.#rpcUrl,
        method: 'eth_estimateGas',
        params: [
          {
            from: await contracts.entryPoint.getAddress(),
            to: from,
            data: await account.encodeActions([
              {
                to: tx.to,
                data: tx.data ?? '0x',
                value: tx.value ?? 0n,
              },
            ]),
          },
        ],
      });
    },

    eth_getTransactionByHash: async (txHash) => {
      const opInfo = this.#userOps.get(txHash);

      if (opInfo === undefined) {
        return await ethereumRequest({
          url: this.#rpcUrl,
          method: 'eth_getTransactionByHash',
          params: [txHash],
        });
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
        gasUsed: receipt.actualGasUsed,
        cumulativeGasUsed: receipt.receipt.cumulativeGasUsed ?? '0x0',
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
        logs: [], // TODO
      } satisfies EthereumRpc.TransactionReceipt;
    },

    eth_getTransactionReceipt: async (txHash) => {
      const opInfo = this.#userOps.get(txHash);

      if (opInfo === undefined) {
        return await ethereumRequest({
          url: this.#rpcUrl,
          method: 'eth_getTransactionReceipt',
          params: [txHash],
        });
      }

      return await this.request({
        method: 'eth_getTransactionByHash',
        params: [txHash],
      });
    },

    eth_sendUserOperation: async (userOp) =>
      this.#bundler.eth_sendUserOperation(
        userOp,
        await this.#getEntryPointAddress(),
      ),

    eth_estimateUserOperationGas: async (userOp) =>
      this.#bundler.eth_estimateUserOperationGas(
        userOp,
        await this.#getEntryPointAddress(),
      ),

    eth_getUserOperationReceipt: (userOpHash) =>
      this.#bundler.eth_getUserOperationReceipt(userOpHash),

    eth_supportedEntryPoints: () => this.#bundler.eth_supportedEntryPoints(),
  };
}

import z from 'zod';

import { ethers } from 'ethers';
import JsonRpcError from './JsonRpcError';
import WaxInPage from '.';
import EthereumRpc from './EthereumRpc';
import { UserOperationStruct } from '../hardhat/typechain-types/@account-abstraction/contracts/interfaces/IEntryPoint';
import { SimpleAccount__factory } from '../hardhat/typechain-types';
import assert from './helpers/assert';
import IBundler from './bundlers/IBundler';
import waxPrivate from './waxPrivate';
import ethereumRequest from './ethereumRequest';

// We need a UserOperation in order to estimate the gas fields of a
// UserOperation, so we use these values as placeholders.
const temporaryEstimationGas = '0x012345';
const temporarySignature = [
  '0x',
  '123456fe2807660c417ca1a38760342fa70135fcab89a8c7c879a77da8ce7a0b5a3805735e',
  '95170906b11c6f30dcc74e463e1e6990c68a3998a7271b728b123456',
].join('');

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
        code: -32601,
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

      const account = await this.#waxInPage._getAccount(waxPrivate);

      connectedAccounts = [account.address];

      await this.#waxInPage.storage.connectedAccounts.set(connectedAccounts);

      return connectedAccounts;
    },

    eth_accounts: async () =>
      await this.#waxInPage.storage.connectedAccounts.get(),

    eth_sendTransaction: async (...txs) => {
      const account = await this.#waxInPage._getAccount(waxPrivate);
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
          {question} {JSON.stringify(txData, null, 2)}
        </pre>,
      );

      if (!granted) {
        throw new JsonRpcError({
          code: 4001,
          message: 'User rejected request',
        });
      }

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

      if (accountBytecode === '0x') {
        nonce = 0n;

        initCode = await this.#waxInPage.getSimpleAccountFactoryAddress();

        initCode += contracts.simpleAccountFactory.interface
          .encodeFunctionData('createAccount', [account.ownerAddress, 0])
          .slice(2);
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
        verificationGasLimit: temporaryEstimationGas,
        preVerificationGas: temporaryEstimationGas,
        maxFeePerGas: feeData.maxFeePerGas,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
        paymasterAndData: '0x',
        signature: temporarySignature,
      } satisfies UserOperationStruct;

      const { verificationGasLimit, preVerificationGas } = await this.request({
        method: 'eth_estimateUserOperationGas',
        params: [userOp],
      });

      userOp.verificationGasLimit = verificationGasLimit;
      userOp.preVerificationGas = preVerificationGas;

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

    eth_sendUserOperation: (userOp) =>
      this.#bundler.eth_sendUserOperation(userOp),

    eth_estimateUserOperationGas: (userOp) =>
      this.#bundler.eth_estimateUserOperationGas(userOp),

    eth_getUserOperationReceipt: (userOpHash) =>
      this.#bundler.eth_getUserOperationReceipt(userOpHash),

    eth_supportedEntryPoints: () => this.#bundler.eth_supportedEntryPoints(),
  };
}

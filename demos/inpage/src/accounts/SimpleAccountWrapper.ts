import { ethers } from 'ethers';
import { z } from 'zod';
import {
  SimpleAccount,
  SimpleAccount__factory,
} from '../../hardhat/typechain-types';
import EthereumRpc from '../EthereumRpc';
import assert from '../helpers/assert';
import IAccount from './IAccount';
import WaxInPage from '..';

export const SimpleAccountData = z.object({
  type: z.literal('SimpleAccount'),
  address: z.string(),
  privateKey: z.string(),
  ownerAddress: z.string(),
});

export type SimpleAccountData = z.infer<typeof SimpleAccountData>;

// Cost of validating a signature or whatever verification method is in place.
const baseVerificationGas = 100_000n;

export default class SimpleAccountWrapper implements IAccount {
  type = 'SimpleAccount';

  constructor(
    public address: string,
    public privateKey: string,
    public ownerAddress: string,
    public waxInPage: WaxInPage,
  ) {}

  static fromData(data: SimpleAccountData, waxInPage: WaxInPage) {
    return new SimpleAccountWrapper(
      data.address,
      data.privateKey,
      data.ownerAddress,
      waxInPage,
    );
  }

  toData(): SimpleAccountData {
    return {
      type: 'SimpleAccount',
      address: this.address,
      privateKey: this.privateKey,
      ownerAddress: this.ownerAddress,
    };
  }

  static async createRandom(
    waxInPage: WaxInPage,
  ): Promise<SimpleAccountWrapper> {
    const contracts = await waxInPage.getContracts();

    const wallet = ethers.Wallet.createRandom();

    return new SimpleAccountWrapper(
      await contracts.simpleAccountFactory.createAccount.staticCall(
        wallet.address,
        0,
      ),
      wallet.privateKey,
      wallet.address,
      waxInPage,
    );
  }

  getContract(): SimpleAccount {
    return SimpleAccount__factory.connect(
      this.address,
      this.waxInPage.ethersProvider,
    );
  }

  async makeInitCode(): Promise<string> {
    const contracts = await this.waxInPage.getContracts();

    // This cast is needed because `getAddress` is overloaded in
    // SimpleAccountFactory, causing typechain to get confused.
    // More information:
    //   https://github.com/eth-infinitism/account-abstraction/pull/323
    const simpleAccountFactoryContract =
      contracts.simpleAccountFactory as unknown as ethers.Contract;

    let initCode = await simpleAccountFactoryContract.getAddress();

    initCode += contracts.simpleAccountFactory.interface
      .encodeFunctionData('createAccount', [this.ownerAddress, 0])
      .slice(2);

    return initCode;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async encodeActions(actions: EthereumRpc.Action[]): Promise<string> {
    const simpleAccount = this.getContract();

    if (actions.length === 1) {
      const action = actions[0];

      return simpleAccount.interface.encodeFunctionData('execute', [
        action.to,
        action.value ?? 0n,
        action.data ?? '0x',
      ]);
    }

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

    return simpleAccount.interface.encodeFunctionData('executeBatch', [
      actions.map((a) => a.to),
      actions.map((a) => a.data ?? '0x'),
    ]);
  }

  async estimateVerificationGas(
    userOp: EthereumRpc.UserOperation,
  ): Promise<bigint> {
    const contracts = await this.waxInPage.getContracts();

    let gas = baseVerificationGas;

    assert(userOp.sender.toLowerCase() === this.address.toLowerCase());

    if (BigInt(userOp.nonce) === 0n) {
      gas += await contracts.simpleAccountFactory.createAccount.estimateGas(
        this.ownerAddress,
        0,
      );
    }

    return gas;
  }

  async getNonce(): Promise<bigint> {
    return await this.getContract().getNonce();
  }

  async sign(
    _userOp: EthereumRpc.UserOperation,
    userOpHash: string,
  ): Promise<string> {
    const ownerWallet = new ethers.Wallet(this.privateKey);

    return await ownerWallet.signMessage(ethers.getBytes(userOpHash));
  }
}

import { ethers } from 'ethers';
import { z } from 'zod';
import {
  SafeECDSAPlugin,
  SafeECDSAPlugin__factory,
} from '../../hardhat/typechain-types';
import EthereumRpc from '../EthereumRpc';
import IAccount from './IAccount';
import WaxInPage from '..';
import { SafeECDSAFactory } from '../../hardhat/typechain-types/lib/account-integrations/safe/src/SafeECDSAFactory';
import receiptOf from '../helpers/receiptOf';

export const SafeECDSAAccountData = z.object({
  type: z.literal('SafeECDSAAccount'),
  address: z.string(),
  privateKey: z.string(),
  ownerAddress: z.string(),
});

export type SafeECDSAAccountData = z.infer<typeof SafeECDSAAccountData>;

// Cost of validating a signature or whatever verification method is in place.
const baseVerificationGas = 100_000n;

export default class SafeECDSAAccountWrapper implements IAccount {
  type = 'SafeECDSAAccount';

  constructor(
    public address: string,
    public privateKey: string,
    public ownerAddress: string,
    public waxInPage: WaxInPage,
  ) {}

  static fromData(data: SafeECDSAAccountData, waxInPage: WaxInPage) {
    return new SafeECDSAAccountWrapper(
      data.address,
      data.privateKey,
      data.ownerAddress,
      waxInPage,
    );
  }

  toData(): SafeECDSAAccountData {
    return {
      type: 'SafeECDSAAccount',
      address: this.address,
      privateKey: this.privateKey,
      ownerAddress: this.ownerAddress,
    };
  }

  static async createRandom(
    waxInPage: WaxInPage,
  ): Promise<SafeECDSAAccountWrapper> {
    const contracts = await waxInPage.getContracts();

    const wallet = ethers.Wallet.createRandom();

    const admin = await waxInPage.requestAdminAccount('deploy-account');

    const createArgs = [
      contracts.safe,
      contracts.entryPoint,
      wallet,
      0,
    ] satisfies Parameters<SafeECDSAFactory['create']>;

    const address = await contracts.safeECDSAFactory.create.staticCall(
      ...createArgs,
    );

    await receiptOf(
      contracts.safeECDSAFactory.connect(admin).create(...createArgs),
    );

    return new SafeECDSAAccountWrapper(
      address,
      wallet.privateKey,
      wallet.address,
      waxInPage,
    );
  }

  getContract(): SafeECDSAPlugin {
    return SafeECDSAPlugin__factory.connect(
      this.address,
      this.waxInPage.ethersProvider,
    );
  }

  // eslint-disable-next-line class-methods-use-this, @typescript-eslint/require-await
  async makeInitCode(): Promise<string> {
    throw new Error(
      'SafeECDSAAccount does not use initCode (it must be created before use)',
    );
  }

  // eslint-disable-next-line @typescript-eslint/require-await, class-methods-use-this
  async encodeActions(actions: EthereumRpc.Action[]): Promise<string> {
    if (actions.length !== 1) {
      throw new Error('SafeECDSAAccount only supports single actions');
    }

    const action = actions[0];

    return SafeECDSAPlugin__factory.createInterface().encodeFunctionData(
      'execTransaction',
      [action.to, action.value ?? 0n, action.data ?? '0x'],
    );
  }

  // eslint-disable-next-line class-methods-use-this, @typescript-eslint/require-await
  async estimateVerificationGas(
    _userOp: EthereumRpc.UserOperation,
  ): Promise<bigint> {
    // TODO: estimateGas on validateUserOp?
    return baseVerificationGas;
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

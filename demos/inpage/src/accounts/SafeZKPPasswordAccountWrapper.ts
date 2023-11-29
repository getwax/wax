import { ethers } from 'ethers';
import { z } from 'zod';
import {
  SafeZKPPasswordPlugin,
  SafeZKPPasswordPlugin__factory,
} from '../../hardhat/typechain-types';
import EthereumRpc from '../EthereumRpc';
import IAccount from './IAccount';
import WaxInPage from '..';
import { ERC4337ZKPPasswordClient } from '../../hardhat/lib/account-integrations/zkp/src';
import { SafeZKPPasswordFactory } from '../../hardhat/typechain-types/lib/account-integrations/safe/src/SafeZKPPasswordFactory';
import receiptOf from '../helpers/receiptOf';

export const SafeZKPPasswordAccountData = z.object({
  type: z.literal('SafeZKPPasswordAccount'),
  address: z.string(),
  ownerAddress: z.string(),
  password: z.string(),
});

export type SafeZKPPasswordAccountData = z.infer<
  typeof SafeZKPPasswordAccountData
>;

// Cost of validating a signature or whatever verification method is in place.
const baseVerificationGas = 100_000n;

export default class SafeZKPPasswordAccountWrapper implements IAccount {
  type = 'SafeZKPPasswordAccount';

  constructor(
    public address: string,
    public ownerAddress: string,
    public waxInPage: WaxInPage,
    private password: string,
    private zkpClient: ERC4337ZKPPasswordClient,
  ) {}

  static async fromData(
    data: SafeZKPPasswordAccountData,
    waxInPage: WaxInPage,
  ) {
    return new SafeZKPPasswordAccountWrapper(
      data.address,
      data.ownerAddress,
      waxInPage,
      data.password,
      await ERC4337ZKPPasswordClient.create(),
    );
  }

  toData(): SafeZKPPasswordAccountData {
    return {
      type: 'SafeZKPPasswordAccount',
      address: this.address,
      ownerAddress: this.ownerAddress,
      password: this.password,
    };
  }

  static async create(
    waxInPage: WaxInPage,
    password: string,
  ): Promise<SafeZKPPasswordAccountWrapper> {
    const contracts = await waxInPage.getContracts();

    const wallet = ethers.Wallet.createRandom();

    const admin = await waxInPage.requestAdminAccount('deploy-account');

    // TODO Fill in
    const zkVerifierAddress = '0x01';

    const createArgs = [
      contracts.safe,
      contracts.entryPoint,
      wallet,
      0,
      zkVerifierAddress,
    ] satisfies Parameters<SafeZKPPasswordFactory['create']>;

    const address = await contracts.safeZKPPasswordFactory.create.staticCall(
      ...createArgs,
    );

    await receiptOf(
      contracts.safeZKPPasswordFactory.connect(admin).create(...createArgs),
    );

    return new SafeZKPPasswordAccountWrapper(
      address,
      wallet.address,
      waxInPage,
      password,
      await ERC4337ZKPPasswordClient.create(),
    );
  }

  getContract(): SafeZKPPasswordPlugin {
    return SafeZKPPasswordPlugin__factory.connect(
      this.address,
      this.waxInPage.ethersProvider,
    );
  }

  // eslint-disable-next-line class-methods-use-this, @typescript-eslint/require-await
  async makeInitCode(): Promise<string> {
    throw new Error(
      'SafeZKPPasswordAccount does not use initCode (it must be created before use)',
    );
  }

  // eslint-disable-next-line @typescript-eslint/require-await, class-methods-use-this
  async encodeActions(actions: EthereumRpc.Action[]): Promise<string> {
    if (actions.length !== 1) {
      throw new Error('SafeZKPPasswordAccount only supports single actions');
    }

    const action = actions[0];

    return SafeZKPPasswordPlugin__factory.createInterface().encodeFunctionData(
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
    const contracts = await this.waxInPage.getContracts();

    // TODO: Why does this give a different result to
    // this.getContract().getNonce()?
    // (And why does that alternative give the wrong answer?)
    return await contracts.entryPoint.getNonce(this.address, 0);
  }

  async sign(
    _userOp: EthereumRpc.UserOperation,
    userOpHash: string,
  ): Promise<string> {
    const { signature } = await this.zkpClient.proveUserOp(
      this.password,
      userOpHash,
    );
    return signature;
  }
}

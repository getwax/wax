import { ethers } from 'ethers';
import { z } from 'zod';
import {
  SafeECDSAPlugin,
  SafeECDSAPlugin__factory,
  SafeECDSARecoveryPlugin,
  SafeECDSARecoveryPlugin__factory,
  Safe__factory,
} from '../../hardhat/typechain-types';
import EthereumRpc from '../EthereumRpc';
import IAccount from './IAccount';
import WaxInPage from '..';
import { SafeECDSAFactory } from '../../hardhat/typechain-types/lib/account-integrations/safe/src/SafeECDSAFactory';
import receiptOf from '../helpers/receiptOf';
import SafeSingletonFactory, {
  SafeSingletonFactoryViewer,
} from '../SafeSingletonFactory';
import { executeContractCallWithSigners } from './execution';
import assert from '../helpers/assert';

export const SafeECDSAAccountData = z.object({
  type: z.literal('SafeECDSAAccount'),
  address: z.string(),
  privateKey: z.string(),
  ownerAddress: z.string(),
  recoveryAddress: z.optional(z.string()),
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
    public recoveryAddress: string | undefined,
    public waxInPage: WaxInPage,
  ) {}

  static fromData(data: SafeECDSAAccountData, waxInPage: WaxInPage) {
    return new SafeECDSAAccountWrapper(
      data.address,
      data.privateKey,
      data.ownerAddress,
      data.recoveryAddress,
      waxInPage,
    );
  }

  toData(): SafeECDSAAccountData {
    return {
      type: 'SafeECDSAAccount',
      address: this.address,
      privateKey: this.privateKey,
      ownerAddress: this.ownerAddress,
      recoveryAddress: this.recoveryAddress,
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
      undefined,
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
    const ownerWallet = new ethers.Wallet(this.privateKey);

    return await ownerWallet.signMessage(ethers.getBytes(userOpHash));
  }

  async enableRecoveryModule(recoveryAddress: string) {
    const provider = this.waxInPage.ethersProvider;
    const owner = new ethers.Wallet(this.privateKey, provider);
    const { chainId } = provider._network;

    const safeProxy = Safe__factory.connect(this.address, owner);
    const safeProxyAddress = await safeProxy.getAddress();

    const viewer = new SafeSingletonFactoryViewer(owner, chainId);
    const recoveryPluginDeployed = await viewer.isDeployed(
      SafeECDSARecoveryPlugin__factory,
      [safeProxyAddress, recoveryAddress],
    );

    let recoveryPlugin: SafeECDSARecoveryPlugin;
    if (recoveryPluginDeployed) {
      recoveryPlugin = viewer.connectAssume(SafeECDSARecoveryPlugin__factory, [
        safeProxyAddress,
        recoveryAddress,
      ]);
    } else {
      const admin = await this.waxInPage.requestAdminAccount(
        'deploy-contracts',
      );
      const factory = await SafeSingletonFactory.init(admin);

      recoveryPlugin = await factory.connectOrDeploy(
        SafeECDSARecoveryPlugin__factory,
        [safeProxyAddress, recoveryAddress],
      );
    }

    const recoveryPluginAddress = await recoveryPlugin.getAddress();

    let moduleEnabled = await safeProxy.isModuleEnabled(recoveryPluginAddress);
    if (!moduleEnabled) {
      await executeContractCallWithSigners(
        safeProxy,
        safeProxy,
        'enableModule',
        [recoveryPluginAddress],
        [owner],
      );

      moduleEnabled = await safeProxy.isModuleEnabled(recoveryPluginAddress);
      assert(moduleEnabled, 'module not enabled');

      this.recoveryAddress = recoveryAddress;
    }
  }

  async recoveryAccount(
    newOwnerAccountSeedPhrase: string,
    recoveryAddressSeedPhrase: string,
  ) {
    const provider = this.waxInPage.ethersProvider;
    const owner = new ethers.Wallet(this.privateKey, provider);
    const { chainId } = provider._network;

    const newOwnerWallet = ethers.Wallet.fromPhrase(
      newOwnerAccountSeedPhrase,
      provider,
    );
    const newOwnerAddress = newOwnerWallet.address;

    const recoveryWallet = ethers.Wallet.fromPhrase(
      recoveryAddressSeedPhrase,
      provider,
    );

    const safeProxy = Safe__factory.connect(this.address, owner);
    const safeProxyAddress = await safeProxy.getAddress();

    const viewer = new SafeSingletonFactoryViewer(owner, chainId);
    const recoveryPlugin = await viewer.connectOrThrow(
      SafeECDSARecoveryPlugin__factory,
      [safeProxyAddress, recoveryWallet.address],
    );

    const plugin = this.getContract();

    // TODO: ensure wallet is already funded
    await (
      await owner.sendTransaction({
        to: recoveryWallet.address,
        value: ethers.parseEther('0.1'),
      })
    ).wait();

    const pluginAddress = await plugin.myAddress();
    await recoveryPlugin
      .connect(recoveryWallet)
      .resetEcdsaAddress(safeProxyAddress, pluginAddress, newOwnerAddress);

    const expectedNewOwnerAddress = await plugin.ecdsaOwnerStorage(
      safeProxyAddress,
    );
    assert(
      newOwnerAddress === expectedNewOwnerAddress,
      'unexpected owner address',
    );

    this.ownerAddress = newOwnerAddress;
    this.privateKey = newOwnerWallet.privateKey;
  }
}

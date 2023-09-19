import ReactDOM from 'react-dom/client';
import React, { ReactNode } from 'react';

import { ethers } from 'ethers';
import EthereumApi from './EthereumApi';
import PermissionPopup from './PermissionPopup';
import sheetsRegistry from './sheetsRegistry';
import makeLocalWaxStorage, { WaxStorage } from './WaxStorage';
import {
  EntryPoint,
  EntryPoint__factory,
  Greeter,
  Greeter__factory,
  SimpleAccountFactory,
  SimpleAccountFactory__factory,
} from '../hardhat/typechain-types';
import SafeSingletonFactory, {
  SafeSingletonFactoryViewer,
} from './SafeSingletonFactory';
import ReusablePopup from './ReusablePopup';
import AdminPopup, { AdminPurpose } from './AdminPopup';
import waxPrivate from './waxPrivate';
import SimulatedBundler from './bundlers/SimulatedBundler';
import NetworkBundler from './bundlers/NetworkBundler';
import IBundler from './bundlers/IBundler';
import IAccount from './accounts/IAccount';
import { makeAccountWrapper } from './accounts/AccountData';
import SimpleAccountWrapper from './accounts/SimpleAccountWrapper';

type Config = {
  logRequests?: boolean;
  requirePermission: boolean;
  deployContractsIfNeeded: boolean;
  ethersPollingInterval?: number;
};

const defaultConfig: Config = {
  requirePermission: true,
  deployContractsIfNeeded: true,
};

let ethersDefaultPollingInterval = 4000;

type ConstructorOptions = {
  rpcUrl: string;
  bundlerRpcUrl?: string;
  storage?: WaxStorage;
};

export type Contracts = {
  greeter: Greeter;
  entryPoint: EntryPoint;
  simpleAccountFactory: SimpleAccountFactory;
};

export default class WaxInPage {
  #config = defaultConfig;
  #contractsDeployed = false;
  #reusablePopup?: ReusablePopup;
  #adminAccount?: ethers.Wallet;

  ethereum: EthereumApi;
  storage: WaxStorage;
  ethersProvider: ethers.BrowserProvider;

  constructor({
    rpcUrl,
    bundlerRpcUrl,
    storage = makeLocalWaxStorage(),
  }: ConstructorOptions) {
    let bundler: IBundler;

    if (bundlerRpcUrl === undefined) {
      bundler = new SimulatedBundler(this);
    } else {
      bundler = new NetworkBundler(bundlerRpcUrl);
    }

    this.ethereum = new EthereumApi(rpcUrl, this, bundler);
    this.storage = storage;
    this.ethersProvider = new ethers.BrowserProvider(this.ethereum);
    ethersDefaultPollingInterval = this.ethersProvider.pollingInterval;
  }

  static global(opt: ConstructorOptions) {
    new WaxInPage(opt).attachGlobals();
  }

  static addStylesheet() {
    queueMicrotask(() => {
      const style = document.createElement('style');
      style.textContent = sheetsRegistry.toString();
      document.head.append(style);
    });
  }

  attachGlobals() {
    const global = globalThis as Record<string, unknown>;

    global.waxInPage = this;
    global.ethereum = this.ethereum;
  }

  setConfig(newConfig: Partial<Config>) {
    this.#config = {
      ...this.#config,
      ...newConfig,
    };

    if ('ethersPollingInterval' in newConfig) {
      this.ethersProvider.pollingInterval =
        newConfig.ethersPollingInterval ?? ethersDefaultPollingInterval;
    }
  }

  getConfig<K extends keyof Config>(key: K): Config[K] {
    return structuredClone(this.#config[key]);
  }

  async requestPermission(message: ReactNode) {
    if (this.#config.requirePermission === false) {
      return true;
    }

    const popup = await this.getPopup();

    const response = await new Promise<boolean>((resolve) => {
      ReactDOM.createRoot(
        popup.getWindow().document.getElementById('root')!,
      ).render(
        <React.StrictMode>
          <PermissionPopup message={message} respond={resolve} />
        </React.StrictMode>,
      );

      popup.events.on('unload', () => resolve(false));
    });

    popup.close();

    return response;
  }

  async getContracts(
    runner: ethers.ContractRunner = this.ethersProvider,
  ): Promise<Contracts> {
    const chainId = BigInt(
      await this.ethereum.request({ method: 'eth_chainId' }),
    );

    const viewer = new SafeSingletonFactoryViewer(this.ethersProvider, chainId);

    const assumedEntryPoint = viewer.connectAssume(EntryPoint__factory, []);

    const contracts = {
      greeter: viewer.connectAssume(Greeter__factory, ['']).connect(runner),
      entryPoint: assumedEntryPoint,
      simpleAccountFactory: viewer.connectAssume(
        SimpleAccountFactory__factory,
        [await assumedEntryPoint.getAddress()],
      ),
    };

    if (this.#contractsDeployed) {
      return contracts;
    }

    if (await this.#checkDeployments(contracts)) {
      this.#contractsDeployed = true;
      return contracts;
    }

    if (!this.#config.deployContractsIfNeeded) {
      throw new Error('Contracts not deployed');
    }

    const wallet = await this.requestAdminAccount('deploy-contracts');

    const factory = await SafeSingletonFactory.init(wallet);

    const entryPoint = await factory.connectOrDeploy(EntryPoint__factory, []);

    const deployments: {
      [C in keyof Contracts]: () => Promise<Contracts[C]>;
    } = {
      greeter: () => factory.connectOrDeploy(Greeter__factory, ['']),
      entryPoint: () => Promise.resolve(entryPoint),
      simpleAccountFactory: async () =>
        factory.connectOrDeploy(SimpleAccountFactory__factory, [
          await entryPoint.getAddress(),
        ]),
    };

    for (const deployment of Object.values(deployments)) {
      // eslint-disable-next-line no-await-in-loop
      await deployment();
    }

    return contracts;
  }

  async #checkDeployments(contracts: Contracts): Promise<boolean> {
    const deployFlags = await Promise.all(
      Object.values(contracts).map(async (contract) => {
        const existingCode = await this.ethersProvider.getCode(
          contract.getAddress(),
        );

        return existingCode !== '0x';
      }),
    );

    return deployFlags.every((flag) => flag);
  }

  async requestAdminAccount(purpose: AdminPurpose): Promise<ethers.Wallet> {
    if (this.#adminAccount) {
      return this.#adminAccount;
    }

    const popup = await this.getPopup();

    let deployerKeyData: string;

    try {
      deployerKeyData = await new Promise<string>((resolve, reject) => {
        ReactDOM.createRoot(
          popup.getWindow().document.getElementById('root')!,
        ).render(
          <React.StrictMode>
            <AdminPopup purpose={purpose} resolve={resolve} reject={reject} />
          </React.StrictMode>,
        );

        popup.events.on('unload', () => reject(new Error('Popup closed')));
      });
    } finally {
      popup.close();
    }

    if (ethers.Mnemonic.isValidMnemonic(deployerKeyData)) {
      const hdNode = ethers.HDNodeWallet.fromPhrase(deployerKeyData);

      this.#adminAccount = new ethers.Wallet(
        hdNode.privateKey,
        this.ethersProvider,
      );
    } else {
      this.#adminAccount = new ethers.Wallet(
        deployerKeyData,
        this.ethersProvider,
      );
    }

    return this.#adminAccount;
  }

  getTestWallet(index: number): ethers.Wallet {
    const hdNode = ethers.HDNodeWallet.fromPhrase(
      `${'test '.repeat(11)}junk`,
      undefined,
      "m/44'/60'/0'/0",
    );

    return new ethers.Wallet(
      hdNode.deriveChild(index).privateKey,
      this.ethersProvider,
    );
  }

  async getPopup() {
    if (this.#reusablePopup) {
      await this.#reusablePopup.reuse();
    } else {
      this.#reusablePopup = await ReusablePopup.create();
    }

    return this.#reusablePopup;
  }

  async disconnect() {
    await this.storage.connectedAccounts.clear();
  }

  async _getAccount(waxPrivateParam: symbol): Promise<IAccount> {
    if (waxPrivateParam !== waxPrivate) {
      throw new Error('This method is private to the waxInPage library');
    }

    const existingAccounts = await this.storage.accounts.get();

    if (existingAccounts.length > 0) {
      return await makeAccountWrapper(existingAccounts[0], this);
    }

    const simpleAccount = await SimpleAccountWrapper.createRandom(this);

    await this.storage.accounts.set([simpleAccount.toData()]);

    return simpleAccount;
  }
}

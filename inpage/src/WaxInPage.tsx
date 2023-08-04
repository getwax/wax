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

const defaultConfig = {
  requirePermission: true,
  deployContractsIfNeeded: true,
};

export type Contracts = {
  greeter: Greeter;
  entryPoint: EntryPoint;
  simpleAccountFactory: SimpleAccountFactory;
};

type Config = typeof defaultConfig;

export default class WaxInPage {
  #config = defaultConfig;
  #contractsDeployed = false;
  #reusablePopup?: ReusablePopup;
  #adminAccount?: ethers.Wallet;

  ethereum: EthereumApi;
  storage: WaxStorage;
  ethersProvider: ethers.BrowserProvider;

  constructor(storage = makeLocalWaxStorage()) {
    this.ethereum = new EthereumApi(this);
    this.storage = storage;
    this.ethersProvider = new ethers.BrowserProvider(this.ethereum);
  }

  static global() {
    new WaxInPage().attachGlobals();
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
  }

  async requestPermission(message: ReactNode) {
    if (this.#config.requirePermission === false) {
      return true;
    }

    const popup = await this.getPopup();

    const response = await new Promise<boolean>((resolve) => {
      ReactDOM.createRoot(popup.window.document.getElementById('root')!).render(
        <React.StrictMode>
          <PermissionPopup message={message} respond={resolve} />
        </React.StrictMode>,
      );

      popup.events.on('unload', () => resolve(false));
    });

    popup.close();

    return response;
  }

  // Usually you could do `simpleAccountFactory.getAddress()` to get its
  // address, but SimpleAccountFactory overrides getAddress to be a function for
  // getting the address of an account, which makes the ethers .getAddress
  // builtin inaccessible.
  //
  // Proposed fix:
  //   https://github.com/eth-infinitism/account-abstraction/pull/323
  //
  async getSimpleAccountFactoryAddress(): Promise<string> {
    const chainId = BigInt(
      await this.ethereum.request({ method: 'eth_chainId' }),
    );

    const viewer = new SafeSingletonFactoryViewer(this.ethersProvider, chainId);

    const entryPointAddress = viewer.calculateAddress(EntryPoint__factory, []);

    return viewer.calculateAddress(SimpleAccountFactory__factory, [
      entryPointAddress,
    ]);
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
          popup.window.document.getElementById('root')!,
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
}

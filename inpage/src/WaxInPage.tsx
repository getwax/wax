import ReactDOM from 'react-dom/client';
import React from 'react';

import { ethers } from 'ethers';
import EthereumApi from './EthereumApi';
import assert from './helpers/assert';
import popupUrl from './popupUrl';
import PermissionPopup from './PermissionPopup';
import sheetsRegistry from './sheetsRegistry';
import makeLocalWaxStorage, { WaxStorage } from './WaxStorage';
import { Greeter, Greeter__factory } from '../hardhat/typechain-types';
import SafeSingletonFactory, {
  SafeSingletonFactoryViewer,
} from './SafeSingletonFactory';

const defaultConfig = {
  requirePermission: true,
  deploymentUI: true,
};

type Contracts = {
  greeter: Greeter;
};

type Config = typeof defaultConfig;

export default class WaxInPage {
  #config = defaultConfig;
  #contractsDeployed = false;

  ethersProvider: ethers.BrowserProvider;

  private constructor(
    public ethereum: EthereumApi,
    public storage: WaxStorage,
  ) {
    this.ethersProvider = new ethers.BrowserProvider(this.ethereum);
  }

  static create(): WaxInPage {
    const storage = makeLocalWaxStorage();

    const wax: WaxInPage = new WaxInPage(
      new EthereumApi((message) => wax.requestPermission(message), storage),
      storage,
    );

    return wax;
  }

  static global() {
    WaxInPage.create().attachGlobals();
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

  async requestPermission(message: string) {
    if (this.#config.requirePermission === false) {
      return true;
    }

    const opt = {
      popup: true,
      width: 400,
      height: 600,
      left:
        window.screenLeft + window.innerWidth * window.devicePixelRatio - 410,
      top: window.screenTop + 60,
    };

    const popup = window.open(
      popupUrl,
      undefined,
      Object.entries(opt)
        .map(([k, v]) => `${k}=${v.toString()}`)
        .join(', '),
    );

    assert(popup !== null);

    await new Promise((resolve) => {
      popup.addEventListener('load', resolve);
    });

    const style = document.createElement('style');
    style.textContent = sheetsRegistry.toString();

    popup.document.head.append(style);

    const response = await new Promise<boolean>((resolve) => {
      ReactDOM.createRoot(popup.document.getElementById('root')!).render(
        <React.StrictMode>
          <PermissionPopup message={message} respond={resolve} />
        </React.StrictMode>,
      );

      popup.addEventListener('unload', () => resolve(false));
    });

    popup.close();

    return response;
  }

  async getContracts(runner?: ethers.ContractRunner): Promise<Contracts> {
    const chainId = BigInt(
      await this.ethereum.request({ method: 'eth_chainId' }),
    );

    const viewer = new SafeSingletonFactoryViewer(this.ethersProvider, chainId);

    const contracts = {
      greeter: viewer.connectAssume(Greeter__factory, ['']).connect(runner),
    };

    if (this.#contractsDeployed) {
      return contracts;
    }

    if (await this.#checkDeployments(contracts)) {
      this.#contractsDeployed = true;
      return contracts;
    }

    const wallet = await this.#requestDeployerWallet();

    const factory = await SafeSingletonFactory.init(wallet);

    const deployments: {
      [C in keyof Contracts]: () => Promise<Contracts[C]>;
    } = {
      greeter: () => factory.connectOrDeploy(Greeter__factory, ['']),
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

  async #requestDeployerWallet(): Promise<ethers.Wallet> {
    // eslint-disable-next-line @typescript-eslint/await-thenable
    await 0;

    if (this.#config.deploymentUI) {
      // TODO: Use UI to get custom phrase
    }

    return this.getTestWallet(0);
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
}

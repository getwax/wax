import { createContext, useContext, useEffect, useState } from 'react';
import { ethers } from 'ethers';
import WaxInPage, { Contracts, EthereumApi } from '../src';
import TypedEmitter from './helpers/TypedEmitter';
import runAsync from './helpers/runAsync';
import config from './config/config';

type BalanceUpdate = { address: string; balance: bigint };

export default class DemoContext {
  ethereum: EthereumApi;
  address?: string;
  contracts?: Contracts;
  #contractsPromise?: Promise<Contracts>;

  events = new TypedEmitter<{
    addressChanged(newAddress?: string): void;
    contractsChanged(newContracts?: Contracts): void;
    balanceChanged(update: BalanceUpdate): void;
  }>();

  constructor(public waxInPage: WaxInPage) {
    this.ethereum = waxInPage.ethereum;
    waxInPage.setDeployerSeedPhrase(config.deployerSeedPhrase);

    runAsync(async () => {
      const accounts = await this.ethereum.request({
        method: 'eth_accounts',
      });

      if (accounts.length > 0) {
        this.setAddress(accounts[0]);
      }
    });
  }

  private static context = createContext<DemoContext>({} as DemoContext);

  static Provider = DemoContext.context.Provider;

  static use = () => useContext(DemoContext.context);

  async clear() {
    await this.waxInPage.storage.clear();
    this.setAddress(undefined);
  }

  async disconnect() {
    await this.waxInPage.disconnect();
    this.setAddress(undefined);
  }

  setAddress(newAddress?: string) {
    this.address = newAddress;
    this.events.emit('addressChanged', newAddress);
  }

  setContracts(newContracts?: Contracts) {
    this.contracts = newContracts;
    this.events.emit('contractsChanged', newContracts);
  }

  async requestAddress() {
    const response = await this.ethereum.request({
      method: 'eth_requestAccounts',
    });

    this.setAddress(response[0]);
  }

  useAddress = () => {
    const [address, setAddress] = useState(this.address);

    useEffect(() => {
      const listener = (newAddress: string) => {
        setAddress(newAddress);
      };

      this.events.on('addressChanged', listener);

      return () => {
        this.events.off('addressChanged', listener);
      };
    }, []);

    return address;
  };

  useContracts = () => {
    const [contracts, setContracts] = useState(this.contracts);

    useEffect(() => {
      const listener = (newContracts: Contracts) => {
        setContracts(newContracts);
      };

      this.events.on('contractsChanged', listener);

      if (!this.contracts) {
        void this.getContracts();
      }

      return () => {
        this.events.off('contractsChanged', listener);
      };
    }, []);

    return contracts;
  };

  async getContracts() {
    if (this.#contractsPromise) {
      return await this.#contractsPromise;
    }

    this.#contractsPromise = this.waxInPage.getContracts();

    try {
      const contracts = await this.#contractsPromise;
      this.setContracts(contracts);
      return contracts;
    } finally {
      this.#contractsPromise = undefined;
    }
  }

  useSigner = () => {
    const [signer, setSigner] = useState<ethers.Signer>();

    useEffect(() => {
      runAsync(async () => {
        setSigner(await this.waxInPage.ethersProvider.getSigner());
      });
    }, []);

    return signer;
  };

  useBalance = () => {
    const address = this.useAddress();
    const [balance, setBalance] = useState<bigint>();

    useEffect(() => {
      if (address === undefined) {
        return () => undefined;
      }

      const handleBalanceChange = (update: BalanceUpdate) => {
        if (update.address === address) {
          setBalance(update.balance);
        }
      };

      runAsync(async () => {
        const newBalance = await this.waxInPage.ethersProvider.getBalance(
          address,
        );

        this.events.emit('balanceChanged', { address, balance: newBalance });
      });

      this.events.on('balanceChanged', handleBalanceChange);

      return () => {
        this.events.off('balanceChanged', handleBalanceChange);
      };
    }, [address]);

    return balance;
  };

  refreshBalance = async () => {
    if (this.address === undefined) {
      return;
    }

    const balance = await this.waxInPage.ethersProvider.getBalance(
      this.address,
    );

    this.events.emit('balanceChanged', { address: this.address, balance });
  };
}

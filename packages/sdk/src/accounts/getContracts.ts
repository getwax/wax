import { ethers } from 'ethers';

import {
  AddressRegistry,
  AddressRegistry__factory,
  EntryPoint,
  EntryPoint__factory,
  FallbackDecompressor,
  FallbackDecompressor__factory,
  Greeter,
  Greeter__factory,
  Safe,
  SafeCompressionFactory,
  SafeCompressionFactory__factory,
  SafeECDSAFactory,
  SafeECDSAFactory__factory,
  SafeECDSARecoveryPlugin,
  SafeECDSARecoveryPlugin__factory,
  Safe__factory,
  SimpleAccountFactory,
  SimpleAccountFactory__factory,
} from '../../../../demos/inpage/hardhat/typechain-types';
import SafeSingletonFactory, {
  SafeSingletonFactoryViewer,
} from './SafeSingletonFactory';

export type Contracts = {
    greeter: Greeter;
    entryPoint: EntryPoint;
    simpleAccountFactory: SimpleAccountFactory;
    safe: Safe;
    safeECDSAFactory: SafeECDSAFactory;
    safeCompressionFactory: SafeCompressionFactory;
    fallbackDecompressor: FallbackDecompressor;
    addressRegistry: AddressRegistry;
    safeECDSARecoveryPlugin: SafeECDSARecoveryPlugin;
};

async function getContracts(
  provider: ethers.BrowserProvider,
  adminAccount?: ethers.Signer
): Promise<Contracts> {

  const viewer = new SafeSingletonFactoryViewer(
    provider,
    (await provider.getNetwork()).chainId
  );

  const assumedEntryPoint = viewer.connectAssume(EntryPoint__factory, []);

  const assumedAddressRegistry = viewer.connectAssume(
    AddressRegistry__factory,
    [],
  );

  const contracts: Contracts = {
    greeter: viewer.connectAssume(Greeter__factory, ['']).connect(provider),
    entryPoint: assumedEntryPoint,
    simpleAccountFactory: viewer.connectAssume(
      SimpleAccountFactory__factory,
      [await assumedEntryPoint.getAddress()],
    ),
    safe: viewer.connectAssume(Safe__factory, []),
    safeECDSAFactory: viewer.connectAssume(SafeECDSAFactory__factory, []),
    safeCompressionFactory: viewer.connectAssume(
      SafeCompressionFactory__factory,
      [],
    ),
    fallbackDecompressor: viewer.connectAssume(
      FallbackDecompressor__factory,
      [await assumedAddressRegistry.getAddress()],
    ),
    addressRegistry: assumedAddressRegistry,
    safeECDSARecoveryPlugin: viewer.connectAssume(
      SafeECDSARecoveryPlugin__factory,
      [],
    ),
  };

  if (await checkDeployments(contracts, provider)) {
    return contracts;
  }

  if (!adminAccount) {
    throw new Error('Contracts not deployed, and no admin account provided.');
  }

  const wallet = adminAccount;

  const factory = await SafeSingletonFactory.init(wallet);

  const entryPoint = await factory.connectOrDeploy(EntryPoint__factory, []);

  const addressRegistry = await factory.connectOrDeploy(
    AddressRegistry__factory,
    [],
  );

  const deployments: {
    [C in keyof Contracts]: () => Promise<Contracts[C]>;
  } = {
    greeter: () => factory.connectOrDeploy(Greeter__factory, ['']),
    entryPoint: () => Promise.resolve(entryPoint),
    simpleAccountFactory: async () =>
      factory.connectOrDeploy(SimpleAccountFactory__factory, [
        await entryPoint.getAddress(),
      ]),
    safe: () => factory.connectOrDeploy(Safe__factory, []),
    safeECDSAFactory: () =>
      factory.connectOrDeploy(SafeECDSAFactory__factory, []),
    safeCompressionFactory: () =>
      factory.connectOrDeploy(SafeCompressionFactory__factory, []),
    fallbackDecompressor: async () =>
      factory.connectOrDeploy(FallbackDecompressor__factory, [
        await addressRegistry.getAddress(),
      ]),
    addressRegistry: () => Promise.resolve(addressRegistry),
    safeECDSARecoveryPlugin: () =>
      factory.connectOrDeploy(SafeECDSARecoveryPlugin__factory, []),
  };

  for (const deployment of Object.values(deployments)) {
    await deployment();
  }

  return contracts;
}

async function checkDeployments(
  contracts: Contracts,
  provider: ethers.BrowserProvider,
): Promise<boolean> {
  const deployFlags = await Promise.all(
    Object.values(contracts).map(async (contract) => {
      const existingCode = await provider.getCode(
        contract.getAddress(),
      );

      return existingCode !== '0x';
    }),
  );

  return deployFlags.every((flag) => flag);
}

export default getContracts;
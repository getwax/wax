import { ethers, NonceManager } from "ethers";
import { AddressZero } from "@ethersproject/constants";
import { calculateProxyAddress } from "./calculateProxyAddress";
import { UserOperationStruct } from "@account-abstraction/contracts";

import { SafeProxyFactory } from "../../../typechain-types/lib/safe-contracts/contracts/proxies/SafeProxyFactory";
import { Safe } from "../../../typechain-types/lib/safe-contracts/contracts/Safe";
import {
  EntryPoint__factory,
  SafeBlsPlugin,
  SafeProxyFactory__factory,
  SafeWebAuthnPlugin,
  Safe__factory,
} from "../../../typechain-types";
import SafeSingletonFactory from "./SafeSingletonFactory";
import receiptOf from "./receiptOf";
import makeDevFaster from "./makeDevFaster";

export async function setupTests() {
  const { BUNDLER_URL, NODE_URL, MNEMONIC } = process.env;

  if (!BUNDLER_URL) {
    throw new Error(
      "missing bundler env var BUNDLER_URL. Make sure you have copied or created a .env file",
    );
  }
  if (!NODE_URL) {
    throw new Error(
      "missing bundler env var NODE_URL. Make sure you have copied or created a .env file",
    );
  }
  if (!MNEMONIC) {
    throw new Error(
      "missing bundler env var MNEMONIC. Make sure you have copied or created a .env file",
    );
  }

  const bundlerProvider = new ethers.JsonRpcProvider(BUNDLER_URL);
  const provider = new ethers.JsonRpcProvider(NODE_URL);
  await makeDevFaster(provider);

  const admin = new NonceManager(
    ethers.Wallet.fromPhrase(MNEMONIC).connect(provider),
  );
  const owner = ethers.Wallet.createRandom(provider);

  await receiptOf(
    await admin.sendTransaction({
      to: owner.address,
      value: ethers.parseEther("1"),
    }),
  );

  const entryPoints = (await bundlerProvider.send(
    "eth_supportedEntryPoints",
    [],
  )) as string[];

  if (entryPoints.length === 0) {
    throw new Error("No entry points found");
  }

  const entryPointAddress = entryPoints[0];

  const ssf = await SafeSingletonFactory.init(admin);

  const safeProxyFactory = await ssf.connectOrDeploy(
    SafeProxyFactory__factory,
    [],
  );
  const safeSingleton = await ssf.connectOrDeploy(Safe__factory, []);

  return {
    bundlerProvider,
    provider,
    admin,
    owner,
    entryPointAddress,
    safeProxyFactory,
    safeSingleton,
  };
}

type Plugin = SafeBlsPlugin | SafeWebAuthnPlugin;

export const createUnsignedUserOperationWithInitCode = async (
  provider: ethers.JsonRpcProvider,
  bundlerProvider: ethers.JsonRpcProvider,
  admin: NonceManager,
  owner: ethers.HDNodeWallet,
  plugin: Plugin,
  safeSingleton: Safe,
  safeProxyFactory: SafeProxyFactory,
  entryPointAddress: string,
  recipientAddress: string,
  transferAmount: bigint,
  dummySignature: string,
) => {
  const pluginAddress = await plugin.getAddress();
  const singletonAddress = await safeSingleton.getAddress();
  const factoryAddress = await safeProxyFactory.getAddress();

  const moduleInitializer = plugin.interface.encodeFunctionData("enableMyself");
  const encodedInitializer = safeSingleton.interface.encodeFunctionData(
    "setup",
    [
      [owner.address],
      1,
      pluginAddress,
      moduleInitializer,
      pluginAddress,
      AddressZero,
      0,
      AddressZero,
    ],
  );

  const deployedAddress = await calculateProxyAddress(
    safeProxyFactory,
    await safeSingleton.getAddress(),
    encodedInitializer,
    73,
  );

  // Native tokens for the pre-fund 💸
  await receiptOf(
    admin.sendTransaction({
      to: deployedAddress,
      value: ethers.parseEther("10"),
    }),
  );

  // The initCode contains 20 bytes of the factory address and the rest is the
  // calldata to be forwarded
  const initCode = ethers.concat([
    factoryAddress,
    safeProxyFactory.interface.encodeFunctionData("createProxyWithNonce", [
      singletonAddress,
      encodedInitializer,
      73,
    ]),
  ]);

  const userOpCallData = plugin.interface.encodeFunctionData(
    "execTransaction",
    [recipientAddress, transferAmount, "0x00"],
  );

  const userOperationWithoutGasFields = {
    sender: deployedAddress,
    nonce: "0x0",
    initCode,
    callData: userOpCallData,
    callGasLimit: "0x00",
    paymasterAndData: "0x",
    signature: dummySignature,
  };

  const {
    callGasLimit,
    verificationGasLimit,
    preVerificationGas,
    maxFeePerGas,
    maxPriorityFeePerGas,
  } = await getGasEstimates(
    provider,
    bundlerProvider,
    userOperationWithoutGasFields,
    entryPointAddress,
  );

  const unsignedUserOperation = {
    sender: deployedAddress,
    nonce: "0x0",
    initCode,
    callData: userOpCallData,
    callGasLimit,
    verificationGasLimit,
    preVerificationGas,
    maxFeePerGas,
    maxPriorityFeePerGas,
    paymasterAndData: "0x",
    signature: dummySignature,
  } satisfies UserOperationStruct;

  return await ethers.resolveProperties(unsignedUserOperation);
};

export const createUnsignedUserOperation = async (
  provider: ethers.JsonRpcProvider,
  bundlerProvider: ethers.JsonRpcProvider,
  accountAddress: string,
  userOpCallData: string,
  entryPointAddress: string,
  dummySignature: string,
) => {
  // Note: initCode is not used because we need to create both the safe
  // proxy and the plugin, and 4337 currently only allows one contract
  // creation in this step. Since we need an extra step anyway, it's simpler
  // to do the whole create outside of 4337.
  const initCode = "0x";

  const entryPoint = EntryPoint__factory.connect(
    entryPointAddress,
    await provider.getSigner(),
  );
  const nonce = await entryPoint.getNonce(accountAddress, "0x00");
  const nonceHex = "0x0" + nonce.toString();

  const userOperationWithoutGasFields = {
    sender: accountAddress,
    nonce: nonceHex,
    initCode,
    callData: userOpCallData,
    callGasLimit: "0x00",
    paymasterAndData: "0x",
    signature: dummySignature,
  };

  const {
    callGasLimit,
    verificationGasLimit,
    preVerificationGas,
    maxFeePerGas,
    maxPriorityFeePerGas,
  } = await getGasEstimates(
    provider,
    bundlerProvider,
    userOperationWithoutGasFields,
    entryPointAddress,
  );

  const unsignedUserOperation = {
    sender: accountAddress,
    nonce: nonceHex,
    initCode,
    callData: userOpCallData,
    callGasLimit,
    verificationGasLimit: "0x186A0",
    // verificationGasLimit,
    preVerificationGas,
    maxFeePerGas,
    maxPriorityFeePerGas,
    paymasterAndData: "0x",
    signature: dummySignature,
  } satisfies UserOperationStruct;

  return await ethers.resolveProperties(unsignedUserOperation);
};

export const getGasEstimates = async (
  provider: ethers.JsonRpcProvider,
  bundlerProvider: ethers.JsonRpcProvider,
  userOperationWithoutGasFields: any,
  entryPointAddress: string,
) => {
  const gasEstimate = (await bundlerProvider.send(
    "eth_estimateUserOperationGas",
    [userOperationWithoutGasFields, entryPointAddress],
  )) as {
    verificationGasLimit: string;
    preVerificationGas: string;
    callGasLimit: string;
  };

  const safeVerificationGasLimit =
    BigInt(gasEstimate.verificationGasLimit) +
    BigInt(gasEstimate.verificationGasLimit) / 5n; // + 20%
  // BigInt(gasEstimate.verificationGasLimit); // / 2n; // + 20%

  const safePreVerificationGas =
    BigInt(gasEstimate.preVerificationGas) +
    BigInt(gasEstimate.preVerificationGas) / 50n; // + 2%

  const { maxFeePerGas, maxPriorityFeePerGas } = await getFeeData(provider);

  return {
    callGasLimit: gasEstimate.callGasLimit,
    verificationGasLimit: ethers.toBeHex(safeVerificationGasLimit),
    preVerificationGas: ethers.toBeHex(safePreVerificationGas),
    maxFeePerGas,
    maxPriorityFeePerGas,
  };

  async function getFeeData(provider: ethers.Provider) {
    const feeData = await provider.getFeeData();
    if (!feeData.maxFeePerGas || !feeData.maxPriorityFeePerGas) {
      throw new Error(
        "maxFeePerGas or maxPriorityFeePerGas is null or undefined",
      );
    }

    const maxFeePerGas = "0x" + feeData.maxFeePerGas.toString();
    const maxPriorityFeePerGas = "0x" + feeData.maxPriorityFeePerGas.toString();

    return { maxFeePerGas, maxPriorityFeePerGas };
  }
};

import { ethers } from "hardhat";
import { HDNodeWallet, getBytes } from "ethers";
import { AddressZero } from "@ethersproject/constants";
import { calculateProxyAddress } from "./calculateProxyAddress";
import { getUserOpHash } from "@account-abstraction/utils";
import { UserOperationStruct } from "@account-abstraction/contracts";

import { SafeProxyFactory } from "../../../typechain-types/lib/safe-contracts/contracts/proxies/SafeProxyFactory";
import { Safe } from "../../../typechain-types/lib/safe-contracts/contracts/Safe";
import { EntryPoint } from "../../../typechain-types/lib/account-abstraction/contracts/core/EntryPoint";

const MNEMONIC = "test test test test test test test test test test test junk";

export async function setupTests() {
  const safeProxyFactory = await (
    await ethers.getContractFactory("SafeProxyFactory")
  ).deploy();
  const safeContract = await (await ethers.getContractFactory("Safe")).deploy();
  const entryPointContract = await (
    await ethers.getContractFactory("EntryPoint")
  ).deploy();

  const provider = ethers.provider;
  const safeOwner = ethers.Wallet.fromPhrase(MNEMONIC).connect(provider);

  const { safeEcdsaPluginContract, counterfactualAddress } =
    await deploySafeAndECDSAPlugin(
      safeOwner,
      entryPointContract,
      safeContract,
      safeProxyFactory,
    );

  return {
    provider,
    safeOwner,
    safeProxyFactory,
    safeContract,
    entryPointContract,
    safeEcdsaPluginContract,
    counterfactualAddress,
  };
}

async function deploySafeAndECDSAPlugin(
  wallet: HDNodeWallet,
  entryPoint: EntryPoint,
  safe: Safe,
  safeProxyFactory: SafeProxyFactory,
) {
  const ENTRYPOINT_ADDRESS = await entryPoint.getAddress();

  const safeECDSAPluginFactory = (
    await ethers.getContractFactory("SafeECDSAPlugin")
  ).connect(wallet);

  const safeEcdsaPluginContract = await safeECDSAPluginFactory.deploy(
    ENTRYPOINT_ADDRESS,
    { gasLimit: 10_000_000 },
  );

  const safeECDSAPluginAddress = await safeEcdsaPluginContract.getAddress();
  const singletonAddress = await safe.getAddress();
  const factoryAddress = await safeProxyFactory.getAddress();

  const moduleInitializer =
    safeEcdsaPluginContract.interface.encodeFunctionData("enableMyself", [
      wallet.address,
    ]);

  const encodedInitializer = safe.interface.encodeFunctionData("setup", [
    [wallet.address],
    1,
    safeECDSAPluginAddress,
    moduleInitializer,
    safeECDSAPluginAddress,
    AddressZero,
    0,
    AddressZero,
  ]);
  const counterfactualAddress = await calculateProxyAddress(
    safeProxyFactory,
    singletonAddress,
    encodedInitializer,
    73,
  );

  // The initCode contains 20 bytes of the factory address and the rest is the calldata to be forwarded
  const initCode = ethers.concat([
    factoryAddress,
    safeProxyFactory.interface.encodeFunctionData("createProxyWithNonce", [
      singletonAddress,
      encodedInitializer,
      73,
    ]),
  ]);

  // Native tokens for the pre-fund 💸
  await wallet.sendTransaction({
    to: counterfactualAddress,
    value: ethers.parseEther("100"),
  });

  await sendTx(
    wallet,
    entryPoint,
    counterfactualAddress,
    "0x0",
    initCode,
    "0x",
  );

  return { safeEcdsaPluginContract, counterfactualAddress };
}

export async function sendTx(
  signer: HDNodeWallet,
  entryPoint: EntryPoint,
  sender: string,
  nonce: string,
  initCode?: string,
  callData?: string,
) {
  const provider = ethers.provider;
  const { maxFeePerGas, maxPriorityFeePerGas } = await getFeeData();
  const entryPointAddress = await entryPoint.getAddress();

  const unsignedUserOperation = {
    sender,
    nonce,
    initCode: initCode ?? "0x",
    callData: callData ?? "0x",
    verificationGasLimit: 1e6,
    callGasLimit: 1e6,
    preVerificationGas: 1e6,
    maxFeePerGas,
    maxPriorityFeePerGas,
    paymasterAndData: "0x",
    signature: "",
  } satisfies UserOperationStruct;

  const resolvedUserOp = await ethers.resolveProperties(unsignedUserOperation);
  const userOpHash = getUserOpHash(
    resolvedUserOp,
    entryPointAddress,
    Number((await provider.getNetwork()).chainId),
  );

  const userOpSignature = await signer.signMessage(getBytes(userOpHash));

  const userOperation = {
    ...unsignedUserOperation,
    signature: userOpSignature,
  };

  try {
    const _rcpt = await entryPoint.handleOps(
      [userOperation],
      entryPointAddress,
    );
  } catch (e) {
    console.log("EntryPoint handleOps error=", e);
  }
}

async function getFeeData() {
  const feeData = await ethers.provider.getFeeData();
  if (!feeData.maxFeePerGas || !feeData.maxPriorityFeePerGas) {
    throw new Error(
      "maxFeePerGas or maxPriorityFeePerGas is null or undefined",
    );
  }

  const maxFeePerGas = "0x" + feeData.maxFeePerGas.toString();
  const maxPriorityFeePerGas = "0x" + feeData.maxPriorityFeePerGas.toString();

  return { maxFeePerGas, maxPriorityFeePerGas };
}

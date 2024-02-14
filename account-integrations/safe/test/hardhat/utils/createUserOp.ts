import { ethers, getBytes, HDNodeWallet, NonceManager } from "ethers";
import { AddressZero } from "@ethersproject/constants";
import { UserOperationStruct } from "@account-abstraction/contracts";
import { getUserOpHash } from "@account-abstraction/utils";

import { SafeProxyFactory } from "../../../typechain-types/lib/safe-contracts/contracts/proxies/SafeProxyFactory";
import { Safe } from "../../../typechain-types/lib/safe-contracts/contracts/Safe";
import {
  EntryPoint__factory,
  SafeBlsPlugin,
  SafeECDSAPlugin,
  SafeECDSAPluginStateless,
  SafeProxyFactoryBrokenDeployment,
  SafeWebAuthnPlugin,
} from "../../../typechain-types";
import receiptOf from "./receiptOf";
import { calculateProxyAddress } from "./calculateProxyAddress";
import { getGasEstimates } from "./getGasEstimates";
import sendUserOpAndWait from "./sendUserOpAndWait";

type Plugin =
  | SafeBlsPlugin
  | SafeWebAuthnPlugin
  | SafeECDSAPlugin
  | SafeECDSAPluginStateless;

export const generateInitCodeAndAddress = async (
  admin: NonceManager,
  owner: ethers.HDNodeWallet,
  plugin: Plugin,
  safeSingleton: Safe,
  safeProxyFactory: SafeProxyFactory | SafeProxyFactoryBrokenDeployment,
  createFunctionName:
    | "createProxyWithNonce"
    | "createProxyWithNonceExtraCREATE2Opcode"
    | "createProxyWithNonceWithCREATEOpcode",
) => {
  const pluginAddress = await plugin.getAddress();
  const singletonAddress = await safeSingleton.getAddress();
  const factoryAddress = await safeProxyFactory.getAddress();

  let moduleInitializer: string;

  if ("getOwner" in plugin) {
    moduleInitializer = plugin.interface.encodeFunctionData("enableMyself", [
      owner.address,
    ]);
  } else {
    moduleInitializer = plugin.interface.encodeFunctionData("enableMyself");
  }

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

  // Native tokens for the pre-fund
  await receiptOf(
    admin.sendTransaction({
      to: deployedAddress,
      value: ethers.parseEther("10"),
    }),
  );

  // The initCode contains 20 bytes of the factory address and the rest is the
  // calldata to be forwarded
  let initCode: string;

  if (
    createFunctionName === "createProxyWithNonceExtraCREATE2Opcode" &&
    "createProxyWithNonceExtraCREATE2Opcode" in safeProxyFactory
  ) {
    initCode = ethers.concat([
      factoryAddress,
      safeProxyFactory.interface.encodeFunctionData(
        "createProxyWithNonceExtraCREATE2Opcode",
        [singletonAddress, encodedInitializer, 73],
      ),
    ]);
  } else if (
    createFunctionName === "createProxyWithNonceWithCREATEOpcode" &&
    "createProxyWithNonceExtraCREATE2Opcode" in safeProxyFactory
  ) {
    initCode = ethers.concat([
      factoryAddress,
      safeProxyFactory.interface.encodeFunctionData(
        "createProxyWithNonceWithCREATEOpcode",
        [singletonAddress, encodedInitializer, 73],
      ),
    ]);
  } else {
    initCode = ethers.concat([
      factoryAddress,
      safeProxyFactory.interface.encodeFunctionData("createProxyWithNonce", [
        singletonAddress,
        encodedInitializer,
        73,
      ]),
    ]);
  }

  return { initCode, deployedAddress };
};

export const createUserOperation = async (
  provider: ethers.JsonRpcProvider,
  bundlerProvider: ethers.JsonRpcProvider,
  accountAddress: string,
  initCode: string,
  userOpCallData: string,
  entryPointAddress: string,
  dummySignature: string,
) => {
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
    verificationGasLimit,
    preVerificationGas,
    maxFeePerGas,
    maxPriorityFeePerGas,
    paymasterAndData: "0x",
    signature: dummySignature,
  } satisfies UserOperationStruct;

  return await ethers.resolveProperties(unsignedUserOperation);
};

export const createAndSendUserOpWithEcdsaSig = async (
  provider: ethers.JsonRpcProvider,
  bundlerProvider: ethers.JsonRpcProvider,
  owner: HDNodeWallet,
  accountAddress: string,
  initCode: string,
  userOpCallData: string,
  entryPointAddress: string,
  dummySignature: string,
) => {
  const unsignedUserOperation = await createUserOperation(
    provider,
    bundlerProvider,
    accountAddress,
    initCode,
    userOpCallData,
    entryPointAddress,
    dummySignature,
  );

  const userOpHash = getUserOpHash(
    unsignedUserOperation,
    entryPointAddress,
    Number((await provider.getNetwork()).chainId),
  );

  const userOpSignature = await owner.signMessage(getBytes(userOpHash));

  const userOperation = {
    ...unsignedUserOperation,
    signature: userOpSignature,
  };

  return await sendUserOpAndWait(
    userOperation,
    entryPointAddress,
    bundlerProvider,
  );
};

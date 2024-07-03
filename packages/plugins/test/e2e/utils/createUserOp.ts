/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/comma-dangle */
import { ethers, getBytes, NonceManager, Signer } from "ethers";
import { AddressZero } from "@ethersproject/constants";

import { SafeProxyFactory } from "../../../typechain-types/lib/safe-contracts/contracts/proxies/SafeProxyFactory";
import { Safe } from "../../../typechain-types/lib/safe-contracts/contracts/Safe";
import {
	EntryPoint__factory,
	SafeBlsPlugin,
	SafeWebAuthnPlugin,
} from "../../../typechain-types";
import receiptOf from "./receiptOf";
import { calculateProxyAddress } from "./calculateProxyAddress";
import { getFeeData, getGasEstimates } from "./getGasEstimates";
import sendUserOpAndWait from "./sendUserOpAndWait";
import {
	FactoryParams,
	getUserOpHash,
	PackedUserOperation,
	packUserOp,
	UserOperation,
} from "./userOpUtils";

type Plugin = SafeBlsPlugin | SafeWebAuthnPlugin;

export const generateFactoryParamsAndAddress = async (
	admin: NonceManager,
	owner: NonceManager,
	plugin: Plugin,
	safeSingleton: Safe,
	safeProxyFactory: SafeProxyFactory
) => {
	const pluginAddress = await plugin.getAddress();
	const singletonAddress = await safeSingleton.getAddress();
	const factoryAddress = await safeProxyFactory.getAddress();

	const moduleInitializer = plugin.interface.encodeFunctionData("enableMyself");
	const encodedInitializer = safeSingleton.interface.encodeFunctionData(
		"setup",
		[
			[await owner.getAddress()],
			1,
			pluginAddress,
			moduleInitializer,
			pluginAddress,
			AddressZero,
			0,
			AddressZero,
		]
	);

	const deployedAddress = await calculateProxyAddress(
		safeProxyFactory,
		await safeSingleton.getAddress(),
		encodedInitializer,
		73
	);

	// Native tokens for the pre-fund
	await receiptOf(
		admin.sendTransaction({
			to: deployedAddress,
			value: ethers.parseEther("10"),
		})
	);

	const factoryData = safeProxyFactory.interface.encodeFunctionData(
		"createProxyWithNonce",
		[singletonAddress, encodedInitializer, 73]
	);

	const factoryParams = {
		factory: factoryAddress,
		factoryData,
	};

	return { factoryParams, deployedAddress };
};

export const createUserOperation = async (
	provider: ethers.JsonRpcProvider,
	bundlerProvider: ethers.JsonRpcProvider,
	accountAddress: string,
	factoryParams: FactoryParams,
	userOpCallData: string,
	entryPointAddress: string,
	dummySignature: string
) => {
	const entryPoint = EntryPoint__factory.connect(
		entryPointAddress,
		await provider.getSigner()
	);
	const nonce = await entryPoint.getNonce(accountAddress, "0x00");
	const nonceHex = "0x0" + nonce.toString();

	let userOp: Partial<UserOperation> = {
		sender: accountAddress,
		nonce: nonceHex,
		callData: userOpCallData,
		callGasLimit: "0x00",
		signature: dummySignature,
	};

	if (factoryParams.factory !== "0x") {
		userOp.factory = factoryParams.factory;
		userOp.factoryData = factoryParams.factoryData;
	}

	const {
		callGasLimit,
		verificationGasLimit,
		preVerificationGas,
		maxFeePerGas,
		maxPriorityFeePerGas,
	} = await getGasEstimates(
		provider,
		bundlerProvider,
		userOp,
		entryPointAddress
	);

	const unsignedUserOperation = {
		sender: accountAddress,
		nonce: nonceHex,
		factory: userOp.factory,
		factoryData: userOp.factoryData,
		callData: userOpCallData,
		callGasLimit,
		verificationGasLimit,
		preVerificationGas,
		maxFeePerGas,
		maxPriorityFeePerGas,
		signature: dummySignature,
	} satisfies UserOperation;

	return await ethers.resolveProperties(unsignedUserOperation);
};

export const createAndSendUserOpWithEcdsaSig = async (
	provider: ethers.JsonRpcProvider,
	bundlerProvider: ethers.JsonRpcProvider,
	owner: Signer,
	accountAddress: string,
	factoryParams: FactoryParams,
	userOpCallData: string,
	entryPointAddress: string,
	dummySignature: string
) => {
	const unsignedUserOperation = await createUserOperation(
		provider,
		bundlerProvider,
		accountAddress,
		factoryParams,
		userOpCallData,
		entryPointAddress,
		dummySignature
	);

	const userOpHash = getUserOpHash(
		unsignedUserOperation,
		entryPointAddress,
		Number((await provider.getNetwork()).chainId)
	);

	const userOpSignature = await owner.signMessage(getBytes(userOpHash));

	const userOperation = {
		...unsignedUserOperation,
		signature: userOpSignature,
	};

	return await sendUserOpAndWait(
		userOperation,
		entryPointAddress,
		bundlerProvider
	);
};

export const createAnonAadhaarOperation = async (
	provider: ethers.JsonRpcProvider,
	accountAddress: string,
	userOpCallData: string,
	entryPointAddress: string
) => {
	const entryPoint = EntryPoint__factory.connect(
		entryPointAddress,
		await provider.getSigner()
	);
	const nonce = await entryPoint.getNonce(accountAddress, "0x00");
	const nonceHex = "0x0" + nonce.toString();

	const { maxFeePerGas, maxPriorityFeePerGas } = await getFeeData(provider);

	// Note that gas amount params, such as callGasLimit, verificationGasLimit, preVerificationGas, are constant.
	// This is because it's challenging to have dynamic gas values for userOp due to the following dependency loop issue.
	// Doing gas estimation requires a valid signature in the userOp. Otherwise, the estimation fails.
	// The signautre is an encoded value of zk-proof and signal (userOp Hash), which means signature needs a complete userOp including gas values.
	// If gas values are changed after creating signature, on-chain verification fails as the new userOp hash doesn't match the proof anymore.

	// solution 1: re-create proof but this takes too much time
	// solution 2: have fixed gas values
	// solution 3:
	// - gas estimation with dummy sig to get at least dynamic callGasLimit. ( pimlico offers such an API call )
	// - keep verificationGasLimit & preVerificationGas fixed as they are more or less constant

	// this issue is also problematic when simulation call with valid sig is necessary, e.g. userOp w/ paymaster.

	const unsignedUserOperation = {
		sender: accountAddress,
		nonce: nonceHex,
		factory: undefined,
		factoryData: undefined,
		callData: userOpCallData,
		callGasLimit: ethers.toBeHex(150000n),
		verificationGasLimit: ethers.toBeHex(1000000n),
		preVerificationGas: ethers.toBeHex(200000n),
		maxFeePerGas,
		maxPriorityFeePerGas,
		signature: "0x",
	} satisfies UserOperation;

	return await ethers.resolveProperties(unsignedUserOperation);
};

export const sendUserOpWithAnonAadhaarSig = async (
	bundlerProvider: ethers.JsonRpcProvider,
	entryPointAddress: string,
	unsignedUserOperation: UserOperation,
	userOpSignature: string
) => {
	const userOperation = {
		...unsignedUserOperation,
		signature: userOpSignature,
	};

	return await sendUserOpAndWait(
		userOperation,
		entryPointAddress,
		bundlerProvider
	);
};

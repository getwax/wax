import { BytesLike, ethers, getBytes, NonceManager, Signer } from "ethers";
import { AddressZero } from "@ethersproject/constants";
import { UserOperationStruct } from "@account-abstraction/contracts";
import { getUserOpHash } from "@account-abstraction/utils";

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

type Plugin = SafeBlsPlugin | SafeWebAuthnPlugin;

export const generateInitCodeAndAddress = async (
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

	return { initCode, deployedAddress };
};

export const createUserOperation = async (
	provider: ethers.JsonRpcProvider,
	bundlerProvider: ethers.JsonRpcProvider,
	accountAddress: string,
	initCode: string,
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
		entryPointAddress
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
	owner: Signer,
	accountAddress: string,
	initCode: string,
	userOpCallData: string,
	entryPointAddress: string,
	dummySignature: string
) => {
	const unsignedUserOperation = await createUserOperation(
		provider,
		bundlerProvider,
		accountAddress,
		initCode,
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

	const unsignedUserOperation = {
		sender: accountAddress,
		nonce: nonceHex,
		initCode: "0x",
		callData: userOpCallData,
		callGasLimit: ethers.toBeHex(150000n),
		verificationGasLimit: ethers.toBeHex(1000000n),
		preVerificationGas: ethers.toBeHex(200000n),
		maxFeePerGas,
		maxPriorityFeePerGas,
		paymasterAndData: "0x",
		signature: "0x",
	} satisfies UserOperationStruct;

	return await ethers.resolveProperties(unsignedUserOperation);
};

export const sendUserOpWithAnonAadhaarSig = async (
	bundlerProvider: ethers.JsonRpcProvider,
	entryPointAddress: string,
	unsignedUserOperation: UserOperationStruct,
	userOpSignature: BytesLike
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

/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable @typescript-eslint/comma-dangle */
/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { expect } from "chai";
import {
	BytesLike,
	JsonRpcProvider,
	NonceManager,
	Signer,
	ethers,
} from "ethers";
import DeterministicDeployer from "../../lib-ts/deterministic-deployer/DeterministicDeployer";
import {
	SafeAnonAadhaarFactory__factory,
	SafeAnonAadhaarPlugin__factory,
	Verifier__factory,
	AnonAadhaar__factory,
	Safe,
} from "../../typechain-types";
import receiptOf from "./utils/receiptOf";
import { setupTests } from "./utils/setupTests";
import {
	createAnonAadhaarOperation,
	sendUserOpWithAnonAadhaarSig,
} from "./utils/createUserOp";
import {
	InitArgs,
	init,
	generateArgs,
	prove,
	verify,
	artifactUrls,
	packGroth16Proof,
	ArtifactsOrigin,
} from "@anon-aadhaar/core";
import { testQRData } from "./utils/assets/dataInput.json";
import fs from "fs";
import { copmuteUserNullifier } from "./utils/computeNullifier";
import { getUserOpHash } from "@account-abstraction/utils";

export const testPublicKeyHash =
	"15134874015316324267425466444584014077184337590635665158241104437045239495873";
const oneEther = ethers.parseEther("1");
// what is nullifier seed: https://anon-aadhaar-documentation.vercel.app/docs/nullifiers
// using wallet address makes sense...?
const nullifierSeed = 1234;

describe("SafeAnonAadhaarPlugin", () => {
	let bundlerProvider: JsonRpcProvider;
	let provider: JsonRpcProvider;
	let admin: NonceManager;
	let owner: Signer;
	let entryPointAddress: string;
	let safeSingleton: Safe;
	let deployer: DeterministicDeployer;

	let certificate: string;
	let anonAadhaarAddress: string;

	before(async () => {
		const setup = await setupTests();
		({
			provider,
			bundlerProvider,
			admin,
			owner,
			entryPointAddress,
			deployer,
			safeSingleton,
		} = setup);

		console.log("admin: ", await admin.getAddress());
		console.log("owner: ", await owner.getAddress());
		console.log("entryPointAddress: ", entryPointAddress);
		console.log("safeSingleton: ", await safeSingleton.getAddress());

		const signer = await provider.getSigner();
		const anonAadhaarVerifier = await new Verifier__factory(signer).deploy();

		console.log(
			"anonAadhaarVerifier: ",
			await anonAadhaarVerifier.getAddress()
		);

		const anonAadhaar = await new AnonAadhaar__factory(signer).deploy(
			await anonAadhaarVerifier.getAddress(),
			BigInt(testPublicKeyHash).toString()
		);

		anonAadhaarAddress = await anonAadhaar.getAddress();
		console.log("anonAadhaarAddress: ", anonAadhaarAddress);

		// load test certificate
		const certificateDirName = __dirname + "/utils/assets";
		certificate = fs
			.readFileSync(certificateDirName + "/testCertificate.pem")
			.toString();

		const anonAadhaarInitArgs: InitArgs = {
			wasmURL: artifactUrls.v2.wasm,
			zkeyURL: artifactUrls.v2.zkey,
			vkeyURL: artifactUrls.v2.vk,
			artifactsOrigin: ArtifactsOrigin.server,
		};

		await init(anonAadhaarInitArgs);
	});

	it("should pass the ERC4337 validation", async () => {
		const safeAnonAadhaarFactory = await deployer.connectOrDeploy(
			SafeAnonAadhaarFactory__factory,
			[]
		);

		// get user_data_hash
		const userDataHash = await copmuteUserNullifier(nullifierSeed, testQRData);
		console.log("userDataHash: ", userDataHash);

		const createArgs = [
			safeSingleton,
			entryPointAddress,
			await owner.getAddress(),
			0,
			anonAadhaarAddress,
			userDataHash,
		] satisfies Parameters<typeof safeAnonAadhaarFactory.create.staticCall>;

		const accountAddress = await safeAnonAadhaarFactory.create.staticCall(
			...createArgs
		);

		console.log("accountAddress: ", accountAddress);

		await receiptOf(safeAnonAadhaarFactory.create(...createArgs));

		const safeAnonAadhaarPlugin = SafeAnonAadhaarPlugin__factory.connect(
			accountAddress,
			owner
		);

		// Native tokens for the pre-fund
		await receiptOf(
			admin.sendTransaction({
				to: accountAddress,
				value: ethers.parseEther("10"),
			})
		);

		const recipient = ethers.Wallet.createRandom();
		const transferAmount = ethers.parseEther("1");
		// Construct userOp
		const userOpCallData = safeAnonAadhaarPlugin.interface.encodeFunctionData(
			"execTransaction",
			[recipient.address, transferAmount, "0x00"]
		);

		console.log("userOpCallData: ", userOpCallData);

		// get userOp
		const unsignedUserOperation = await createAnonAadhaarOperation(
			provider,
			accountAddress,
			userOpCallData,
			entryPointAddress
		);

		// get userOpHash
		const userOpHash = getUserOpHash(
			unsignedUserOperation,
			entryPointAddress,
			Number((await provider.getNetwork()).chainId)
		);

		console.log("userOpHash: ", userOpHash);

		// prove
		const args = await generateArgs({
			qrData: testQRData,
			certificateFile: certificate,
			nullifierSeed: nullifierSeed,
			signal: userOpHash, // user op hash
		});

		console.log("args: ", args);

		const anonAadhaarCore = await prove(args);
		const ret = await verify(anonAadhaarCore);
		console.log("ret: ", ret);
		const anonAadhaarProof = anonAadhaarCore.proof;
		const packedGroth16Proof = packGroth16Proof(anonAadhaarProof.groth16Proof);

		console.log("anonAadhaarCore: ", anonAadhaarCore);

		console.log("nullifierSeed: ", anonAadhaarCore.proof.nullifierSeed);
		console.log("nullifier: ", anonAadhaarProof.nullifier);
		console.log("nullifier bg: ", BigInt(anonAadhaarProof.nullifier));
		console.log("timestamp: ", Number(anonAadhaarCore?.proof.timestamp));

		// encode signautre
		const encoder = ethers.AbiCoder.defaultAbiCoder();
		const userOpSignature = encoder.encode(
			["uint", "uint", "uint", "uint[4]", "uint[8]"],
			[
				BigInt(nullifierSeed),
				Number(anonAadhaarCore?.proof.timestamp),
				BigInt(userOpHash), // insert userOpHash into signature
				[
					anonAadhaarProof.ageAbove18,
					anonAadhaarProof.gender,
					anonAadhaarProof.pincode,
					anonAadhaarProof.state,
				],
				packedGroth16Proof,
			]
		);

		console.log("userOpSignature: ", userOpSignature);

		// send userOp
		await sendUserOpWithAnonAadhaarSig(
			bundlerProvider,
			entryPointAddress,
			unsignedUserOperation,
			userOpSignature
		);

		console.log("userOp sent");

		expect(await provider.getBalance(recipient.address)).to.equal(oneEther);
	}).timeout(0);

	// it("should not allow execTransaction from unrelated address", async () => {
	// 	const {
	// 		provider,
	// 		admin,
	// 		owner,
	// 		entryPointAddress,
	// 		deployer,
	// 		safeSingleton,
	// 	} = await setupTests();

	// 	const safeAnonAadhaarFactory = await deployer.connectOrDeploy(
	// 		SafeAnonAadhaarFactory__factory,
	// 		[]
	// 	);

	// 	const createArgs = [
	// 		safeSingleton,
	// 		entryPointAddress,
	// 		await owner.getAddress(),
	// 		0,
	// 		"0x", // _anonAadhaarAddr
	// 		"0x", // _userDataHash
	// 	] satisfies Parameters<typeof safeAnonAadhaarFactory.create.staticCall>;

	// 	const accountAddress = await safeAnonAadhaarFactory.create.staticCall(
	// 		...createArgs
	// 	);

	// 	await receiptOf(safeAnonAadhaarFactory.create(...createArgs));

	// 	const unrelatedWallet = ethers.Wallet.createRandom(provider);

	// 	await receiptOf(
	// 		admin.sendTransaction({
	// 			to: unrelatedWallet.address,
	// 			value: 100n * oneEther,
	// 		})
	// 	);

	// 	const account = SafeAnonAadhaarPlugin__factory.connect(
	// 		accountAddress,
	// 		unrelatedWallet
	// 	);

	// 	const recipient = ethers.Wallet.createRandom(provider);

	// 	await expect(
	// 		receiptOf(account.execTransaction(recipient.address, oneEther, "0x"))
	// 	).to.eventually.rejected;

	// 	await expect(provider.getBalance(recipient)).to.eventually.equal(0n);
	// });
});

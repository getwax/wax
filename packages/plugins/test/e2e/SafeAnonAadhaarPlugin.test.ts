/* eslint-disable @typescript-eslint/comma-dangle */
/* eslint-disable prettier/prettier */
import { expect } from "chai";
import { JsonRpcProvider, NonceManager, Signer, ethers } from "ethers";
import DeterministicDeployer from "../../lib-ts/deterministic-deployer/DeterministicDeployer";
import {
	SafeAnonAadhaarFactory__factory,
	SafeAnonAadhaarPlugin__factory,
	AnonAadhaarVerifier__factory,
	AnonAadhaar__factory,
	Safe,
	AnonAadhaar,
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
	artifactUrls,
	packGroth16Proof,
	ArtifactsOrigin,
} from "@anon-aadhaar/core";
import fs from "fs";
import { getUserOpHash } from "./utils/userOpUtils";
import { copmuteUserNullifier } from "./utils/computeNullifier";
import { testQRData } from "./utils/assets/dataInput.json";

/*

This uses test Aadhaar QR code along with test Indian government's public key and certificate.

*/

// Nullifier seed: https://anon-aadhaar-documentation.vercel.app/docs/nullifiers
// using wallet address makes sense...?
const nullifierSeed = 1234;

// test version of UIDAI public key
// more info: https://anon-aadhaar-documentation.vercel.app/docs/how-does-it-work#1-extract-and-process-the-data-from-the-qr-code
const testPublicKeyHash =
	"15134874015316324267425466444584014077184337590635665158241104437045239495873";

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
	let anonAadhaar: AnonAadhaar;

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

		const signer = await provider.getSigner();

		// Deploy AnonAadhaarGroth16Verifier contract
		const anonAadhaarVerifier = await new AnonAadhaarVerifier__factory(signer).deploy();
		await anonAadhaarVerifier.waitForDeployment();

		// Deploy AnonAadhaar contract
		anonAadhaar = await new AnonAadhaar__factory(signer).deploy(
			await anonAadhaarVerifier.getAddress(),
			BigInt(testPublicKeyHash).toString(),
		);
		await anonAadhaar.waitForDeployment();

		anonAadhaarAddress = await anonAadhaar.getAddress();

		// load test certificate
		const certificateDirName = __dirname + "/utils/assets";
		certificate = fs
			.readFileSync(certificateDirName + "/testCertificate.pem")
			.toString();

		// load files needed for proof generation and verification
		const anonAadhaarInitArgs: InitArgs = {
			wasmURL: artifactUrls.v2.wasm,
			zkeyURL: artifactUrls.v2.zkey,
			vkeyURL: artifactUrls.v2.vk,
			artifactsOrigin: ArtifactsOrigin.server,
		};

		// pass initArgs
		await init(anonAadhaarInitArgs);
	});

	it("should pass the ERC4337 validation", async () => {
		// Deploy SafeAnonAadhaarFactory contract
		const safeAnonAadhaarFactory = await deployer.connectOrDeploy(
			SafeAnonAadhaarFactory__factory,
			[]
		);

		// get userDataHash out of nullifier seed and test QR data
		// userDataHash is an unique identifier that is specific to each user and stored the plugin contract
		const userDataHash = await copmuteUserNullifier(nullifierSeed, testQRData);

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

		// create User Operation
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

		// prove with userOpHash as signal
		const args = await generateArgs({
			qrData: testQRData,
			certificateFile: certificate,
			nullifierSeed: nullifierSeed,
			signal: userOpHash, // user op hash
		});

		// proving
		console.debug("Generating Anon Aadhaar proof. This could take some time...");
		const proofTimingKey = "Anon Aadhaar proof generation time";
		console.time(proofTimingKey);
		const anonAadhaarCore = await prove(args);
		console.timeEnd(proofTimingKey);

		const anonAadhaarProof = anonAadhaarCore.proof;
		const packedGroth16Proof = packGroth16Proof(anonAadhaarProof.groth16Proof);

		// view call to AnonAadhaar contract to see if verification returns true
		expect(await anonAadhaar.verifyAnonAadhaarProof(
			nullifierSeed,
			anonAadhaarProof.nullifier,
			anonAadhaarProof.timestamp,
			userOpHash,
			[
				anonAadhaarProof.ageAbove18,
				anonAadhaarProof.gender,
				anonAadhaarProof.pincode,
				anonAadhaarProof.state,
			],
			packedGroth16Proof
		)).to.equal(true);

		// encode proof data into userOpSignature
		const encoder = ethers.AbiCoder.defaultAbiCoder();
		const userOpSignature = encoder.encode(
			["uint", "uint", "uint", "uint[4]", "uint[8]"],
			[
				BigInt(nullifierSeed),
				Number(anonAadhaarProof.timestamp),
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

		// send userOp
		await sendUserOpWithAnonAadhaarSig(
			bundlerProvider,
			entryPointAddress,
			unsignedUserOperation,
			userOpSignature
		);

		expect(await provider.getBalance(recipient.address)).to.equal(
			ethers.parseEther("1")
		);
	}).timeout(0);
});

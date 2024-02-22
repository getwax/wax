import { Interface, NonceManager, ethers, getBytes, keccak256 } from "ethers";
import { signer as hubbleBlsSigner } from "@thehubbleproject/bls";
import { EntryPoint__factory } from "../typechain-types";
import { getSigners } from "../test/e2e/utils/getSigners";
import makeDevFaster from "../test/e2e/utils/makeDevFaster";

/** Edit constants as needed */
const BLS_PRIVATE_KEY =
  "0xdbe3d601b1b25c42c50015a87855fdce00ea9b3a7e33c92d31c69aeb70708e08";
const ACCOUNT_ADDRESS = "0xBf1ca3AF628e173b067629F007c4860593779D79";
const FUNCTION_SIGNATURE = "function doNothing()";
const { BUNDLER_URL, NODE_URL } = process.env;

/**
 * Script for generating BLS signature for forge tests
 * A node and bundler should be running locally before running this script
 */
async function generateBlsSig() {
  const bundlerProvider = new ethers.JsonRpcProvider(BUNDLER_URL);
  const provider = new ethers.JsonRpcProvider(NODE_URL);
  await makeDevFaster(provider);

  const [, signer] = getSigners();
  const admin = new NonceManager(signer.connect(provider));

  const entryPointAddress = await getEntryPointAddress(bundlerProvider);
  const entryPoint = EntryPoint__factory.connect(entryPointAddress, admin);

  const abi = [FUNCTION_SIGNATURE];
  const contractInterface = new Interface(abi);

  const data = contractInterface.encodeFunctionData(
    contractInterface.getFunctionName(FUNCTION_SIGNATURE),
  );

  const blsUserOpHash = await entryPoint.getUserOpHash({
    sender: ACCOUNT_ADDRESS,
    nonce: 0n,
    initCode: "0x",
    callData: data,
    callGasLimit: 10000000n,
    verificationGasLimit: 10000000n,
    preVerificationGas: 50000n,
    maxFeePerGas: 50000n,
    maxPriorityFeePerGas: 1n,
    paymasterAndData: "0x",
    signature: "0x",
  });

  const domain = getBytes(keccak256(Buffer.from("eip4337.bls.domain")));
  const signerFactory = await hubbleBlsSigner.BlsSignerFactory.new();
  const blsSigner = signerFactory.getSigner(domain, BLS_PRIVATE_KEY);

  const blsPubKey = blsSigner.pubkey;
  const blsSignature = blsSigner.sign(blsUserOpHash);

  console.log("blsPubKey:     ", blsPubKey);
  console.log("blsUserOpHash: ", blsUserOpHash);
  console.log("blsSignature:  ", blsSignature);
}

async function getEntryPointAddress(bundlerProvider: ethers.JsonRpcProvider) {
  const entryPoints = (await bundlerProvider.send(
    "eth_supportedEntryPoints",
    [],
  )) as string[];

  if (entryPoints.length === 0) {
    throw new Error("No entry points found");
  }

  return entryPoints[0];
}

generateBlsSig().catch((error: Error) => {
  console.error(error);
  process.exitCode = 1;
});

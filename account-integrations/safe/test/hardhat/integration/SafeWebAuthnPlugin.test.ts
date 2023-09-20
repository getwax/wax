import hre from "hardhat";
import { expect } from "chai";
import { AddressZero } from "@ethersproject/constants";
import { concat, ethers, BigNumberish } from "ethers";
import { UserOperationStruct } from "@account-abstraction/contracts";
import { calculateProxyAddress } from "../utils/calculateProxyAddress";
import {
  SafeProxyFactory__factory,
  Safe__factory,
} from "../../../typechain-types";
import sendUserOpAndWait from "../utils/sendUserOpAndWait";
import receiptOf from "../utils/receiptOf";
import SafeSingletonFactory from "../utils/SafeSingletonFactory";

const ERC4337_TEST_ENV_VARIABLES_DEFINED =
  typeof process.env.ERC4337_TEST_BUNDLER_URL !== "undefined" &&
  typeof process.env.ERC4337_TEST_NODE_URL !== "undefined" &&
  typeof process.env.MNEMONIC !== "undefined";

const itif = ERC4337_TEST_ENV_VARIABLES_DEFINED ? it : it.skip;
const BUNDLER_URL = process.env.ERC4337_TEST_BUNDLER_URL;
const NODE_URL = process.env.ERC4337_TEST_NODE_URL;
const MNEMONIC = process.env.MNEMONIC;

describe("SafeWebAuthnPlugin", () => {
  const setupTests = async () => {
    const bundlerProvider = new ethers.JsonRpcProvider(BUNDLER_URL);
    const provider = new ethers.JsonRpcProvider(NODE_URL);
    const userWallet = ethers.Wallet.fromPhrase(MNEMONIC!).connect(provider);

    const entryPoints = (await bundlerProvider.send(
      "eth_supportedEntryPoints",
      [],
    )) as string[];

    if (entryPoints.length === 0) {
      throw new Error("No entry points found");
    }

    const ssf = await SafeSingletonFactory.init(userWallet);

    return {
      factory: await ssf.connectOrDeploy(SafeProxyFactory__factory, []),
      singleton: await ssf.connectOrDeploy(Safe__factory, []),
      bundlerProvider,
      provider,
      userWallet,
      entryPoints,
    };
  };

  const getPublicKeyAndSignature = () => {
    const publicKey: [BigNumberish, BigNumberish] = [
      BigInt(
        "114874632398302156264159990279427641021947882640101801130664833947273521181002",
      ),
      BigInt(
        "32136952818958550240756825111900051564117520891182470183735244184006536587423",
      ),
    ];

    const authenticatorData =
      "0xf8e4b678e1c62f7355266eaa4dc1148573440937063a46d848da1e25babbd20b010000004d";
    const authenticatorDataFlagMask = "0x01";
    const clientData =
      "0x7b2274797065223a22776562617574686e2e676574222c226368616c6c656e6765223a224e546f2d3161424547526e78786a6d6b61544865687972444e5833697a6c7169316f776d4f643955474a30222c226f726967696e223a2268747470733a2f2f66726573682e6c65646765722e636f6d222c2263726f73734f726967696e223a66616c73657d";
    const clientChallenge =
      "0x353a3ed5a0441919f1c639a46931de872ac3357de2ce5aa2d68c2639df54189d";
    const clientChallengeDataOffset = 36;
    const signature: [BigNumberish, BigNumberish] = [
      BigInt(
        "45847212378479006099766816358861726414873720355505495069909394794949093093607",
      ),
      BigInt(
        "55835259151215769394881684156457977412783812617123006733908193526332337539398",
      ),
    ];

    const encoder = new ethers.AbiCoder();
    const userOpSignature = encoder.encode(
      [
        "bytes",
        "bytes1",
        "bytes",
        "bytes32",
        "uint256",
        "uint256[2]",
        "uint256[2]",
      ],
      [
        authenticatorData,
        authenticatorDataFlagMask,
        clientData,
        clientChallenge,
        clientChallengeDataOffset,
        signature,
        publicKey,
      ],
    );

    return { publicKey, userOpSignature };
  };

  /**
   * This test verifies a ERC4337 transaction succeeds when sent via a plugin
   * The user operation deploys a Safe with the ERC4337 plugin and a handler
   * and executes a transaction, thus verifying two things:
   * 1. Deployment of the Safe with the ERC4337 plugin and handler is possible
   * 2. Executing a transaction is possible
   */
  itif("should pass the ERC4337 validation", async () => {
    const {
      singleton,
      factory,
      provider,
      bundlerProvider,
      userWallet,
      entryPoints,
    } = await setupTests();
    const { publicKey, userOpSignature } = getPublicKeyAndSignature();
    const ENTRYPOINT_ADDRESS = entryPoints[0];

    const safeWebAuthnPluginFactory = (
      await hre.ethers.getContractFactory("SafeWebAuthnPlugin")
    ).connect(userWallet);
    const safeWebAuthnPlugin = await safeWebAuthnPluginFactory.deploy(
      ENTRYPOINT_ADDRESS,
      publicKey,
      { gasLimit: 2_000_000 },
    );
    await safeWebAuthnPlugin.deploymentTransaction()?.wait();

    const feeData = await provider.getFeeData();
    if (!feeData.maxFeePerGas || !feeData.maxPriorityFeePerGas) {
      throw new Error(
        "maxFeePerGas or maxPriorityFeePerGas is null or undefined",
      );
    }

    const maxFeePerGas = `0x${feeData.maxFeePerGas.toString()}`;
    const maxPriorityFeePerGas = `0x${feeData.maxPriorityFeePerGas.toString()}`;

    const safeWebAuthnPluginAddress = await safeWebAuthnPlugin.getAddress();
    const singletonAddress = await singleton.getAddress();
    const factoryAddress = await factory.getAddress();

    const moduleInitializer =
      safeWebAuthnPlugin.interface.encodeFunctionData("enableMyself");
    const encodedInitializer = singleton.interface.encodeFunctionData("setup", [
      [userWallet.address],
      1,
      safeWebAuthnPluginAddress,
      moduleInitializer,
      safeWebAuthnPluginAddress,
      AddressZero,
      0,
      AddressZero,
    ]);

    const deployedAddress = await calculateProxyAddress(
      factory,
      singletonAddress,
      encodedInitializer,
      73,
    );

    // The initCode contains 20 bytes of the factory address and the rest is the
    // calldata to be forwarded
    const initCode = concat([
      factoryAddress,
      factory.interface.encodeFunctionData("createProxyWithNonce", [
        singletonAddress,
        encodedInitializer,
        73,
      ]),
    ]);

    const signer = new ethers.Wallet(
      "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
    );
    const recipientAddress = signer.address;
    const transferAmount = ethers.parseEther("1");

    const userOpCallData = safeWebAuthnPlugin.interface.encodeFunctionData(
      "execTransaction",
      [recipientAddress, transferAmount, "0x00"],
    );

    // Native tokens for the pre-fund 💸
    await receiptOf(
      userWallet.sendTransaction({
        to: deployedAddress,
        value: ethers.parseEther("100"),
      }),
    );

    const userOperationWithoutGasFields = {
      sender: deployedAddress,
      nonce: "0x0",
      initCode,
      callData: userOpCallData,
      callGasLimit: "0x00",
      paymasterAndData: "0x",
      signature: userOpSignature,
    };

    const gasEstimate = (await bundlerProvider.send(
      "eth_estimateUserOperationGas",
      [userOperationWithoutGasFields, ENTRYPOINT_ADDRESS],
    )) as {
      verificationGasLimit: string;
      preVerificationGas: string;
      callGasLimit: string;
    };

    const safeVerificationGasLimit =
      BigInt(gasEstimate.verificationGasLimit) +
      BigInt(gasEstimate.verificationGasLimit) / 10n; // + 10%

    const safePreVerificationGas =
      BigInt(gasEstimate.preVerificationGas) +
      BigInt(gasEstimate.preVerificationGas) / 50n; // + 2%

    const userOperation: UserOperationStruct = {
      sender: deployedAddress,
      nonce: "0x0",
      initCode,
      callData: userOpCallData,
      callGasLimit: gasEstimate.callGasLimit,
      verificationGasLimit: ethers.toBeHex(safeVerificationGasLimit),
      preVerificationGas: ethers.toBeHex(safePreVerificationGas),
      maxFeePerGas,
      maxPriorityFeePerGas,
      paymasterAndData: "0x",
      signature: userOpSignature,
    };

    // Uncomment to get a detailed debug message
    // const DEBUG_MESSAGE = `
    //         Using entry point: ${ENTRYPOINT_ADDRESS}
    //         Deployed Safe address: ${deployedAddress}
    //         Module/Handler address: ${safeWebAuthnPluginAddress}
    //         User operation:
    //         ${JSON.stringify(userOperation, null, 2)}
    //     `;
    // console.log(DEBUG_MESSAGE);

    const recipientBalanceBefore = await provider.getBalance(recipientAddress);

    await sendUserOpAndWait(userOperation, ENTRYPOINT_ADDRESS, bundlerProvider);

    const recipientBalanceAfter = await provider.getBalance(recipientAddress);

    const expectedRecipientBalance = recipientBalanceBefore + transferAmount;
    expect(recipientBalanceAfter).to.equal(expectedRecipientBalance);
  });
});

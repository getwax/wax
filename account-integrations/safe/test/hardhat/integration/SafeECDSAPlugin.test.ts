import hre from "hardhat";
import { expect } from "chai";
import { AddressZero } from "@ethersproject/constants";
import { getBytes, concat, resolveProperties, ethers } from "ethers";
import { UserOperationStruct } from "@account-abstraction/contracts";
import { getUserOpHash } from "@account-abstraction/utils";
import { calculateProxyAddress } from "../utils/calculateProxyAddress";
import {
  SafeProxyFactory__factory,
  Safe__factory,
} from "../../../typechain-types";
import sendUserOpAndWait from "../utils/sendUserOpAndWait";
import receiptOf from "../utils/receiptOf";

const ERC4337_TEST_ENV_VARIABLES_DEFINED =
  typeof process.env.ERC4337_TEST_BUNDLER_URL !== "undefined" &&
  typeof process.env.ERC4337_TEST_NODE_URL !== "undefined" &&
  typeof process.env.ERC4337_TEST_SAFE_FACTORY_ADDRESS !== "undefined" &&
  typeof process.env.ERC4337_TEST_SINGLETON_ADDRESS !== "undefined" &&
  typeof process.env.MNEMONIC !== "undefined";

const itif = ERC4337_TEST_ENV_VARIABLES_DEFINED ? it : it.skip;
const SAFE_FACTORY_ADDRESS = process.env.ERC4337_TEST_SAFE_FACTORY_ADDRESS;
const SINGLETON_ADDRESS = process.env.ERC4337_TEST_SINGLETON_ADDRESS;
const BUNDLER_URL = process.env.ERC4337_TEST_BUNDLER_URL;
const NODE_URL = process.env.ERC4337_TEST_NODE_URL;
const MNEMONIC = process.env.MNEMONIC;

describe("SafeECDSAPlugin", () => {
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

    if (!SAFE_FACTORY_ADDRESS) {
      throw new Error("No Safe factory address found");
    }

    if (!SINGLETON_ADDRESS) {
      throw new Error("No Safe singleton address found");
    }

    return {
      factory: SafeProxyFactory__factory.connect(
        SAFE_FACTORY_ADDRESS,
        userWallet,
      ),
      singleton: Safe__factory.connect(SINGLETON_ADDRESS, provider),
      bundlerProvider,
      provider,
      userWallet,
      entryPoints,
    };
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
    const ENTRYPOINT_ADDRESS = entryPoints[0];

    const safeECDSAPluginFactory = (
      await hre.ethers.getContractFactory("SafeECDSAPlugin")
    ).connect(userWallet);
    const safeECDSAPlugin = await safeECDSAPluginFactory.deploy(
      ENTRYPOINT_ADDRESS,
      userWallet.address,
      { gasLimit: 1_000_000 },
    );
    await safeECDSAPlugin.deploymentTransaction()?.wait();

    const feeData = await provider.getFeeData();
    if (!feeData.maxFeePerGas || !feeData.maxPriorityFeePerGas) {
      throw new Error(
        "maxFeePerGas or maxPriorityFeePerGas is null or undefined",
      );
    }

    const maxFeePerGas = `0x${feeData.maxFeePerGas.toString()}`;
    const maxPriorityFeePerGas = `0x${feeData.maxPriorityFeePerGas.toString()}`;

    const safeECDSAPluginAddress = await safeECDSAPlugin.getAddress();
    const singletonAddress = await singleton.getAddress();
    const factoryAddress = await factory.getAddress();

    const moduleInitializer =
      safeECDSAPlugin.interface.encodeFunctionData("enableMyself");
    const encodedInitializer = singleton.interface.encodeFunctionData("setup", [
      [userWallet.address],
      1,
      safeECDSAPluginAddress,
      moduleInitializer,
      safeECDSAPluginAddress,
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

    const userOpCallData = safeECDSAPlugin.interface.encodeFunctionData(
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

    const unsignedUserOperation: UserOperationStruct = {
      sender: deployedAddress,
      nonce: "0x0",
      initCode,
      callData: userOpCallData,
      callGasLimit: "0x7A120",
      verificationGasLimit: "0x7A120",
      preVerificationGas: "0x186A0",
      maxFeePerGas,
      maxPriorityFeePerGas,
      paymasterAndData: "0x",
      signature: "",
    };

    const resolvedUserOp = await resolveProperties(unsignedUserOperation);
    const userOpHash = getUserOpHash(
      resolvedUserOp,
      ENTRYPOINT_ADDRESS,
      Number(provider._network.chainId),
    );
    const userOpSignature = await userWallet.signMessage(getBytes(userOpHash));

    const userOperation = {
      ...unsignedUserOperation,
      signature: userOpSignature,
    };

    // Uncomment to get a detailed debug message
    // const DEBUG_MESSAGE = `
    //         Using entry point: ${ENTRYPOINT_ADDRESS}
    //         Deployed Safe address: ${deployedAddress}
    //         Module/Handler address: ${safeECDSAPluginAddress}
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

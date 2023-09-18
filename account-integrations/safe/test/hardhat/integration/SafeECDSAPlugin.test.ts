import hre from "hardhat";
import { expect } from "chai";
import { AddressZero } from "@ethersproject/constants";
import { getBytes, concat, resolveProperties, ethers } from "ethers";
import { UserOperationStruct } from "@account-abstraction/contracts";
import { getUserOpHash } from "@account-abstraction/utils";
import { calculateProxyAddress } from "../utils/calculateProxyAddress";
import {
  SafeECDSAPlugin__factory,
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

const oneEther = ethers.parseEther("1");

describe("SafeECDSAPlugin", () => {
  async function setupTests() {
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
  }

  async function setupDeployedAccount(
    to: ethers.AddressLike,
    value: ethers.BigNumberish,
    data: ethers.BytesLike,
  ) {
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

    const accountAddress = await calculateProxyAddress(
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

    const userOpCallData = safeECDSAPlugin.interface.encodeFunctionData(
      "execTransaction",
      [to, value, data],
    );

    // Native tokens for the pre-fund 💸
    await receiptOf(
      userWallet.sendTransaction({
        to: accountAddress,
        value: ethers.parseEther("100"),
      }),
    );

    const unsignedUserOperation: UserOperationStruct = {
      sender: accountAddress,
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

    expect(await provider.getCode(accountAddress)).to.equal("0x");

    await sendUserOpAndWait(userOperation, ENTRYPOINT_ADDRESS, bundlerProvider);

    expect(await provider.getCode(accountAddress)).not.to.equal("0x");

    return {
      provider,
      bundlerProvider,
      entryPoint: ENTRYPOINT_ADDRESS,
      userWallet,
      accountAddress,
    };
  }

  /**
   * This test verifies a ERC4337 transaction succeeds when sent via a plugin
   * The user operation deploys a Safe with the ERC4337 plugin and a handler
   * and executes a transaction, thus verifying two things:
   * 1. Deployment of the Safe with the ERC4337 plugin and handler is possible
   * 2. Executing a transaction is possible
   */
  itif("should pass the ERC4337 validation", async () => {
    const recipient = ethers.Wallet.createRandom();

    const { provider } = await setupDeployedAccount(
      recipient.address,
      oneEther,
      "0x",
    );

    expect(await provider.getBalance(recipient.address)).to.equal(oneEther);
  });

  itif("should not allow execTransaction from unrelated address", async () => {
    const { accountAddress, userWallet, provider } = await setupDeployedAccount(
      ethers.ZeroAddress,
      0,
      "0x",
    );

    const unrelatedWallet = ethers.Wallet.createRandom(provider);

    await receiptOf(
      userWallet.sendTransaction({
        to: unrelatedWallet.address,
        value: 100n * oneEther,
      }),
    );

    const account = SafeECDSAPlugin__factory.connect(
      accountAddress,
      unrelatedWallet,
    );

    const recipient = ethers.Wallet.createRandom(provider);

    await expect(
      receiptOf(account.execTransaction(recipient.address, oneEther, "0x")),
    ).to.eventually.rejected;

    await expect(provider.getBalance(recipient)).to.eventually.equal(0n);
  });
});

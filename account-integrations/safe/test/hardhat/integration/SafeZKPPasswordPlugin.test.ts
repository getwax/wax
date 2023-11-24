import { UserOperationStruct } from "@account-abstraction/contracts";
import { getUserOpHash } from "@account-abstraction/utils";
import { ERC4337ZKPPasswordClient } from "@getwax/circuits";
import { expect } from "chai";
import { resolveProperties, ethers, NonceManager } from "ethers";
import makeDevFaster from "../utils/makeDevFaster";
import SafeSingletonFactory from "../utils/SafeSingletonFactory";
import sendUserOpAndWait from "../utils/sendUserOpAndWait";
import receiptOf from "../utils/receiptOf";
import {
  MockPasswordVerifier__factory,
  SafeZKPPasswordFactory__factory,
  SafeZKPPasswordPlugin__factory,
  SafeProxyFactory__factory,
  Safe__factory,
} from "../../../typechain-types";

const ERC4337_TEST_ENV_VARIABLES_DEFINED =
  typeof process.env.ERC4337_TEST_BUNDLER_URL !== "undefined" &&
  typeof process.env.ERC4337_TEST_NODE_URL !== "undefined" &&
  typeof process.env.ERC4337_TEST_SAFE_FACTORY_ADDRESS !== "undefined" &&
  typeof process.env.ERC4337_TEST_SINGLETON_ADDRESS !== "undefined" &&
  typeof process.env.MNEMONIC !== "undefined";

const itif = ERC4337_TEST_ENV_VARIABLES_DEFINED ? it : it.skip;
const BUNDLER_URL = process.env.ERC4337_TEST_BUNDLER_URL;
const NODE_URL = process.env.ERC4337_TEST_NODE_URL;
const MNEMONIC = process.env.MNEMONIC;

describe("SafeZKPPasswordPlugin", () => {
  const setupTests = async () => {
    const bundlerProvider = new ethers.JsonRpcProvider(BUNDLER_URL);
    const provider = new ethers.JsonRpcProvider(NODE_URL);
    await makeDevFaster(provider);
    const wallet = ethers.Wallet.fromPhrase(MNEMONIC!).connect(provider);
    // Allows us to use same account as bundler
    const userWallet = new NonceManager(wallet);

    const entryPoints = (await bundlerProvider.send(
      "eth_supportedEntryPoints",
      [],
    )) as string[];
    if (entryPoints.length === 0) {
      throw new Error("No entry points found");
    }

    const ssf = await SafeSingletonFactory.init(userWallet);
    const zkpClient = await ERC4337ZKPPasswordClient.create();

    return {
      factory: await ssf.connectOrDeploy(SafeProxyFactory__factory, []),
      singleton: await ssf.connectOrDeploy(Safe__factory, []),
      bundlerProvider,
      provider,
      userWallet,
      entryPoints,
      zkpClient,
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
      provider,
      bundlerProvider,
      userWallet,
      entryPoints,
      zkpClient,
    } = await setupTests();
    const ENTRYPOINT_ADDRESS = entryPoints[0];

    const ssf = await SafeSingletonFactory.init(userWallet);

    const safeZKPPasswordFactory = await ssf.connectOrDeploy(
      SafeZKPPasswordFactory__factory,
      [],
    );

    const signer = await provider.getSigner();
    // TODO (merge-ok) Use real verifier from zkp dir
    // https://github.com/getwax/wax/issues/143
    const passwordVerifier = await new MockPasswordVerifier__factory(
      signer,
    ).deploy();

    const feeData = await provider.getFeeData();
    if (!feeData.maxFeePerGas || !feeData.maxPriorityFeePerGas) {
      throw new Error(
        "maxFeePerGas or maxPriorityFeePerGas is null or undefined",
      );
    }

    const maxFeePerGas = `0x${feeData.maxFeePerGas.toString()}`;
    const maxPriorityFeePerGas = `0x${feeData.maxPriorityFeePerGas.toString()}`;

    const owner = ethers.Wallet.createRandom();

    const createArgs = [
      singleton,
      ENTRYPOINT_ADDRESS,
      owner.address,
      0,
      passwordVerifier,
    ] satisfies Parameters<typeof safeZKPPasswordFactory.create.staticCall>;

    const accountAddress = await safeZKPPasswordFactory.create.staticCall(
      ...createArgs,
    );

    await receiptOf(safeZKPPasswordFactory.create(...createArgs));

    const to = "0x42ef9B061d2B8416387FaA738Af7251668b0b142"; // Random address
    const value = ethers.parseEther("1");
    const data = "0x"; // ETH transfer

    const userOpCallData =
      SafeZKPPasswordPlugin__factory.createInterface().encodeFunctionData(
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

    const unsignedUserOp: UserOperationStruct = {
      sender: accountAddress,
      nonce: "0x0",

      // Note: initCode is not used because we need to create both the safe
      // proxy and the plugin, and 4337 currently only allows one contract
      // creation in this step. Since we need an extra step anyway, it's simpler
      // to do the whole create outside of 4337.
      initCode: "0x",

      callData: userOpCallData,
      callGasLimit: "0x7A120",
      verificationGasLimit: "0x7A120",
      preVerificationGas: "0x186A0",
      maxFeePerGas,
      maxPriorityFeePerGas,
      paymasterAndData: "0x",
      signature: "",
    };

    const resolvedUserOp = await resolveProperties(unsignedUserOp);
    const userOpHash = getUserOpHash(
      resolvedUserOp,
      ENTRYPOINT_ADDRESS,
      Number((await provider.getNetwork()).chainId),
    );

    const emojiPassword = "👻🎃🕸🦇🕷🪦";
    const { signature } = await zkpClient.proveUserOp(
      emojiPassword,
      userOpHash,
    );

    const userOp = {
      ...unsignedUserOp,
      signature,
    };

    // Uncomment to get a detailed debug message
    // const DEBUG_MESSAGE = `
    //         Using entry point: ${ENTRYPOINT_ADDRESS}
    //         Deployed Safe address: ${accountAddress}
    //         User operation:
    //         ${JSON.stringify(userOp, null, 2)}
    //     `;
    // console.log(DEBUG_MESSAGE);

    const recipientBalanceBefore = await provider.getBalance(to);

    await sendUserOpAndWait(userOp, ENTRYPOINT_ADDRESS, bundlerProvider);

    const recipientBalanceAfter = await provider.getBalance(to);

    const expectedRecipientBalance = recipientBalanceBefore + value;
    expect(recipientBalanceAfter).to.equal(expectedRecipientBalance);
  });
});

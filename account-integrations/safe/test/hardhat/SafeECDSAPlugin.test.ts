import { expect } from "chai";
import { getBytes, resolveProperties, ethers } from "ethers";
import { UserOperationStruct } from "@account-abstraction/contracts";
import { getUserOpHash } from "@account-abstraction/utils";
import {
  SafeECDSAFactory__factory,
  SafeECDSAPlugin__factory,
} from "../../typechain-types";
import sendUserOpAndWait from "./utils/sendUserOpAndWait";
import receiptOf from "./utils/receiptOf";
import SafeSingletonFactory from "./utils/SafeSingletonFactory";
import { setupTests } from "./utils/setupTests";

const ERC4337_TEST_ENV_VARIABLES_DEFINED =
  typeof process.env.ERC4337_TEST_BUNDLER_URL !== "undefined" &&
  typeof process.env.ERC4337_TEST_NODE_URL !== "undefined" &&
  typeof process.env.MNEMONIC !== "undefined";

const itif = ERC4337_TEST_ENV_VARIABLES_DEFINED ? it : it.skip;

const oneEther = ethers.parseEther("1");

describe("SafeECDSAPlugin", () => {
  async function setupDeployedAccount(
    to: ethers.AddressLike,
    value: ethers.BigNumberish,
    data: ethers.BytesLike,
  ) {
    const {
      bundlerProvider,
      provider,
      admin,
      owner,
      entryPoints,
      safeSingleton,
    } = await setupTests();
    const ENTRYPOINT_ADDRESS = entryPoints[0];

    const ssf = await SafeSingletonFactory.init(admin);

    const safeECDSAFactory = await ssf.connectOrDeploy(
      SafeECDSAFactory__factory,
      [],
    );

    const feeData = await provider.getFeeData();
    if (!feeData.maxFeePerGas || !feeData.maxPriorityFeePerGas) {
      throw new Error(
        "maxFeePerGas or maxPriorityFeePerGas is null or undefined",
      );
    }

    const maxFeePerGas = `0x${feeData.maxFeePerGas.toString()}`;
    const maxPriorityFeePerGas = `0x${feeData.maxPriorityFeePerGas.toString()}`;

    const createArgs = [
      safeSingleton,
      ENTRYPOINT_ADDRESS,
      owner.address,
      0,
    ] satisfies Parameters<typeof safeECDSAFactory.create.staticCall>;

    const accountAddress = await safeECDSAFactory.create.staticCall(
      ...createArgs,
    );

    await receiptOf(safeECDSAFactory.create(...createArgs));

    const recipient = new ethers.Wallet(
      "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
    );
    const transferAmount = ethers.parseEther("1");

    const userOpCallData =
      SafeECDSAPlugin__factory.createInterface().encodeFunctionData(
        "execTransaction",
        [to, value, data],
      );

    // Native tokens for the pre-fund 💸
    await receiptOf(
      admin.sendTransaction({
        to: accountAddress,
        value: ethers.parseEther("10"),
      }),
    );

    const unsignedUserOperation: UserOperationStruct = {
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

    const resolvedUserOp = await resolveProperties(unsignedUserOperation);
    const userOpHash = getUserOpHash(
      resolvedUserOp,
      ENTRYPOINT_ADDRESS,
      Number((await provider.getNetwork()).chainId),
    );
    const userOpSignature = await owner.signMessage(getBytes(userOpHash));

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

    await sendUserOpAndWait(userOperation, ENTRYPOINT_ADDRESS, bundlerProvider);

    return {
      provider,
      bundlerProvider,
      entryPoint: ENTRYPOINT_ADDRESS,
      admin,
      owner,
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
    const { accountAddress, admin, provider } = await setupDeployedAccount(
      ethers.ZeroAddress,
      0,
      "0x",
    );

    const unrelatedWallet = ethers.Wallet.createRandom(provider);

    await receiptOf(
      admin.sendTransaction({
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

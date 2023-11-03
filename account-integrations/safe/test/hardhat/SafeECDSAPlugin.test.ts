import { expect } from "chai";
import { getBytes, ethers } from "ethers";
import { getUserOpHash } from "@account-abstraction/utils";
import {
  SafeECDSAFactory__factory,
  SafeECDSAPlugin__factory,
} from "../../typechain-types";
import sendUserOpAndWait from "./utils/sendUserOpAndWait";
import receiptOf from "./utils/receiptOf";
import SafeSingletonFactory from "./utils/SafeSingletonFactory";
import { createUnsignedUserOperation, setupTests } from "./utils/setupTests";

const oneEther = ethers.parseEther("1");

describe("SafeECDSAPlugin", () => {
  it("should pass the ERC4337 validation", async () => {
    const {
      bundlerProvider,
      provider,
      admin,
      owner,
      entryPointAddress,
      safeSingleton,
    } = await setupTests();

    const recipient = ethers.Wallet.createRandom();
    const transferAmount = ethers.parseEther("1");
    const dummySignature = await owner.signMessage("dummy sig");

    const ssf = await SafeSingletonFactory.init(admin);

    const safeECDSAFactory = await ssf.connectOrDeploy(
      SafeECDSAFactory__factory,
      [],
    );

    const createArgs = [
      safeSingleton,
      entryPointAddress,
      owner.address,
      0,
    ] satisfies Parameters<typeof safeECDSAFactory.create.staticCall>;

    const accountAddress = await safeECDSAFactory.create.staticCall(
      ...createArgs,
    );

    await receiptOf(safeECDSAFactory.create(...createArgs));

    const safeEcdsaPlugin = SafeECDSAPlugin__factory.connect(
      accountAddress,
      owner,
    );

    // Native tokens for the pre-fund 💸
    await receiptOf(
      admin.sendTransaction({
        to: accountAddress,
        value: ethers.parseEther("10"),
      }),
    );

    const userOpCallData = safeEcdsaPlugin.interface.encodeFunctionData(
      "execTransaction",
      [recipient.address, transferAmount, "0x00"],
    );

    const unsignedUserOperation = await createUnsignedUserOperation(
      provider,
      bundlerProvider,
      accountAddress,
      userOpCallData,
      entryPointAddress,
      dummySignature,
    );

    const userOpHash = getUserOpHash(
      unsignedUserOperation,
      entryPointAddress,
      Number((await provider.getNetwork()).chainId),
    );
    const userOpSignature = await owner.signMessage(getBytes(userOpHash));

    const userOperation = {
      ...unsignedUserOperation,
      signature: userOpSignature,
    };

    await sendUserOpAndWait(userOperation, entryPointAddress, bundlerProvider);

    expect(await provider.getBalance(recipient.address)).to.equal(oneEther);
  });

  it("should not allow execTransaction from unrelated address", async () => {
    const { provider, admin, owner, entryPointAddress, safeSingleton } =
      await setupTests();

    const ssf = await SafeSingletonFactory.init(admin);

    const safeECDSAFactory = await ssf.connectOrDeploy(
      SafeECDSAFactory__factory,
      [],
    );

    const createArgs = [
      safeSingleton,
      entryPointAddress,
      owner.address,
      0,
    ] satisfies Parameters<typeof safeECDSAFactory.create.staticCall>;

    const accountAddress = await safeECDSAFactory.create.staticCall(
      ...createArgs,
    );

    await receiptOf(safeECDSAFactory.create(...createArgs));

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

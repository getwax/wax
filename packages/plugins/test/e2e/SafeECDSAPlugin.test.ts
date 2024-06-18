import { expect } from "chai";
import { ethers } from "ethers";
import {
  SafeECDSAFactory__factory,
  SafeECDSAPlugin__factory,
} from "../../typechain-types";
import receiptOf from "./utils/receiptOf";
import { setupTests } from "./utils/setupTests";
import { createAndSendUserOpWithEcdsaSig } from "./utils/createUserOp";

const oneEther = ethers.parseEther("1");

describe("SafeECDSAPlugin", () => {
  it("should pass the ERC4337 validation", async () => {
    const {
      bundlerProvider,
      provider,
      admin,
      owner,
      entryPointAddress,
      deployer,
      safeSingleton,
    } = await setupTests();

    const recipient = ethers.Wallet.createRandom();
    const transferAmount = ethers.parseEther("1");
    const dummySignature = await owner.signMessage("dummy sig");

    // Deploy ecdsa plugin
    const safeECDSAFactory = await deployer.connectOrDeploy(
      SafeECDSAFactory__factory,
      [],
    );

    const createArgs = [
      safeSingleton,
      entryPointAddress,
      await owner.getAddress(),
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

    // Native tokens for the pre-fund
    await receiptOf(
      admin.sendTransaction({
        to: accountAddress,
        value: ethers.parseEther("10"),
      }),
    );

    // Construct userOp
    const userOpCallData = safeEcdsaPlugin.interface.encodeFunctionData(
      "execTransaction",
      [recipient.address, transferAmount, "0x00"],
    );

    // Note: factoryParams is not used because we need to create both the safe
    // proxy and the plugin, and 4337 currently only allows one contract
    // creation in this step. Since we need an extra step anyway, it's simpler
    // to do the whole create outside of 4337.
    const factoryParams = {
      factory: "0x",
      factoryData: "0x",
    };

    // Send userOp
    await createAndSendUserOpWithEcdsaSig(
      provider,
      bundlerProvider,
      owner,
      accountAddress,
      factoryParams,
      userOpCallData,
      entryPointAddress,
      dummySignature,
    );

    expect(await provider.getBalance(recipient.address)).to.equal(oneEther);
  });

  it("should not allow execTransaction from unrelated address", async () => {
    const {
      provider,
      admin,
      owner,
      entryPointAddress,
      deployer,
      safeSingleton,
    } = await setupTests();

    const safeECDSAFactory = await deployer.connectOrDeploy(
      SafeECDSAFactory__factory,
      [],
    );

    const createArgs = [
      safeSingleton,
      entryPointAddress,
      await owner.getAddress(),
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

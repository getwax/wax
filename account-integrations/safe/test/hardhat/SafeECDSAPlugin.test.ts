import { expect } from "chai";
import { ethers } from "ethers";
import {
  SafeECDSAFactory__factory,
  SafeECDSAPlugin__factory,
} from "../../typechain-types";
import receiptOf from "./utils/receiptOf";
import { setupTests } from "./utils/setupTests";
import {
  createAndSendUserOpWithEcdsaSig,
  generateInitCodeAndAddress,
} from "./utils/createUserOp";
import { calculateProxyAddress } from "./utils/calculateProxyAddress";
import { AddressZero } from "@account-abstraction/utils";

const oneEther = ethers.parseEther("1");

describe("SafeECDSAPlugin", () => {
  // Ideal flow //
  // 1. define initcode and initial user operation that can perform some action e.g. send eth
  // 2. generate account address
  // 3. construct userOp that deploys account and performs desired action
  // 4. factory deploys account and then userOp is executed

  it("should pass the ERC4337 validation", async () => {
    const {
      bundlerProvider,
      provider,
      admin,
      owner,
      entryPointAddress,
      ssf,
      safeSingleton,
      safeProxyFactory,
    } = await setupTests();

    const recipient = ethers.Wallet.createRandom();
    const transferAmount = ethers.parseEther("1");
    const dummySignature = await owner.signMessage("dummy sig");

    // Deploy ecdsa plugin
    const safeEcdsaPlugin = await ssf.connectOrDeploy(
      SafeECDSAPlugin__factory,
      [entryPointAddress],
    );

    const safeEcdsaPluginAddress = await safeEcdsaPlugin.getAddress();
    const safeSingletonAddress = await safeSingleton.getAddress();

    const moduleInitializer = safeEcdsaPlugin.interface.encodeFunctionData(
      "enableMyself",
      [owner.address],
    );
    const encodedInitializer = safeSingleton.interface.encodeFunctionData(
      "setup",
      [
        [owner.address],
        1,
        safeEcdsaPluginAddress,
        moduleInitializer,
        safeEcdsaPluginAddress,
        AddressZero,
        0,
        AddressZero,
      ],
    );

    const deployedAddress = await calculateProxyAddress(
      safeProxyFactory,
      safeSingletonAddress,
      encodedInitializer,
      73,
    );

    // deploy safe
    await safeProxyFactory
      .connect(owner)
      .createProxyWithNonce(safeSingletonAddress, encodedInitializer, 73);

    // Construct userOp
    const userOpCallData = safeEcdsaPlugin.interface.encodeFunctionData(
      "execTransaction",
      [recipient.address, transferAmount, "0x00"],
    );

    // Native tokens for the pre-fund
    await receiptOf(
      admin.sendTransaction({
        to: deployedAddress,
        value: ethers.parseEther("10"),
      }),
    );

    // Note: initCode is not used because we need to create both the safe
    // proxy and the plugin, and 4337 currently only allows one contract
    // creation in this step. Since we need an extra step anyway, it's simpler
    // to do the whole create outside of 4337.
    //
    // Note: even if we could deploy the proxy and plugin in the same transaction,
    // it would break the 4337 storage rules as the plugin is stateful. Even if we
    // use a mapping accociated with the sender. See following rule:
    //
    // (unstaked entities can be used) If the UserOp doesn’t create a new account
    // (that is initCode is empty), or the UserOp
    // creates a new account using a staked factory
    // contract, then the entity may also use storage
    // associated with the sender)
    const initCode = "0x";

    const balanceBefore = await provider.getBalance(recipient.address);

    // create & send userOp
    await createAndSendUserOpWithEcdsaSig(
      provider,
      bundlerProvider,
      owner,
      deployedAddress,
      initCode,
      userOpCallData,
      entryPointAddress,
      dummySignature,
    );

    expect(await provider.getBalance(recipient.address)).to.equal(
      balanceBefore + oneEther,
    );
  });

  // Actually fails on initializer call AND would fail validateSignature call because both functions access state
  it("should fail to deploy account via initcode & send a user operation at the same time.", async () => {
    const {
      bundlerProvider,
      provider,
      admin,
      owner,
      entryPointAddress,
      ssf,
      safeSingleton,
      safeProxyFactory,
    } = await setupTests();

    const recipient = ethers.Wallet.createRandom();
    const transferAmount = ethers.parseEther("1");
    const dummySignature = await owner.signMessage("dummy sig");

    // Deploy ecdsa plugin
    const safeEcdsaPlugin = await ssf.connectOrDeploy(
      SafeECDSAPlugin__factory,
      [entryPointAddress],
    );

    // Construct userOp
    const userOpCallData = safeEcdsaPlugin.interface.encodeFunctionData(
      "execTransaction",
      [recipient.address, transferAmount, "0x00"],
    );

    const { initCode, deployedAddress } = await generateInitCodeAndAddress(
      admin,
      owner,
      safeEcdsaPlugin,
      safeSingleton,
      safeProxyFactory,
    );

    // Native tokens for the pre-fund
    await receiptOf(
      admin.sendTransaction({
        to: deployedAddress,
        value: ethers.parseEther("10"),
      }),
    );

    // FIXME: Why do you have to send this transaction to the recipient in order for
    // the recipient balance to update when the actual userOp is sent??
    await receiptOf(
      admin.sendTransaction({
        to: recipient.address,
        value: ethers.parseEther("1"),
      }),
    );

    const createAndSendUserOp = createAndSendUserOpWithEcdsaSig(
      provider,
      bundlerProvider,
      owner,
      deployedAddress,
      initCode,
      userOpCallData,
      entryPointAddress,
      dummySignature,
    );

    await expect(createAndSendUserOp).to.eventually.be.rejectedWith(
      "unstaked factory accessed",
    );
  });

  it("should not allow execTransaction from unrelated address", async () => {
    const { provider, admin, owner, entryPointAddress, ssf, safeSingleton } =
      await setupTests();

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

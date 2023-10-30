import { expect } from "chai";
import { ethers } from "ethers";

import { executeContractCallWithSigners } from "./utils/execution";

import SafeSingletonFactory from "./utils/SafeSingletonFactory";
import makeDevFaster from "./utils/makeDevFaster";
import {
  SafeECDSAFactory__factory,
  SafeECDSAPlugin__factory,
  SafeECDSARecoveryPlugin,
  SafeECDSARecoveryPlugin__factory,
  SafeProxyFactory__factory,
  Safe__factory,
} from "../../typechain-types";
import receiptOf from "./utils/receiptOf";
import sleep from "./utils/sleep";

const BUNDLER_URL = process.env.ERC4337_TEST_BUNDLER_URL;
const NODE_URL = process.env.ERC4337_TEST_NODE_URL;
const MNEMONIC = process.env.MNEMONIC;

describe("SafeECDSARecoveryPlugin", () => {
  async function setupTests() {
    const bundlerProvider = new ethers.JsonRpcProvider(BUNDLER_URL);
    const provider = new ethers.JsonRpcProvider(NODE_URL);
    await makeDevFaster(provider);

    const admin = ethers.Wallet.fromPhrase(MNEMONIC!).connect(provider);
    const owner = ethers.Wallet.createRandom(provider);

    await receiptOf(
      admin.sendTransaction({
        to: owner.address,
        value: ethers.parseEther("1"),
      }),
    );

    const entryPoints = (await bundlerProvider.send(
      "eth_supportedEntryPoints",
      [],
    )) as string[];

    if (entryPoints.length === 0) {
      throw new Error("No entry points found");
    }

    const ssf = await SafeSingletonFactory.init(admin);

    const safeProxyFactory = await ssf.connectOrDeploy(
      SafeProxyFactory__factory,
      [],
    );
    await safeProxyFactory.waitForDeployment();
    const safeSingleton = await ssf.connectOrDeploy(Safe__factory, []);

    const safeECDSAFactory = await ssf.connectOrDeploy(
      SafeECDSAFactory__factory,
      [],
    );
    await safeECDSAFactory.waitForDeployment();

    const createArgs = [
      safeSingleton,
      entryPoints[0],
      owner.address,
      0,
    ] satisfies Parameters<typeof safeECDSAFactory.create.staticCall>;

    const safeProxyAddress = await safeECDSAFactory.create.staticCall(
      ...createArgs,
    );

    await receiptOf(safeECDSAFactory.create(...createArgs));
    const safeProxyWithEcdsaPluginInterface = SafeECDSAPlugin__factory.connect(
      safeProxyAddress,
      provider,
    );

    const safeECDSAPluginAddress =
      await safeProxyWithEcdsaPluginInterface.myAddress();

    return {
      provider,
      admin,
      owner,
      safeProxyFactory,
      safeSingleton,
      entryPoints,
      safeProxyAddress,
      safeECDSAPluginAddress,
    };
  }

  it("Should enable a recovery plugin on a safe.", async () => {
    const { provider, owner, admin, safeProxyAddress } = await setupTests();

    // Setup recovery plugin
    const recoverySigner = ethers.Wallet.createRandom(provider);

    await receiptOf(
      admin.sendTransaction({
        to: recoverySigner.address,
        value: ethers.parseEther("1"),
      }),
    );
    const ssf = await SafeSingletonFactory.init(admin);

    const recoveryPlugin = await ssf.connectOrDeploy(
      SafeECDSARecoveryPlugin__factory,
      [],
    );
    await recoveryPlugin.waitForDeployment();

    const recoveryPluginAddress = await recoveryPlugin.getAddress();

    // Enable recovery plugin

    const safe = Safe__factory.connect(safeProxyAddress, owner);

    const isModuleEnabledBefore = await safe.isModuleEnabled(
      recoveryPluginAddress,
    );

    await receiptOf(
      executeContractCallWithSigners(
        safe,
        safe,
        "enableModule",
        [recoveryPluginAddress],
        // @ts-expect-error owner doesn't have all properties for some reason
        [owner],
      ),
    );

    const isModuleEnabledAfter = await safe.isModuleEnabled(
      recoveryPluginAddress,
    );

    expect(isModuleEnabledBefore).to.equal(false);
    expect(isModuleEnabledAfter).to.equal(true);
  });

  it("Should use recovery plugin to reset signing key and then send tx with new key.", async () => {
    const { provider, owner, admin, safeProxyAddress, safeECDSAPluginAddress } =
      await setupTests();

    // Setup recovery plugin
    const recoverySigner = ethers.Wallet.createRandom(provider);
    await receiptOf(
      admin.sendTransaction({
        to: recoverySigner.address,
        value: ethers.parseEther("1"),
      }),
    );
    const ssf = await SafeSingletonFactory.init(admin);

    const recoveryPlugin = await ssf.connectOrDeploy(
      SafeECDSARecoveryPlugin__factory,
      [],
    );
    await recoveryPlugin.waitForDeployment();

    const recoveryPluginAddress = await recoveryPlugin.getAddress();

    // Enable recovery plugin

    const safe = Safe__factory.connect(safeProxyAddress, owner);

    await receiptOf(
      executeContractCallWithSigners(
        safe,
        safe,
        "enableModule",
        [recoveryPluginAddress],
        // @ts-expect-error owner doesn't have all properties for some reason
        [owner],
      ),
    );
    // TODO: why is this needed to prevent "nonce too low" error
    await sleep(5000);

    // Add recovery account

    const chainId = (await provider.getNetwork()).chainId;
    const salt = "test salt";

    const recoveryhashDomain = ethers.solidityPackedKeccak256(
      ["string", "uint256", "uint256", "address"],
      ["RECOVERY_PLUGIN", 1, chainId, recoveryPluginAddress],
    );

    const recoveryHash = ethers.solidityPackedKeccak256(
      ["bytes32", "address", "address", "string"],
      [recoveryhashDomain, recoverySigner.address, owner.address, salt],
    );

    await receiptOf(
      recoveryPlugin
        .connect(owner)
        .addRecoveryAccount(
          recoveryHash,
          safeProxyAddress,
          safeECDSAPluginAddress,
        ),
    );

    // Reset ecdsa address
    const newEcdsaPluginSigner = ethers.Wallet.createRandom().connect(provider);
    const currentOwnerHash = ethers.solidityPackedKeccak256(
      ["address"],
      [owner.address],
    );
    const addressSignature = await newEcdsaPluginSigner.signMessage(
      ethers.getBytes(currentOwnerHash),
    );

    // TODO: why is this needed to prevent "nonce too low" error
    await sleep(5000);

    const resetEcdsaAddressArgs = [
      addressSignature,
      salt,
      safeProxyAddress,
      safeECDSAPluginAddress,
      owner.address,
      newEcdsaPluginSigner.address,
    ] satisfies Parameters<SafeECDSARecoveryPlugin["resetEcdsaAddress"]>;

    await recoveryPlugin
      .connect(recoverySigner)
      .resetEcdsaAddress.staticCall(...resetEcdsaAddressArgs);

    await receiptOf(
      recoveryPlugin
        .connect(recoverySigner)
        .resetEcdsaAddress(...resetEcdsaAddressArgs),
    );

    const safeEcdsaPlugin = SafeECDSAPlugin__factory.connect(
      safeECDSAPluginAddress,
      newEcdsaPluginSigner,
    );
    const newOwner = await safeEcdsaPlugin.ecdsaOwnerStorage(safeProxyAddress);
    expect(newOwner).to.equal(newEcdsaPluginSigner.address);

    // TODO: uncomment & update below
    // Send tx with new key
    // const entryPoint = ssf.viewer.connectAssume(EntryPoint__factory, []);

    // const recipientAddress = ethers.Wallet.createRandom().address;
    // const transferAmount = ethers.parseEther("1");
    // const userOpCallData = safe?.interface.encodeFunctionData(
    //   "execTransaction",
    //   [recipientAddress, transferAmount, "0x00"],
    // );
    // const recipientBalanceBefore =
    //   await provider.getBalance(recipientAddress);
    // await sendTx(
    //   newEcdsaPluginSigner,
    //   entryPoint,
    //   safeProxyAddress,
    //   "0x1",
    //   "0x",
    //   userOpCallData,
    // );

    // const recipientBalanceAfter = await provider.getBalance(recipientAddress);
    // const expectedRecipientBalance = recipientBalanceBefore + transferAmount;
    // expect(recipientBalanceAfter).to.equal(expectedRecipientBalance);
  });
});

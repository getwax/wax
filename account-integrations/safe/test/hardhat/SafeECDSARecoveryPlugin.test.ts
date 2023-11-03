import { expect } from "chai";
import { ethers, getBytes } from "ethers";

import { executeContractCallWithSigners } from "./utils/execution";

import SafeSingletonFactory from "./utils/SafeSingletonFactory";
import {
  SafeECDSAFactory__factory,
  SafeECDSAPlugin__factory,
  SafeECDSARecoveryPlugin__factory,
  Safe__factory,
} from "../../typechain-types";
import receiptOf from "./utils/receiptOf";
import { createUnsignedUserOperation, setupTests } from "./utils/setupTests";
import { getUserOpHash } from "@account-abstraction/utils";
import sendUserOpAndWait from "./utils/sendUserOpAndWait";

describe("SafeECDSARecoveryPlugin", () => {
  it("Should enable a recovery plugin on a safe.", async () => {
    const { provider, admin, owner, entryPointAddress, safeSingleton } =
      await setupTests();

    const ssf = await SafeSingletonFactory.init(admin);

    const safeECDSAFactory = await ssf.connectOrDeploy(
      SafeECDSAFactory__factory,
      [],
    );
    await safeECDSAFactory.waitForDeployment();

    const createArgs = [
      safeSingleton,
      entryPointAddress,
      owner.address,
      0,
    ] satisfies Parameters<typeof safeECDSAFactory.create.staticCall>;

    const safeProxyAddress = await safeECDSAFactory.create.staticCall(
      ...createArgs,
    );

    await receiptOf(safeECDSAFactory.create(...createArgs));

    // Setup recovery plugin
    const recoverySigner = ethers.Wallet.createRandom(provider);

    await receiptOf(
      admin.sendTransaction({
        to: recoverySigner.address,
        value: ethers.parseEther("1"),
      }),
    );

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
    const {
      bundlerProvider,
      provider,
      admin,
      owner,
      entryPointAddress,
      safeSingleton,
    } = await setupTests();

    const ssf = await SafeSingletonFactory.init(admin);

    const safeECDSAFactory = await ssf.connectOrDeploy(
      SafeECDSAFactory__factory,
      [],
    );
    await safeECDSAFactory.waitForDeployment();

    const createArgs = [
      safeSingleton,
      entryPointAddress,
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

    // Setup recovery plugin
    const guardianSigner = ethers.Wallet.createRandom(provider);
    const guardianAddress = guardianSigner.address;
    await receiptOf(
      admin.sendTransaction({
        to: guardianAddress,
        value: ethers.parseEther("1"),
      }),
    );

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

    // Add recovery account

    const chainId = (await provider.getNetwork()).chainId;
    const salt = "test salt";

    const recoveryhashDomain = ethers.solidityPackedKeccak256(
      ["string", "uint256", "uint256", "address"],
      ["RECOVERY_PLUGIN", 1, chainId, recoveryPluginAddress],
    );

    const recoveryHash = ethers.solidityPackedKeccak256(
      ["bytes32", "address", "address", "string"],
      [recoveryhashDomain, guardianAddress, owner.address, salt],
    );

    const addRecoveryAccountCalldata =
      recoveryPlugin.interface.encodeFunctionData("addRecoveryAccount", [
        recoveryHash,
        owner.address,
        safeECDSAPluginAddress,
      ]);

    let safeEcdsaPlugin = SafeECDSAPlugin__factory.connect(
      safeProxyAddress,
      owner,
    );

    let userOpCallData = safeEcdsaPlugin.interface.encodeFunctionData(
      "execTransaction",
      [await recoveryPlugin.getAddress(), "0x00", addRecoveryAccountCalldata],
    );

    const dummySignature = await owner.signMessage("dummy sig");

    // Native tokens for the pre-fund 💸
    await receiptOf(
      admin.sendTransaction({
        to: safeProxyAddress,
        value: ethers.parseEther("10"),
      }),
    );

    const addRecoveryAccountUnsignedUserOp = await createUnsignedUserOperation(
      provider,
      bundlerProvider,
      safeProxyAddress,
      userOpCallData,
      entryPointAddress,
      dummySignature,
    );

    const addRecoveryAccountUserOpHash = getUserOpHash(
      addRecoveryAccountUnsignedUserOp,
      entryPointAddress,
      Number((await provider.getNetwork()).chainId),
    );
    const addRecoveryAccountUserOpSignature = await owner.signMessage(
      getBytes(addRecoveryAccountUserOpHash),
    );

    const addRecoveryAccountUserOp = {
      ...addRecoveryAccountUnsignedUserOp,
      signature: addRecoveryAccountUserOpSignature,
    };

    await sendUserOpAndWait(
      addRecoveryAccountUserOp,
      entryPointAddress,
      bundlerProvider,
    );

    const storedRecoveryHash =
      await recoveryPlugin.ecdsaRecoveryStorage(safeProxyAddress);
    expect(recoveryHash).to.equal(storedRecoveryHash);

    // Reset ecdsa address
    const newEcdsaPluginSigner = ethers.Wallet.createRandom().connect(provider);
    const currentOwnerHash = ethers.solidityPackedKeccak256(
      ["address"],
      [owner.address],
    );
    const addressSignature = await newEcdsaPluginSigner.signMessage(
      getBytes(currentOwnerHash),
    );

    const guardianSignature = await guardianSigner.signMessage(
      getBytes(recoveryHash),
    );

    const resetEcdsaAddressCalldata =
      recoveryPlugin.interface.encodeFunctionData("resetEcdsaAddress", [
        addressSignature,
        guardianSignature,
        guardianAddress,
        salt,
        safeECDSAPluginAddress,
        owner.address,
        newEcdsaPluginSigner.address,
      ]);

    userOpCallData = safeEcdsaPlugin.interface.encodeFunctionData(
      "execTransaction",
      [await recoveryPlugin.getAddress(), "0x00", resetEcdsaAddressCalldata],
    );

    const resetEcdsaAddressUnsignedUserOp = await createUnsignedUserOperation(
      provider,
      bundlerProvider,
      safeProxyAddress,
      userOpCallData,
      entryPointAddress,
      dummySignature,
    );

    const resetEcdsaAddressUserOpHash = getUserOpHash(
      resetEcdsaAddressUnsignedUserOp,
      entryPointAddress,
      Number((await provider.getNetwork()).chainId),
    );
    const resetEcdsaAddressUserOpSignature = await owner.signMessage(
      getBytes(resetEcdsaAddressUserOpHash),
    );

    const resetEcdsaAddressUserOp = {
      ...resetEcdsaAddressUnsignedUserOp,
      signature: resetEcdsaAddressUserOpSignature,
    };

    await sendUserOpAndWait(
      resetEcdsaAddressUserOp,
      entryPointAddress,
      bundlerProvider,
    );

    safeEcdsaPlugin = SafeECDSAPlugin__factory.connect(
      safeECDSAPluginAddress,
      newEcdsaPluginSigner,
    );
    const newOwner = await safeEcdsaPlugin.ecdsaOwnerStorage(safeProxyAddress);
    expect(newOwner).to.equal(newEcdsaPluginSigner.address);

    // Send tx with new key
    const recipientAddress = ethers.Wallet.createRandom().address;
    const transferAmount = ethers.parseEther("1");
    const calldata = safeEcdsaPlugin.interface.encodeFunctionData(
      "execTransaction",
      [recipientAddress, transferAmount, "0x00"],
    );

    const unsignedUserOperation = await createUnsignedUserOperation(
      provider,
      bundlerProvider,
      safeProxyAddress,
      calldata,
      entryPointAddress,
      dummySignature,
    );

    const userOpHash = getUserOpHash(
      unsignedUserOperation,
      entryPointAddress,
      Number((await provider.getNetwork()).chainId),
    );
    const userOpSignature = await newEcdsaPluginSigner.signMessage(
      getBytes(userOpHash),
    );

    const userOperation = {
      ...unsignedUserOperation,
      signature: userOpSignature,
    };

    const recipientBalanceBefore = await provider.getBalance(recipientAddress);
    await sendUserOpAndWait(userOperation, entryPointAddress, bundlerProvider);

    const recipientBalanceAfter = await provider.getBalance(recipientAddress);
    const expectedRecipientBalance = recipientBalanceBefore + transferAmount;
    expect(recipientBalanceAfter).to.equal(expectedRecipientBalance);
  });
});

import { expect } from "chai";
import {
  HDNodeWallet,
  JsonRpcProvider,
  NonceManager,
  ethers,
  getBytes,
} from "ethers";

import { executeContractCallWithSigners } from "./utils/execution";
import SafeSingletonFactory from "./utils/SafeSingletonFactory";
import {
  Safe,
  SafeECDSAFactory__factory,
  SafeECDSAPlugin__factory,
  SafeECDSARecoveryPlugin,
  SafeECDSARecoveryPlugin__factory,
  Safe__factory,
  SimpleAccountFactory__factory,
  SimpleAccount__factory,
} from "../../typechain-types";
import receiptOf from "./utils/receiptOf";
import { setupTests } from "./utils/setupTests";
import { createAndSendUserOpWithEcdsaSig } from "./utils/createUserOp";

describe("SafeECDSARecoveryPlugin", () => {
  let bundlerProvider: JsonRpcProvider;
  let provider: JsonRpcProvider;
  let admin: NonceManager;
  let owner: HDNodeWallet;
  let entryPointAddress: string;
  let safeSingleton: Safe;

  let safeProxyAddress: string;
  let recoveryPlugin: SafeECDSARecoveryPlugin;
  let guardianSigner: HDNodeWallet;

  beforeEach(async () => {
    const setup = await setupTests();
    ({
      provider,
      bundlerProvider,
      admin,
      owner,
      entryPointAddress,
      safeSingleton,
    } = setup);

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

    safeProxyAddress = await safeECDSAFactory.create.staticCall(...createArgs);

    await receiptOf(safeECDSAFactory.create(...createArgs));

    // Native tokens for the pre-fund 💸
    await receiptOf(
      admin.sendTransaction({
        to: safeProxyAddress,
        value: ethers.parseEther("10"),
      }),
    );

    recoveryPlugin = await ssf.connectOrDeploy(
      SafeECDSARecoveryPlugin__factory,
      [],
    );
    await recoveryPlugin.waitForDeployment();

    guardianSigner = ethers.Wallet.createRandom(provider);
    await receiptOf(
      admin.sendTransaction({
        to: guardianSigner.address,
        value: ethers.parseEther("1"),
      }),
    );
  });

  it("Should enable a recovery plugin on a safe.", async () => {
    const recoveryPluginAddress = await recoveryPlugin.getAddress();
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

  it("Should use recovery plugin via EOA and then send tx with new key.", async () => {
    const recoveryPluginAddress = await recoveryPlugin.getAddress();
    const guardianAddress = guardianSigner.address;
    const safe = Safe__factory.connect(safeProxyAddress, owner);

    // Enable recovery plugin
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

    const safeProxyWithEcdsaPluginInterface = SafeECDSAPlugin__factory.connect(
      safeProxyAddress,
      provider,
    );
    const safeECDSAPluginAddress =
      await safeProxyWithEcdsaPluginInterface.myAddress();

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

    const initCode = "0x";
    const dummySignature = await owner.signMessage("dummy sig");

    await createAndSendUserOpWithEcdsaSig(
      provider,
      bundlerProvider,
      owner,
      safeProxyAddress,
      initCode,
      userOpCallData,
      entryPointAddress,
      dummySignature,
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

    const resetEcdsaAddressArgs = [
      addressSignature,
      safeProxyAddress,
      salt,
      safeECDSAPluginAddress,
      owner.address,
      newEcdsaPluginSigner.address,
    ] satisfies Parameters<typeof recoveryPlugin.resetEcdsaAddress.staticCall>;

    await recoveryPlugin
      .connect(guardianSigner)
      .resetEcdsaAddress.staticCall(...resetEcdsaAddressArgs);

    await receiptOf(
      recoveryPlugin
        .connect(guardianSigner)
        .resetEcdsaAddress(...resetEcdsaAddressArgs),
    );

    const newOwner = await safeEcdsaPlugin.ecdsaOwnerStorage(safeProxyAddress);
    expect(newOwner).to.equal(newEcdsaPluginSigner.address);

    // Send tx with new key
    const recipientAddress = ethers.Wallet.createRandom().address;
    const transferAmount = ethers.parseEther("1");
    userOpCallData = safeEcdsaPlugin.interface.encodeFunctionData(
      "execTransaction",
      [recipientAddress, transferAmount, "0x00"],
    );

    const recipientBalanceBefore = await provider.getBalance(recipientAddress);
    await createAndSendUserOpWithEcdsaSig(
      provider,
      bundlerProvider,
      newEcdsaPluginSigner,
      safeProxyAddress,
      initCode,
      userOpCallData,
      entryPointAddress,
      dummySignature,
    );

    const recipientBalanceAfter = await provider.getBalance(recipientAddress);
    const expectedRecipientBalance = recipientBalanceBefore + transferAmount;
    expect(recipientBalanceAfter).to.equal(expectedRecipientBalance);
  });

  it("Should use recovery plugin via smart account and then send tx with new key.", async () => {
    const recoveryPluginAddress = await recoveryPlugin.getAddress();
    const guardianAddress = guardianSigner.address;
    const safe = Safe__factory.connect(safeProxyAddress, owner);

    // Enable recovery plugin
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

    const ssf = await SafeSingletonFactory.init(admin);

    // deploy guardian smart account
    const simpleAccountFactory = await ssf.connectOrDeploy(
      SimpleAccountFactory__factory,
      [entryPointAddress],
    );
    const guardianSimpleAccountAddress =
      await simpleAccountFactory.createAccount.staticCall(guardianAddress, 0);

    await receiptOf(simpleAccountFactory.createAccount(guardianAddress, 0));

    // Add recovery account
    const chainId = (await provider.getNetwork()).chainId;
    const salt = "test salt";

    const recoveryhashDomain = ethers.solidityPackedKeccak256(
      ["string", "uint256", "uint256", "address"],
      ["RECOVERY_PLUGIN", 1, chainId, recoveryPluginAddress],
    );

    const recoveryHash = ethers.solidityPackedKeccak256(
      ["bytes32", "address", "address", "string"],
      [recoveryhashDomain, guardianSimpleAccountAddress, owner.address, salt],
    );

    const safeProxyWithEcdsaPluginInterface = SafeECDSAPlugin__factory.connect(
      safeProxyAddress,
      provider,
    );
    const safeECDSAPluginAddress =
      await safeProxyWithEcdsaPluginInterface.myAddress();

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

    const initCode = "0x";
    const dummySignature = await owner.signMessage("dummy sig");

    await createAndSendUserOpWithEcdsaSig(
      provider,
      bundlerProvider,
      owner,
      safeProxyAddress,
      initCode,
      userOpCallData,
      entryPointAddress,
      dummySignature,
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

    const resetEcdsaAddressCalldata =
      recoveryPlugin.interface.encodeFunctionData("resetEcdsaAddress", [
        addressSignature,
        safeProxyAddress,
        salt,
        safeECDSAPluginAddress,
        owner.address,
        newEcdsaPluginSigner.address,
      ]);

    const simpleAccount = SimpleAccount__factory.createInterface();
    userOpCallData = simpleAccount.encodeFunctionData("execute", [
      await recoveryPlugin.getAddress(),
      "0x00",
      resetEcdsaAddressCalldata,
    ]);

    // Native tokens for the pre-fund 💸
    await receiptOf(
      admin.sendTransaction({
        to: guardianSimpleAccountAddress,
        value: ethers.parseEther("10"),
      }),
    );

    await createAndSendUserOpWithEcdsaSig(
      provider,
      bundlerProvider,
      guardianSigner,
      guardianSimpleAccountAddress,
      initCode, // Failing with an unrecognised custom error when attempting to first construct the init code and pass it into the recovery user op
      userOpCallData,
      entryPointAddress,
      dummySignature,
    );

    const newOwner = await safeEcdsaPlugin.ecdsaOwnerStorage(safeProxyAddress);
    expect(newOwner).to.equal(newEcdsaPluginSigner.address);

    // Send tx with new key
    const recipientAddress = ethers.Wallet.createRandom().address;
    const transferAmount = ethers.parseEther("1");
    userOpCallData = safeEcdsaPlugin.interface.encodeFunctionData(
      "execTransaction",
      [recipientAddress, transferAmount, "0x00"],
    );

    const recipientBalanceBefore = await provider.getBalance(recipientAddress);
    await createAndSendUserOpWithEcdsaSig(
      provider,
      bundlerProvider,
      newEcdsaPluginSigner,
      safeProxyAddress,
      initCode,
      userOpCallData,
      entryPointAddress,
      dummySignature,
    );

    const recipientBalanceAfter = await provider.getBalance(recipientAddress);
    const expectedRecipientBalance = recipientBalanceBefore + transferAmount;
    expect(recipientBalanceAfter).to.equal(expectedRecipientBalance);
  });
});

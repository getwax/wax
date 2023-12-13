import { expect } from "chai";
import { JsonRpcProvider, NonceManager, Signer, ethers } from "ethers";

import { executeContractCallWithSigners } from "./utils/execution";
import SafeSingletonFactory from "./utils/SafeSingletonFactory";
import {
  MockGroth16Verifier__factory,
  Safe,
  SafeECDSAFactory__factory,
  SafeECDSAPlugin__factory,
  SafeZkEmailRecoveryPlugin,
  SafeZkEmailRecoveryPlugin__factory,
  Safe__factory,
  SimpleAccountFactory__factory,
  SimpleAccount__factory,
} from "../../typechain-types";
import receiptOf from "./utils/receiptOf";
import { setupTests } from "./utils/setupTests";
import { createAndSendUserOpWithEcdsaSig } from "./utils/createUserOp";

describe("SafeZkEmailRecoveryPlugin", () => {
  let bundlerProvider: JsonRpcProvider;
  let provider: JsonRpcProvider;
  let admin: NonceManager;
  let owner: Signer;
  let otherAccount: Signer;
  let entryPointAddress: string;
  let safeSingleton: Safe;
  let ssf: SafeSingletonFactory;

  let safeProxyAddress: string;
  let recoveryPlugin: SafeZkEmailRecoveryPlugin;

  beforeEach(async () => {
    const setup = await setupTests();
    ({
      provider,
      bundlerProvider,
      admin,
      owner,
      otherAccount,
      entryPointAddress,
      ssf,
      safeSingleton,
    } = setup);

    const safeECDSAFactory = await ssf.connectOrDeploy(
      SafeECDSAFactory__factory,
      [],
    );
    await safeECDSAFactory.waitForDeployment();

    const createArgs = [
      safeSingleton,
      entryPointAddress,
      await owner.getAddress(),
      0,
    ] satisfies Parameters<typeof safeECDSAFactory.create.staticCall>;

    safeProxyAddress = await safeECDSAFactory.create.staticCall(...createArgs);

    await receiptOf(safeECDSAFactory.create(...createArgs));

    // Native tokens for the pre-fund
    await receiptOf(
      admin.sendTransaction({
        to: safeProxyAddress,
        value: ethers.parseEther("10"),
      }),
    );

    const mockGroth16Verifier = await ssf.connectOrDeploy(
      MockGroth16Verifier__factory,
      [],
    );

    recoveryPlugin = await ssf.connectOrDeploy(
      SafeZkEmailRecoveryPlugin__factory,
      [await mockGroth16Verifier.getAddress()],
    );
    await recoveryPlugin.waitForDeployment();
  });

  it("Should use recovery plugin via EOA and then send tx with new key.", async () => {
    const recoveryPluginAddress = await recoveryPlugin.getAddress();
    const ownerAddress = await owner.getAddress();
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

    // Construct userOp to add recovery account
    const chainId = (await provider.getNetwork()).chainId;

    const email = ethers.keccak256(ethers.toUtf8Bytes("test2@mail.com"));
    const salt = "test salt";

    const recoveryhashDomain = ethers.solidityPackedKeccak256(
      ["string", "uint256", "uint256", "address"],
      ["RECOVERY_PLUGIN", 1, chainId, recoveryPluginAddress],
    );

    const recoveryHash = ethers.solidityPackedKeccak256(
      ["bytes32", "bytes32", "string"],
      [recoveryhashDomain, email, salt],
    );

    const safeProxyWithEcdsaPluginInterface = SafeECDSAPlugin__factory.connect(
      safeProxyAddress,
      provider,
    );
    const safeECDSAPluginAddress =
      await safeProxyWithEcdsaPluginInterface.myAddress();

    const addRecoveryHashCalldata = recoveryPlugin.interface.encodeFunctionData(
      "addRecoveryHash",
      [recoveryHash, ownerAddress, safeECDSAPluginAddress],
    );

    let safeEcdsaPlugin = SafeECDSAPlugin__factory.connect(
      safeProxyAddress,
      owner,
    );

    let userOpCallData = safeEcdsaPlugin.interface.encodeFunctionData(
      "execTransaction",
      [await recoveryPlugin.getAddress(), "0x00", addRecoveryHashCalldata],
    );

    const initCode = "0x";
    const dummySignature = await owner.signMessage("dummy sig");

    // Send userOp to add recovery account
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
      await recoveryPlugin.zkEmailRecoveryStorage(safeProxyAddress);
    expect(recoveryHash).to.equal(storedRecoveryHash);

    // Construct tx to reset ecdsa address
    const newEcdsaPluginSigner = ethers.Wallet.createRandom().connect(provider);
    await receiptOf(
      await admin.sendTransaction({
        to: await newEcdsaPluginSigner.getAddress(),
        value: ethers.parseEther("1"),
      }),
    );

    const a: [bigint, bigint] = [BigInt(0), BigInt(0)];
    const b: [[bigint, bigint], [bigint, bigint]] = [
      [BigInt(0), BigInt(0)],
      [BigInt(0), BigInt(0)],
    ];
    const c: [bigint, bigint] = [BigInt(0), BigInt(0)];
    const publicSignals: [bigint] = [BigInt(0)];

    const recoverAccountArgs = [
      safeProxyAddress,
      safeECDSAPluginAddress,
      newEcdsaPluginSigner.address,
      salt,
      email,
      a,
      b,
      c,
      publicSignals,
    ] satisfies Parameters<typeof recoveryPlugin.recoverAccount.staticCall>;

    await recoveryPlugin
      .connect(newEcdsaPluginSigner)
      .recoverAccount.staticCall(...recoverAccountArgs);

    // Send tx to reset ecdsa address
    await receiptOf(
      recoveryPlugin
        .connect(newEcdsaPluginSigner)
        .recoverAccount(...recoverAccountArgs),
    );

    const newOwner = await safeEcdsaPlugin.ecdsaOwnerStorage(safeProxyAddress);
    expect(newOwner).to.equal(newEcdsaPluginSigner.address);

    // Send userOp with new owner
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
    const otherAccountAddress = await otherAccount.getAddress();
    const ownerAddress = await owner.getAddress();
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

    // Deploy guardian smart account
    const simpleAccountFactory = await ssf.connectOrDeploy(
      SimpleAccountFactory__factory,
      [entryPointAddress],
    );
    const otherSimpleAccountAddress =
      await simpleAccountFactory.createAccount.staticCall(
        otherAccountAddress,
        0,
      );

    await receiptOf(simpleAccountFactory.createAccount(otherAccountAddress, 0));

    // Construct userOp to add recovery account
    const chainId = (await provider.getNetwork()).chainId;
    const email = ethers.keccak256(ethers.toUtf8Bytes("test@mail.com"));
    const salt = "test salt";

    const recoveryhashDomain = ethers.solidityPackedKeccak256(
      ["string", "uint256", "uint256", "address"],
      ["RECOVERY_PLUGIN", 1, chainId, recoveryPluginAddress],
    );

    const recoveryHash = ethers.solidityPackedKeccak256(
      ["bytes32", "bytes32", "string"],
      [recoveryhashDomain, email, salt],
    );

    const safeProxyWithEcdsaPluginInterface = SafeECDSAPlugin__factory.connect(
      safeProxyAddress,
      provider,
    );
    const safeECDSAPluginAddress =
      await safeProxyWithEcdsaPluginInterface.myAddress();

    const addRecoveryHashCalldata = recoveryPlugin.interface.encodeFunctionData(
      "addRecoveryHash",
      [recoveryHash, ownerAddress, safeECDSAPluginAddress],
    );

    let safeEcdsaPlugin = SafeECDSAPlugin__factory.connect(
      safeProxyAddress,
      owner,
    );

    let userOpCallData = safeEcdsaPlugin.interface.encodeFunctionData(
      "execTransaction",
      [await recoveryPlugin.getAddress(), "0x00", addRecoveryHashCalldata],
    );

    const initCode = "0x";
    const dummySignature = await owner.signMessage("dummy sig");

    // Send userOp to add recovery account
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
      await recoveryPlugin.zkEmailRecoveryStorage(safeProxyAddress);
    expect(recoveryHash).to.equal(storedRecoveryHash);

    // Construct userOp to reset ecdsa address
    const newEcdsaPluginSigner = ethers.Wallet.createRandom().connect(provider);

    const a: [bigint, bigint] = [BigInt(0), BigInt(0)];
    const b: [[bigint, bigint], [bigint, bigint]] = [
      [BigInt(0), BigInt(0)],
      [BigInt(0), BigInt(0)],
    ];
    const c: [bigint, bigint] = [BigInt(0), BigInt(0)];
    const publicSignals: [bigint] = [BigInt(0)];

    const recoverAccountCalldata = recoveryPlugin.interface.encodeFunctionData(
      "recoverAccount",
      [
        safeProxyAddress,
        safeECDSAPluginAddress,
        newEcdsaPluginSigner.address,
        salt,
        email,
        a,
        b,
        c,
        publicSignals,
      ],
    );

    const simpleAccount = SimpleAccount__factory.createInterface();
    userOpCallData = simpleAccount.encodeFunctionData("execute", [
      await recoveryPlugin.getAddress(),
      "0x00",
      recoverAccountCalldata,
    ]);

    // Native tokens for the pre-fund
    await receiptOf(
      admin.sendTransaction({
        to: otherSimpleAccountAddress,
        value: ethers.parseEther("10"),
      }),
    );

    // Send userOp to reset ecdsa address
    // Note: Failing with an unrecognised custom error when attempting to first construct
    // the init code and pass it into the recovery user op, so deploying account
    // first and using empty init code here
    await createAndSendUserOpWithEcdsaSig(
      provider,
      bundlerProvider,
      otherAccount,
      otherSimpleAccountAddress,
      initCode,
      userOpCallData,
      entryPointAddress,
      dummySignature,
    );

    const newOwner = await safeEcdsaPlugin.ecdsaOwnerStorage(safeProxyAddress);
    expect(newOwner).to.equal(newEcdsaPluginSigner.address);

    // Send userOp with new owner
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

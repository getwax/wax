import { expect } from "chai";
import { ethers } from "ethers";
import {
  SafeECDSAPluginStateless__factory,
  SafeProxyFactoryBrokenDeployment__factory,
} from "../../typechain-types";
import receiptOf from "./utils/receiptOf";
import { setupTests } from "./utils/setupTests";
import {
  createAndSendUserOpWithEcdsaSig,
  generateInitCodeAndAddress,
} from "./utils/createUserOp";

const oneEther = ethers.parseEther("1");

describe("SafeECDSAPluginStateless", () => {
  it("should pass the ERC4337 validation (then fails when sending another userOp that tries to access a mapping value that doesn't exist)", async () => {
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
    const safeEcdsaPluginStateless = await ssf.connectOrDeploy(
      SafeECDSAPluginStateless__factory,
      [entryPointAddress],
    );

    // Construct userOp
    const userOpCallData =
      safeEcdsaPluginStateless.interface.encodeFunctionData("execTransaction", [
        recipient.address,
        transferAmount,
        "0x00",
      ]);

    const createFunctionName = "createProxyWithNonce";

    const { initCode, deployedAddress } = await generateInitCodeAndAddress(
      admin,
      owner,
      safeEcdsaPluginStateless,
      safeSingleton,
      safeProxyFactory,
      createFunctionName,
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

    const balanceBefore = await provider.getBalance(recipient.address);
    expect(ethers.dataLength(await provider.getCode(deployedAddress))).to.equal(
      0,
    );

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

    expect(
      ethers.dataLength(await provider.getCode(deployedAddress)),
    ).to.not.equal(0);

    expect(await provider.getBalance(recipient.address)).to.equal(
      balanceBefore + oneEther,
    );

    const initCodeEmpty = "0x";

    const createAndSendUserOp = createAndSendUserOpWithEcdsaSig(
      provider,
      bundlerProvider,
      owner,
      deployedAddress,
      initCodeEmpty,
      userOpCallData,
      entryPointAddress,
      dummySignature,
    );

    await expect(createAndSendUserOp).to.eventually.be.rejectedWith(
      "Invalid UserOp signature or paymaster signature",
    );
  });

  it("should fail ERC4337 validation because there are multiple 'CREATE2' opcodes in initcode", async () => {
    const {
      bundlerProvider,
      provider,
      admin,
      owner,
      entryPointAddress,
      ssf,
      safeSingleton,
      // safeProxyFactory,
    } = await setupTests();

    const safeProxyFactoryBrokenDeployment = await ssf.connectOrDeploy(
      SafeProxyFactoryBrokenDeployment__factory,
      [],
    );

    const recipient = ethers.Wallet.createRandom();
    const transferAmount = ethers.parseEther("1");
    const dummySignature = await owner.signMessage("dummy sig");

    // Deploy ecdsa plugin
    const safeEcdsaPluginStateless = await ssf.connectOrDeploy(
      SafeECDSAPluginStateless__factory,
      [entryPointAddress],
    );

    // Construct userOp
    const userOpCallData =
      safeEcdsaPluginStateless.interface.encodeFunctionData("execTransaction", [
        recipient.address,
        transferAmount,
        "0x00",
      ]);

    const createFunctionName = "createProxyWithNonceExtraCREATE2Opcode";

    const { initCode, deployedAddress } = await generateInitCodeAndAddress(
      admin,
      owner,
      safeEcdsaPluginStateless,
      safeSingleton,
      // safeProxyFactory,
      safeProxyFactoryBrokenDeployment,
      createFunctionName,
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
      "factory with too many CREATE2",
    );
  });

  it("should fail ERC4337 validation because the banned opcode 'CREATE' is used", async () => {
    const {
      bundlerProvider,
      provider,
      admin,
      owner,
      entryPointAddress,
      ssf,
      safeSingleton,
      // safeProxyFactory,
    } = await setupTests();

    const safeProxyFactoryBrokenDeployment = await ssf.connectOrDeploy(
      SafeProxyFactoryBrokenDeployment__factory,
      [],
    );

    const recipient = ethers.Wallet.createRandom();
    const transferAmount = ethers.parseEther("1");
    const dummySignature = await owner.signMessage("dummy sig");

    // Deploy ecdsa plugin
    const safeEcdsaPluginStateless = await ssf.connectOrDeploy(
      SafeECDSAPluginStateless__factory,
      [entryPointAddress],
    );

    // Construct userOp
    const userOpCallData =
      safeEcdsaPluginStateless.interface.encodeFunctionData("execTransaction", [
        recipient.address,
        transferAmount,
        "0x00",
      ]);

    const createFunctionName = "createProxyWithNonceWithCREATEOpcode";

    const { initCode, deployedAddress } = await generateInitCodeAndAddress(
      admin,
      owner,
      safeEcdsaPluginStateless,
      safeSingleton,
      // safeProxyFactory,
      safeProxyFactoryBrokenDeployment,
      createFunctionName,
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
      "factory uses banned opcode: CREATE",
    );
  });
});

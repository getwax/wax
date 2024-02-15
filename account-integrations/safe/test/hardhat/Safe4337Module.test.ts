import { expect } from "chai";
import { ethers } from "ethers";
import {
  AddModulesAndOwnersLib__factory,
  AddModulesLib__factory,
  EntryPoint__factory,
  Safe4337ModuleWithStorage__factory,
  Safe4337Module__factory,
  SafeProxyFactory,
  SimpleERC20__factory,
} from "../../typechain-types";
import receiptOf from "./utils/receiptOf";
import { setupTests } from "./utils/setupTests";
import { createAndSendUserOpWithEcdsaSig } from "./utils/createUserOp";
import { calculateProxyAddress } from "./utils/calculateProxyAddress";
import { Safe4337 } from "./utils/safe";
import {
  buildSafeUserOpTransaction,
  buildUserOperationFromSafeUserOperation,
  signSafeOp,
} from "./utils/userOp";
import { buildSignatureBytes } from "./utils/execution";
import sendUserOpAndWait from "./utils/sendUserOpAndWait";
import { AddressZero } from "@account-abstraction/utils";
import { getSigners } from "./utils/getSigners";

describe("Safe4337Module", () => {
  // This test deploys the Safe account via initCode and sends a user op at the same time. This just uses
  // the default canonical Safe 4337 module to do this and is basically replicating the integration test
  // that Safe wrote in their safe-modules repo for this module
  it("should pass the ERC4337 validation with original Safe4337Module.", async () => {
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

    // Deploy ecdsa plugin
    const safe4337Module = await ssf.connectOrDeploy(Safe4337Module__factory, [
      entryPointAddress,
    ]);
    const addModulesLib = await ssf.connectOrDeploy(AddModulesLib__factory, []);
    const addModulesLibAddress = await addModulesLib.getAddress();

    const safeSingletonAddress = await safeSingleton.getAddress();

    const token = await ssf.connectOrDeploy(SimpleERC20__factory, [
      "Test Token",
      "TEST",
      await admin.getAddress(),
      1000000n * 10n ** 18n,
    ]);

    const entryPoint = EntryPoint__factory.connect(entryPointAddress, admin);

    const proxyCreationCode = await safeProxyFactory.proxyCreationCode();

    const safe = await Safe4337.withSigner(await owner.getAddress(), {
      safeSingleton: safeSingletonAddress,
      entryPoint: entryPointAddress,
      erc4337module: await safe4337Module.getAddress(),
      proxyFactory: await safeProxyFactory.getAddress(),
      addModulesLib: addModulesLibAddress,
      proxyCreationCode,
      chainId: Number(await chainId(provider)),
    });

    await token
      .connect(admin)
      .transfer(safe.address, ethers.parseUnits("4.2", 18))
      .then(async (tx) => tx.wait());
    await owner
      .sendTransaction({ to: safe.address, value: ethers.parseEther("0.5") })
      .then(async (tx) => tx.wait());

    expect(ethers.dataLength(await provider.getCode(safe.address))).to.equal(0);
    expect(await token.balanceOf(safe.address)).to.equal(
      ethers.parseUnits("4.2", 18),
    );

    expect(ethers.dataLength(await provider.getCode(safe.address))).to.equal(0);

    // Send userOp
    const validAfter = (await timestamp(provider)) - 60;
    const validUntil = validAfter + 300;
    const safeOp = buildSafeUserOpTransaction(
      safe.address,
      await token.getAddress(),
      0,
      token.interface.encodeFunctionData("transfer", [
        await owner.getAddress(),
        await token.balanceOf(safe.address),
      ]),
      await entryPoint.getNonce(safe.address, 0),
      entryPointAddress,
      false,
      false,
      {
        initCode: safe.getInitCode(),
        validAfter,
        validUntil,
      },
    );
    const signature = buildSignatureBytes([
      await signSafeOp(
        owner,
        await safe4337Module.getAddress(),
        safeOp,
        await chainId(provider),
      ),
    ]);
    const userOp = buildUserOperationFromSafeUserOperation({
      safeOp,
      signature,
    });

    await sendUserOpAndWait(userOp, entryPointAddress, bundlerProvider);

    expect(
      ethers.dataLength(await provider.getCode(safe.address)),
    ).to.not.equal(0);
    expect(await token.balanceOf(safe.address)).to.equal(0);
    expect(await provider.getBalance(safe.address)).to.be.lessThan(
      ethers.parseEther("0.5"),
    );
  });

  // This test deploys the Safe account via initCode and sends a user op at the same time. A modified
  // Safe 4337 module is used that accesses state in the form of an account key. This test does not
  // access this state to show that deployment works with a statefull account when you don't access that state.
  it("should deploy account via initcode & send a user operation at the same time with Safe4337ModuleWithStorage but not actually accessing state.", async () => {
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

    const [, , , , recipient] = getSigners();
    const recipientAddress = await recipient.getAddress();
    const transferAmount = ethers.parseEther("1");
    const dummySignature = await owner.signMessage("dummy sig");

    // Deploy ecdsa plugin
    const safe4337ModuleWithStorage = await ssf.connectOrDeploy(
      Safe4337ModuleWithStorage__factory,
      [entryPointAddress],
    );
    const addModulesLib = await ssf.connectOrDeploy(AddModulesLib__factory, []);
    const addModulesLibAddress = await addModulesLib.getAddress();

    const safeSingletonAddress = await safeSingleton.getAddress();

    const initData = INTERFACES.encodeFunctionData("enableModules", [
      [await safe4337ModuleWithStorage.getAddress()],
    ]);

    const { safeAddress, initCode } = await buildInitParamsForConfig(
      await safe4337ModuleWithStorage.getAddress(),
      [owner.address],
      1,
      addModulesLibAddress,
      initData,
      safeSingletonAddress,
      "1",
      safeProxyFactory,
    );

    // Native tokens for the pre-fund
    await receiptOf(
      admin.sendTransaction({
        to: safeAddress,
        value: ethers.parseEther("10"),
      }),
    );

    // Construct userOp
    const userOpCallData =
      safe4337ModuleWithStorage.interface.encodeFunctionData("executeUserOp", [
        recipientAddress,
        transferAmount,
        "0x00",
        0,
      ]);

    expect(ethers.dataLength(await provider.getCode(safeAddress))).to.equal(0);
    const balanceBefore = await provider.getBalance(recipientAddress);

    // Send userOp
    await createAndSendUserOpWithEcdsaSig(
      provider,
      bundlerProvider,
      owner,
      safeAddress,
      initCode,
      userOpCallData,
      entryPointAddress,
      dummySignature,
    );

    expect(ethers.dataLength(await provider.getCode(safeAddress))).to.not.equal(
      0,
    );

    expect(await provider.getBalance(recipientAddress)).to.equal(
      balanceBefore + transferAmount,
    );
  });

  // This test attempts to deploy the Safe account via initCode and sends a user op at the same time. A modified
  // Safe 4337 module is used that accesses state in the form of an account key. This test uses a modified AddModulesLib
  // to add an owner to the module so that it can be used with it's own state. Because state is accessed in this test case, the initCode fails.
  it("should fail to deploy account via initcode & send a user operation at the same time while accessing state. With Safe4337ModuleWithStorage.", async () => {
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
    const safe4337ModuleWithStorage = await ssf.connectOrDeploy(
      Safe4337ModuleWithStorage__factory,
      [entryPointAddress],
    );
    const addModulesAndOwnersLib = await ssf.connectOrDeploy(
      AddModulesAndOwnersLib__factory,
      [],
    );
    const addModulesAndOwnersLibAddress =
      await addModulesAndOwnersLib.getAddress();

    const safeSingletonAddress = await safeSingleton.getAddress();

    const initData = INTERFACES.encodeFunctionData("enableModulesWithOwners", [
      [await safe4337ModuleWithStorage.getAddress()],
      [owner.address],
    ]);

    const { safeAddress, initCode } = await buildInitParamsForConfig(
      await safe4337ModuleWithStorage.getAddress(),
      [owner.address],
      1,
      addModulesAndOwnersLibAddress,
      initData,
      safeSingletonAddress,
      "1",
      safeProxyFactory,
    );

    // Native tokens for the pre-fund
    await receiptOf(
      admin.sendTransaction({
        to: safeAddress,
        value: ethers.parseEther("10"),
      }),
    );

    // Construct userOp
    const userOpCallData =
      safe4337ModuleWithStorage.interface.encodeFunctionData("executeUserOp", [
        recipient.address,
        transferAmount,
        "0x00",
        0,
      ]);

    // Send userOp
    const createAndSendUserOp = createAndSendUserOpWithEcdsaSig(
      provider,
      bundlerProvider,
      owner,
      safeAddress,
      initCode,
      userOpCallData,
      entryPointAddress,
      dummySignature,
    );
    await expect(createAndSendUserOp).to.eventually.be.rejectedWith(
      "unstaked factory accessed",
    );
  });

  // This test deploys the Safe account outside of 4337 with the safe proxy factory and sends a
  // user op afterwards with the initCode empty. A modified Safe 4337 module is used that accesses
  // state in the form of an account key. Because state is access after deployment (initCode is 0x),
  // the userOp succeeds unlike the previous test
  it("should deploy account outside of 4337 & send a user operation with no initCode while accessing state. With Safe4337ModuleWithStorage.", async () => {
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
    const safe4337ModuleWithStorage = await ssf.connectOrDeploy(
      Safe4337ModuleWithStorage__factory,
      [entryPointAddress],
    );
    const addModulesLib = await ssf.connectOrDeploy(AddModulesLib__factory, []);
    const addModulesLibAddress = await addModulesLib.getAddress();

    const safeSingletonAddress = await safeSingleton.getAddress();

    const moduleInitializer = INTERFACES.encodeFunctionData("enableModules", [
      [await safe4337ModuleWithStorage.getAddress()],
    ]);

    const encodedInitializer = safeSingleton.interface.encodeFunctionData(
      "setup",
      [
        [await owner.getAddress()],
        1,
        addModulesLibAddress,
        moduleInitializer,
        await safe4337ModuleWithStorage.getAddress(),
        AddressZero,
        0,
        AddressZero,
      ],
    );

    const safeAddress = await calculateProxyAddress(
      safeProxyFactory,
      safeSingletonAddress,
      encodedInitializer,
      73,
    );

    // deploy safe
    await safeProxyFactory
      .connect(owner)
      .createProxyWithNonce(safeSingletonAddress, encodedInitializer, 73);

    // Native tokens for the pre-fund
    await receiptOf(
      admin.sendTransaction({
        to: safeAddress,
        value: ethers.parseEther("10"),
      }),
    );

    const initCode = "0x";

    // Construct userOp
    const userOpCallData =
      safe4337ModuleWithStorage.interface.encodeFunctionData("executeUserOp", [
        recipient.address,
        transferAmount,
        "0x00",
        0,
      ]);

    const balanceBefore = await provider.getBalance(recipient.address);

    // Send userOp
    await createAndSendUserOpWithEcdsaSig(
      provider,
      bundlerProvider,
      owner,
      safeAddress,
      initCode,
      userOpCallData,
      entryPointAddress,
      dummySignature,
    );
    expect(ethers.dataLength(await provider.getCode(safeAddress))).to.not.equal(
      0,
    );

    expect(await provider.getBalance(recipient.address)).to.equal(
      balanceBefore + transferAmount,
    );
  });
});

const timestamp = async (provider: ethers.Provider) => {
  const block = await provider.getBlock("latest");
  if (block === null) {
    throw new Error("missing latest block???");
  }
  return block.timestamp;
};

const chainId = async (provider: ethers.Provider) => {
  return (await provider.getNetwork()).chainId;
};

const INTERFACES = new ethers.Interface([
  "function enableModule(address)",
  "function setup(address[],uint256,address,bytes,address,address,uint256,address)",
  "function createProxyWithNonce(address,bytes,uint256) returns (address)",
  "function proxyCreationCode() returns (bytes)",
  "function enableModules(address[])",
  "function enableModulesWithOwners(address[], address[])",
  "function execTransactionFromModule(address to, uint256 value, bytes calldata data, uint8 operation) external payable returns (bool success)",
  "function executeUserOp(address to, uint256 value, bytes calldata data, uint8 operation)",
  "function getNonce(address,uint192) returns (uint256 nonce)",
  "function supportedEntryPoint() returns (address)",
  "function getOwners() returns (address[])",
  "function getThreshold() view returns (uint256)",
  "function getModulesPaginated(address, uint256) returns (address[], address)",
  "function getOperationHash(address,bytes,uint256,uint256,uint256,uint256,uint256,uint256,address)",
]);

export type GlobalConfig = {
  safeSingleton: string;
  entryPoint: string;
  erc4337module: string;
  proxyFactory: string;
  proxyCreationCode: string;
  addModulesLib: string;
  chainId: number;
};

export type SafeConfig = {
  signers: string[];
  threshold: number;
  nonce: number;
};

const buildInitParamsForConfig = async (
  erc4337module: string,
  signers: string[],
  threshold: number,
  addModulesLib: string,
  initData: string,
  safeSingleton: string,
  nonce: string,
  proxyFactory: SafeProxyFactory,
): Promise<{ safeAddress: string; initCode: string }> => {
  const setupData = INTERFACES.encodeFunctionData("setup", [
    signers,
    threshold,
    addModulesLib,
    initData,
    erc4337module,
    ethers.ZeroAddress,
    0,
    ethers.ZeroAddress,
  ]);
  const deployData = INTERFACES.encodeFunctionData("createProxyWithNonce", [
    safeSingleton,
    setupData,
    nonce,
  ]);
  const safeAddress = await calculateProxyAddress(
    proxyFactory,
    safeSingleton,
    setupData,
    nonce,
  );
  const initCode = ethers.concat([await proxyFactory.getAddress(), deployData]);
  return {
    safeAddress,
    initCode,
  };
};

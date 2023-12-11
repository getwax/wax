import { expect } from "chai";
import { ethers } from "ethers";
import {
  AddModulesLib__factory,
  Safe4337Module__factory,
  SafeProxyFactory,
} from "../../typechain-types";
import receiptOf from "./utils/receiptOf";
import { setupTests } from "./utils/setupTests";
import { createAndSendUserOpWithEcdsaSig } from "./utils/createUserOp";
import { calculateProxyAddress } from "./utils/calculateProxyAddress";

describe("Safe4337Module", () => {
  it("should pass the ERC4337 validation.", async () => {
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
    const safeEcdsaPlugin = await ssf.connectOrDeploy(Safe4337Module__factory, [
      entryPointAddress,
    ]);
    const addModulesLib = await ssf.connectOrDeploy(AddModulesLib__factory, []);
    const addModulesLibAddress = await addModulesLib.getAddress();

    const safeSingletonAddress = await safeSingleton.getAddress();

    const { safeAddress, initCode } = await buildInitParamsForConfig(
      await safeEcdsaPlugin.getAddress(),
      [owner.address],
      1,
      addModulesLibAddress,
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

    // FIXME: Why do you have to send this transaction to the recipient in order for
    // the recipient balance to update when the actual userOp is sent??
    await receiptOf(
      admin.sendTransaction({
        to: recipient.address,
        value: ethers.parseEther("1"),
      }),
    );

    // Construct userOp
    const userOpCallData = safeEcdsaPlugin.interface.encodeFunctionData(
      "executeUserOp",
      [recipient.address, transferAmount, "0x00", 0],
    );

    expect(ethers.dataLength(await provider.getCode(safeAddress))).to.equal(0);
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

const INTERFACES = new ethers.Interface([
  "function enableModule(address)",
  "function setup(address[],uint256,address,bytes,address,address,uint256,address)",
  "function createProxyWithNonce(address,bytes,uint256) returns (address)",
  "function proxyCreationCode() returns (bytes)",
  "function enableModules(address[])",
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
  safeSingleton: string,
  nonce: string,
  proxyFactory: SafeProxyFactory,
): Promise<{ safeAddress: string; initCode: string }> => {
  const initData = INTERFACES.encodeFunctionData("enableModules", [
    [erc4337module],
  ]);
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

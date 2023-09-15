import { ethers } from "hardhat";
import { expect } from "chai";
import { AddressZero } from "@ethersproject/constants";
import { getBytes } from "ethers";
import { ethers as ethersV5 } from "ethers-v5";
import { UserOperationStruct } from "@account-abstraction/contracts";
import { calculateProxyAddress } from "./utils/calculateProxyAddress";
import { getUserOpHash } from "@account-abstraction/utils";

import { executeContractCallWithSigners } from "./utils/execution";

import { SafeProxyFactory } from "../../typechain-types/lib/safe-contracts/contracts/proxies/SafeProxyFactory";
import { Safe } from "../../typechain-types/lib/safe-contracts/contracts/Safe";
import { EntryPoint } from "../../typechain-types/lib/account-abstraction/contracts/core/EntryPoint";

const MNEMONIC = "test test test test test test test test test test test junk";

let safeProxyFactory: SafeProxyFactory;
let safe: Safe;
let entryPoint: EntryPoint;

describe("RecoveryPlugin", () => {
  const setupTests = async () => {
    safeProxyFactory = await (
      await ethers.getContractFactory("SafeProxyFactory")
    ).deploy();
    safe = await (await ethers.getContractFactory("Safe")).deploy();
    entryPoint = await (await ethers.getContractFactory("EntryPoint")).deploy();

    const provider = ethers.provider;
    const userWallet = ethers.Wallet.fromPhrase(MNEMONIC).connect(provider);

    return {
      provider,
      userWallet,
    };
  };

  /**
   * This test verifies a ERC4337 transaction succeeds when sent via a plugin
   * The user operation deploys a Safe with the ERC4337 plugin and a handler
   * and executes a transaction, thus verifying two things:
   * 1. Deployment of the Safe with the ERC4337 plugin and handler is possible
   * 2. Executing a transaction is possible
   */
  it("should pass the ERC4337 validation", async () => {
    const { provider, userWallet } = await setupTests();
    const ENTRYPOINT_ADDRESS = await entryPoint.getAddress();

    const safeECDSAPluginFactory = (
      await ethers.getContractFactory("SafeECDSAPlugin")
    ).connect(userWallet);

    const safeECDSAPlugin = await safeECDSAPluginFactory.deploy(
      ENTRYPOINT_ADDRESS,
      userWallet.address,
      { gasLimit: 10_000_000 }
    );

    const feeData = await provider.getFeeData();
    if (!feeData.maxFeePerGas || !feeData.maxPriorityFeePerGas) {
      throw new Error(
        "maxFeePerGas or maxPriorityFeePerGas is null or undefined"
      );
    }

    const maxFeePerGas = "0x" + feeData.maxFeePerGas.toString();
    const maxPriorityFeePerGas = "0x" + feeData.maxPriorityFeePerGas.toString();

    const safeECDSAPluginAddress = await safeECDSAPlugin.getAddress();
    const singletonAddress = await safe.getAddress();
    const factoryAddress = await safeProxyFactory.getAddress();

    const moduleInitializer = safeECDSAPlugin.interface.encodeFunctionData(
      // @ts-ignore
      "enableMyself",
      []
    );
    const encodedInitializer = safe.interface.encodeFunctionData("setup", [
      [userWallet.address],
      1,
      safeECDSAPluginAddress,
      moduleInitializer,
      safeECDSAPluginAddress,
      AddressZero,
      0,
      AddressZero,
    ]);

    const deployedAddress = await calculateProxyAddress(
      safeProxyFactory as any,
      singletonAddress,
      encodedInitializer,
      73
    );

    // The initCode contains 20 bytes of the factory address and the rest is the calldata to be forwarded
    const initCode = ethers.concat([
      factoryAddress,
      safeProxyFactory.interface.encodeFunctionData("createProxyWithNonce", [
        singletonAddress,
        encodedInitializer,
        73,
      ]),
    ]);

    const signer = new ethers.Wallet(
      "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
    );
    const recipientAddress = signer.address;
    const transferAmount = ethers.parseEther("1");

    const userOpCallData = safeECDSAPlugin.interface.encodeFunctionData(
      "execTransaction",
      [recipientAddress, transferAmount, "0x00"]
    );

    // Native tokens for the pre-fund 💸
    await userWallet.sendTransaction({
      to: deployedAddress,
      value: ethers.parseEther("100"),
    });

    const unsignedUserOperation: UserOperationStruct = {
      sender: deployedAddress,
      nonce: "0x0",
      initCode,
      callData: userOpCallData,
      verificationGasLimit: 1e6,
      callGasLimit: 1e6,
      preVerificationGas: 1e6,
      maxFeePerGas,
      maxPriorityFeePerGas,
      paymasterAndData: "0x",
      signature: "",
    };

    const resolvedUserOp = await ethers.resolveProperties(
      unsignedUserOperation
    );
    const userOpHash = getUserOpHash(
      resolvedUserOp,
      ENTRYPOINT_ADDRESS,
      Number((await provider.getNetwork()).chainId)
    );

    const userOpSignature = await userWallet.signMessage(getBytes(userOpHash));

    const userOperation = {
      ...unsignedUserOperation,
      signature: userOpSignature,
    };

    const recipientBalanceBefore = await provider.getBalance(recipientAddress);

    try {
      const rcpt = await entryPoint.handleOps(
        // @ts-ignore
        [userOperation],
        ENTRYPOINT_ADDRESS
      );
    } catch (e) {
      console.log("EntryPoint handleOps error=", e);
    }

    const recipientBalanceAfter = await provider.getBalance(recipientAddress);
    const expectedRecipientBalance = recipientBalanceBefore + transferAmount;

    expect(recipientBalanceAfter).to.equal(expectedRecipientBalance);

    // TODO: update owner directly - probably shouldn't be able to do this

    const twoUserOpCallData = safeECDSAPlugin.interface.encodeFunctionData(
        "updateOwner",
        [recipientAddress]
    );

    const twoUnsignedUserOperation: UserOperationStruct = {
        sender: deployedAddress,
        nonce: "0x1",
        initCode: "0x",
        callData: twoUserOpCallData,
        verificationGasLimit: 1e6,
        callGasLimit: 1e6,
        preVerificationGas: 1e6,
        maxFeePerGas,
        maxPriorityFeePerGas,
        paymasterAndData: "0x",
        signature: "",
    };

    const twoResolvedUserOp = await ethers.resolveProperties(
        twoUnsignedUserOperation
    );

    const twoUserOpHash = getUserOpHash(
        twoResolvedUserOp,
        ENTRYPOINT_ADDRESS,
        Number((await provider.getNetwork()).chainId)
    );

    const twoUserOpSignature = await userWallet.signMessage(getBytes(twoUserOpHash));

    const twoUserOperation = {
        ...twoUnsignedUserOperation,
        signature: twoUserOpSignature,
    };

    try {
        const rcpt = await entryPoint.handleOps(
            // @ts-ignore
            [twoUserOperation],
            ENTRYPOINT_ADDRESS
        );
    } catch (e) {
        console.log("EntryPoint handleOps error=", e);
    }

    // try to deploy the recovery plugin
    // const recoverySigner = ethers.Wallet.createRandom().connect(provider);
    const [,, recoverySigner] = await ethers.getSigners();

    const recoveryPlugin = await (
        await ethers.getContractFactory("RecoveryPlugin")
    ).deploy(
        deployedAddress,
        recoverySigner.address,
    );

    const recoveryPluginAddress = await recoveryPlugin.getAddress();

    // add module to safe

    const safeObj = await ethers.getContractAt("Safe", deployedAddress);
    
    const v5Provider = new ethersV5.providers.JsonRpcProvider(
        "http://127.0.0.1:8545"
    );
    const userWallet2 = ethersV5.Wallet.fromMnemonic(MNEMONIC).connect(v5Provider);
    const isModuleEnabledBefore = await safeObj.isModuleEnabled(recoveryPluginAddress);

    // logging for testing
    console.log('Test - recovery plugin:    ', recoveryPluginAddress)
    console.log('Test - safe:               ', await safeObj.getAddress());
    console.log('Is module enabled before:  ', isModuleEnabledBefore);

    // @ts-ignore userWalet2 doesn't have all properties for some reason
    await executeContractCallWithSigners(safeObj, safeObj, "enableModule", [recoveryPluginAddress], [userWallet2]);

    const isModuleEnabled = await safeObj.isModuleEnabled(recoveryPluginAddress);
    console.log('Is module enabled:         ', isModuleEnabled);

    // ****** make call from recovery plugin

    const ecdsaaddress = await safeECDSAPlugin.getAddress();
    const newEcdsaPluginSigner = ethers.Wallet.createRandom().connect(provider);

    const recoveryPluginSinger = recoveryPlugin.connect(recoverySigner);

    await recoveryPluginSinger.resetEcdsaAddress(
        await safeObj.getAddress(),
        ecdsaaddress,
        newEcdsaPluginSigner.address
    );

    // ***** Send tx with new key

    const threeUserOpCallData = safeECDSAPlugin.interface.encodeFunctionData(
        "execTransaction",
        [recipientAddress, transferAmount, "0x00"]
    );

    const threeUnsignedUserOperation: UserOperationStruct = {
        sender: deployedAddress,
        nonce: "0x2",
        initCode: "0x",
        callData: threeUserOpCallData,
        verificationGasLimit: 1e6,
        callGasLimit: 1e6,
        preVerificationGas: 1e6,
        maxFeePerGas,
        maxPriorityFeePerGas,
        paymasterAndData: "0x",
        signature: "",
    };

    const threeResolvedUserOp = await ethers.resolveProperties(
        threeUnsignedUserOperation
    );

    const threeUserOpHash = getUserOpHash(
        threeResolvedUserOp,
        ENTRYPOINT_ADDRESS,
        Number((await provider.getNetwork()).chainId)
    );

    const threeUserOpSignature = await newEcdsaPluginSigner.signMessage(getBytes(threeUserOpHash));

    const threeUserOperation = {
        ...threeUnsignedUserOperation,
        signature: threeUserOpSignature,
    };

    const threerecipientBalanceBefore = await provider.getBalance(recipientAddress);

    try {
        const rcpt = await entryPoint.handleOps(
            // @ts-ignore
            [threeUserOperation],
            ENTRYPOINT_ADDRESS
        );
    } catch (e) {
        console.log("EntryPoint handleOps error=", e);
    }

    const threerecipientBalanceAfter = await provider.getBalance(recipientAddress);
    const threeexpectedRecipientBalance = threerecipientBalanceBefore + transferAmount;

    expect(threerecipientBalanceAfter).to.equal(threeexpectedRecipientBalance);

  });
});

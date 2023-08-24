import hre from "hardhat";
import { expect } from "chai";
import { AddressZero } from "@ethersproject/constants";
import { concat, ethers, BigNumberish, resolveProperties, getBytes } from "ethers";
import { ethers as ethersV5 } from "ethers-v5";
import { UserOperationStruct } from "@account-abstraction/contracts";
import { calculateProxyAddress } from "../../utils/calculateProxyAddress";
import { signer as blsSigner, mcl } from '@thehubbleproject/bls';
import { getUserOpHash } from "@account-abstraction/utils";

import { SafeProxyFactory as SafeProxyFactoryType } from "../../typechain-types/lib/safe-contracts/contracts/proxies/SafeProxyFactory";
import { Safe as SafeType } from "../../typechain-types/lib/safe-contracts/contracts/Safe";
import { EntryPoint as EntryPointType } from "../../typechain-types/lib/account-abstraction/contracts/core/EntryPoint";

const MNEMONIC = process.env.MNEMONIC;
const BLS_PRIVATE_KEY =
'0xdbe3d601b1b25c42c50015a87855fdce00ea9b3a7e33c92d31c69aeb70708e08';

let safeProxyFactory: SafeProxyFactoryType;
let safe: SafeType;
let entryPoint: EntryPointType;

describe("SafeBlsPlugin", () => {
  const setupTests = async () => {
    const SafeProxyFactory = await hre.ethers.getContractFactory("SafeProxyFactory");
    const Safe = await hre.ethers.getContractFactory("Safe");
    const EntryPoint = await hre.ethers.getContractFactory("EntryPoint");

    safeProxyFactory = await SafeProxyFactory.deploy();
    safe = await Safe.deploy();
    entryPoint = await EntryPoint.deploy();

    // const bundlerProvider = new ethersV5.providers.JsonRpcProvider(BUNDLER_URL);
    // const provider = new ethers.JsonRpcProvider(NODE_URL);
    const provider = hre.ethers.provider;
    const userWallet = ethers.Wallet.fromPhrase(MNEMONIC as string).connect(
      provider
    );

    return {
        provider,
        userWallet,
        entryPoint,
        safe,
        safeProxyFactory,
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
    const {
        provider,
        userWallet,
        entryPoint,
        safe,
        safeProxyFactory,
    } = await setupTests();
    const domain = ethersV5.utils.arrayify(ethersV5.utils.keccak256(Buffer.from('eip4337.bls.domain')));
    const signerFactory = await blsSigner.BlsSignerFactory.new();
    const intSigner = signerFactory.getSigner(domain, BLS_PRIVATE_KEY);

    // const { publicKey, userOpSignature } = getPublicKeyAndSignature();
    const ENTRYPOINT_ADDRESS = await entryPoint.getAddress();

    const safeBlsPluginFactory = (
      await hre.ethers.getContractFactory("SafeBlsPlugin")
    ).connect(userWallet);
    const safeBlsPlugin = await safeBlsPluginFactory.deploy(
      ENTRYPOINT_ADDRESS,
      intSigner.pubkey,
      { gasLimit: 30_000_000 }
    );
    // The bundler uses a different node, so we need to allow it sometime to sync
    // await sleep(5000);

    const feeData = await provider.getFeeData();
    if (!feeData.maxFeePerGas || !feeData.maxPriorityFeePerGas) {
      throw new Error(
        "maxFeePerGas or maxPriorityFeePerGas is null or undefined"
      );
    }

    const maxFeePerGas = "0x" + feeData.maxFeePerGas.toString();
    const maxPriorityFeePerGas = "0x" + feeData.maxPriorityFeePerGas.toString();

    const safeBlsPluginAddress = await safeBlsPlugin.getAddress();
    const singletonAddress = await safe.getAddress();
    const factoryAddress = await safeProxyFactory.getAddress();

    const moduleInitializer = safeBlsPlugin.interface.encodeFunctionData(
      "enableMyself",
      []
    );
    const encodedInitializer = safe.interface.encodeFunctionData("setup", [
      [userWallet.address],
      1,
      safeBlsPluginAddress,
      moduleInitializer,
      safeBlsPluginAddress,
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
    const initCode = concat([
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

    const userOpCallData = safeBlsPlugin.interface.encodeFunctionData(
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

    const resolvedUserOp = await resolveProperties(unsignedUserOperation);
    const userOpHash = getUserOpHash(
        resolvedUserOp,
        await entryPoint.getAddress(),
        Number((await provider.getNetwork()).chainId)
    );
    const userOpSignature = await intSigner.sign(userOpHash);
    console.log(userOpSignature)
    const userOperation = {
        ...unsignedUserOperation,
        signature: ethersV5.utils.solidityPack(["uint256", "uint256"], userOpSignature),
    };

    const DEBUG_MESSAGE = `
            Using entry point: ${ENTRYPOINT_ADDRESS}
            Deployed Safe address: ${deployedAddress}
            Module/Handler address: ${safeBlsPluginAddress}
            User operation: 
            ${JSON.stringify(userOperation, null, 2)}
        `;
    console.log(DEBUG_MESSAGE);

    const recipientBalanceBefore = await provider.getBalance(recipientAddress);

    try {
        const rcpt = await entryPoint
            .handleOps(
            [userOperation],
            ENTRYPOINT_ADDRESS
            )
    } catch (e) {
        console.log('error=', e);
    }

    const recipientBalanceAfter = await provider.getBalance(recipientAddress);

    const expectedRecipientBalance = recipientBalanceBefore + transferAmount;
    expect(recipientBalanceAfter).to.equal(expectedRecipientBalance);
  });
});

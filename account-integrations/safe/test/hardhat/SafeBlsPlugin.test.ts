import { ethers } from "hardhat";
import { expect } from "chai";
import { AddressZero } from "@ethersproject/constants";
import { getBytes, keccak256, solidityPacked } from "ethers";
import { UserOperationStruct } from "@account-abstraction/contracts";
import { signer as hubbleBlsSigner } from "@thehubbleproject/bls";
import { getUserOpHash } from "@account-abstraction/utils";
import { calculateProxyAddress } from "./utils/calculateProxyAddress";

const BLS_PRIVATE_KEY =
  "0xdbe3d601b1b25c42c50015a87855fdce00ea9b3a7e33c92d31c69aeb70708e08";
const MNEMONIC = "test test test test test test test test test test test junk";

describe("SafeBlsPlugin", () => {
  const setupTests = async () => {
    const safeProxyFactory = await (
      await ethers.getContractFactory("SafeProxyFactory")
    ).deploy();
    const safe = await (await ethers.getContractFactory("Safe")).deploy();
    const entryPoint = await (
      await ethers.getContractFactory("EntryPoint")
    ).deploy();

    const provider = ethers.provider;
    const userWallet = ethers.Wallet.fromPhrase(MNEMONIC).connect(provider);

    return {
      safeProxyFactory,
      safe,
      entryPoint,
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
    const { entryPoint, safe, safeProxyFactory, provider, userWallet } =
      await setupTests();

    const domain = getBytes(keccak256(Buffer.from("eip4337.bls.domain")));
    const signerFactory = await hubbleBlsSigner.BlsSignerFactory.new();
    const blsSigner = signerFactory.getSigner(domain, BLS_PRIVATE_KEY);

    const ENTRYPOINT_ADDRESS = await entryPoint.getAddress();

    const safeBlsPluginFactory = (
      await ethers.getContractFactory("SafeBlsPlugin")
    ).connect(userWallet);
    const safeBlsPlugin = await safeBlsPluginFactory.deploy(
      ENTRYPOINT_ADDRESS,
      blsSigner.pubkey,
      { gasLimit: 30_000_000 },
    );

    const feeData = await provider.getFeeData();
    if (!feeData.maxFeePerGas || !feeData.maxPriorityFeePerGas) {
      throw new Error(
        "maxFeePerGas or maxPriorityFeePerGas is null or undefined",
      );
    }

    const maxFeePerGas = `0x${feeData.maxFeePerGas.toString()}`;
    const maxPriorityFeePerGas = `0x${feeData.maxPriorityFeePerGas.toString()}`;

    const safeBlsPluginAddress = await safeBlsPlugin.getAddress();
    const singletonAddress = await safe.getAddress();
    const factoryAddress = await safeProxyFactory.getAddress();

    const moduleInitializer =
      safeBlsPlugin.interface.encodeFunctionData("enableMyself");
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
      safeProxyFactory,
      singletonAddress,
      encodedInitializer,
      73,
    );

    // The initCode contains 20 bytes of the factory address and the rest is the
    // calldata to be forwarded
    const initCode = ethers.concat([
      factoryAddress,
      safeProxyFactory.interface.encodeFunctionData("createProxyWithNonce", [
        singletonAddress,
        encodedInitializer,
        73,
      ]),
    ]);

    const signer = new ethers.Wallet(
      "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
    );
    const recipientAddress = signer.address;
    const transferAmount = ethers.parseEther("1");

    const userOpCallData = safeBlsPlugin.interface.encodeFunctionData(
      "execTransaction",
      [recipientAddress, transferAmount, "0x00"],
    );

    // Native tokens for the pre-fund 💸
    await userWallet.sendTransaction({
      to: deployedAddress,
      value: ethers.parseEther("100"),
    });

    const unsignedUserOperation = {
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
    } satisfies UserOperationStruct;

    const resolvedUserOp = await ethers.resolveProperties(
      unsignedUserOperation,
    );
    const userOpHash = getUserOpHash(
      resolvedUserOp,
      ENTRYPOINT_ADDRESS,
      Number((await provider.getNetwork()).chainId),
    );

    // Create BLS signature of the userOpHash
    const userOpSignature = blsSigner.sign(userOpHash);

    const userOperation = {
      ...unsignedUserOperation,
      signature: solidityPacked(["uint256", "uint256"], userOpSignature),
    };

    // Uncomment to get a detailed debug message
    // const DEBUG_MESSAGE = `
    //         Using entry point: ${ENTRYPOINT_ADDRESS}
    //         Deployed Safe address: ${deployedAddress}
    //         Module/Handler address: ${safeBlsPluginAddress}
    //         User operation:
    //         ${JSON.stringify(userOperation, null, 2)}
    //     `;
    // console.log(DEBUG_MESSAGE);

    const recipientBalanceBefore = await provider.getBalance(recipientAddress);

    try {
      const _rcpt = await entryPoint.handleOps(
        [userOperation],
        ENTRYPOINT_ADDRESS,
      );
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log("EntryPoint handleOps error=", e);
    }

    const recipientBalanceAfter = await provider.getBalance(recipientAddress);
    const expectedRecipientBalance = recipientBalanceBefore + transferAmount;

    expect(recipientBalanceAfter).to.equal(expectedRecipientBalance);
  });
});

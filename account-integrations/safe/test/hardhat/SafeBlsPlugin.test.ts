import { expect } from "chai";
import { AddressZero } from "@ethersproject/constants";
import { ethers, getBytes, keccak256, solidityPacked } from "ethers";
import { UserOperationStruct } from "@account-abstraction/contracts";
import { signer as hubbleBlsSigner } from "@thehubbleproject/bls";
import { getUserOpHash } from "@account-abstraction/utils";
import { calculateProxyAddress } from "./utils/calculateProxyAddress";
import SafeSingletonFactory from "./utils/SafeSingletonFactory";
import {
  EntryPoint__factory,
  SafeBlsPlugin__factory,
} from "../../typechain-types";
import receiptOf from "./utils/receiptOf";
import sleep from "./utils/sleep";
import { setupTests } from "./utils/setupTests";

const ERC4337_TEST_ENV_VARIABLES_DEFINED =
  typeof process.env.ERC4337_TEST_BUNDLER_URL !== "undefined" &&
  typeof process.env.ERC4337_TEST_NODE_URL !== "undefined" &&
  typeof process.env.MNEMONIC !== "undefined";

const itif = ERC4337_TEST_ENV_VARIABLES_DEFINED ? it : it.skip;

const BLS_PRIVATE_KEY =
  "0xdbe3d601b1b25c42c50015a87855fdce00ea9b3a7e33c92d31c69aeb70708e08";

describe("SafeBlsPlugin", () => {
  /**
   * This test verifies a ERC4337 transaction succeeds when sent via a plugin
   * The user operation deploys a Safe with the ERC4337 plugin and a handler
   * and executes a transaction, thus verifying two things:
   * 1. Deployment of the Safe with the ERC4337 plugin and handler is possible
   * 2. Executing a transaction is possible
   */
  itif("should pass the ERC4337 validation", async () => {
    const {
      bundlerProvider,
      provider,
      admin,
      owner,
      entryPoints,
      safeProxyFactory,
      safeSingleton,
    } = await setupTests();

    const domain = getBytes(keccak256(Buffer.from("eip4337.bls.domain")));
    const signerFactory = await hubbleBlsSigner.BlsSignerFactory.new();
    const blsSigner = signerFactory.getSigner(domain, BLS_PRIVATE_KEY);

    const ENTRYPOINT_ADDRESS = entryPoints[0];

    const ssf = await SafeSingletonFactory.init(admin);

    const safeBlsPlugin = await ssf.connectOrDeploy(SafeBlsPlugin__factory, [
      ENTRYPOINT_ADDRESS,
      blsSigner.pubkey,
    ]);

    const feeData = await provider.getFeeData();
    if (!feeData.maxFeePerGas || !feeData.maxPriorityFeePerGas) {
      throw new Error(
        "maxFeePerGas or maxPriorityFeePerGas is null or undefined",
      );
    }

    const maxFeePerGas = `0x${feeData.maxFeePerGas.toString()}`;
    const maxPriorityFeePerGas = `0x${feeData.maxPriorityFeePerGas.toString()}`;

    const safeBlsPluginAddress = await safeBlsPlugin.getAddress();
    const singletonAddress = await safeSingleton.getAddress();
    const factoryAddress = await safeProxyFactory.getAddress();

    const moduleInitializer =
      safeBlsPlugin.interface.encodeFunctionData("enableMyself");
    const encodedInitializer = safeSingleton.interface.encodeFunctionData(
      "setup",
      [
        [owner.address],
        1,
        safeBlsPluginAddress,
        moduleInitializer,
        safeBlsPluginAddress,
        AddressZero,
        0,
        AddressZero,
      ],
    );

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
    await receiptOf(
      admin.sendTransaction({
        to: deployedAddress,
        value: ethers.parseEther("10"),
      }),
    );
    const encoder = ethers.AbiCoder.defaultAbiCoder();
    const dummyHash = ethers.keccak256(
      encoder.encode(["string"], ["dummyHash"]),
    );
    const dummySignature = solidityPacked(
      ["uint256", "uint256"],
      blsSigner.sign(dummyHash),
    );

    const userOperationWithoutGasFields = {
      sender: deployedAddress,
      nonce: "0x0",
      initCode,
      callData: userOpCallData,
      callGasLimit: "0x00",
      paymasterAndData: "0x",
      signature: dummySignature,
    };

    const gasEstimate = (await bundlerProvider.send(
      "eth_estimateUserOperationGas",
      [userOperationWithoutGasFields, ENTRYPOINT_ADDRESS],
    )) as {
      verificationGasLimit: string;
      preVerificationGas: string;
      callGasLimit: string;
    };

    const safeVerificationGasLimit =
      BigInt(gasEstimate.verificationGasLimit) +
      BigInt(gasEstimate.verificationGasLimit) / 5n; // + 20%

    const safePreVerificationGas =
      BigInt(gasEstimate.preVerificationGas) +
      BigInt(gasEstimate.preVerificationGas) / 50n; // + 2%

    const unsignedUserOperation = {
      sender: deployedAddress,
      nonce: "0x0",
      initCode,
      callData: userOpCallData,
      callGasLimit: gasEstimate.callGasLimit,
      verificationGasLimit: ethers.toBeHex(safeVerificationGasLimit),
      preVerificationGas: ethers.toBeHex(safePreVerificationGas),
      maxFeePerGas,
      maxPriorityFeePerGas,
      paymasterAndData: "0x",
      signature: dummySignature,
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

    // TODO: #138 Send via bundler once BLS lib is 4337 compatible
    // await sendUserOpAndWait(userOperation, ENTRYPOINT_ADDRESS, bundlerProvider);

    const entryPoint = EntryPoint__factory.connect(ENTRYPOINT_ADDRESS, admin);

    await entryPoint.connect(admin).handleOps([userOperation], admin.address);
    await entryPoint.getUserOpHash(userOperation);
    // TODO: why is this needed to prevent "nonce too low" error
    await sleep(5000);

    const recipientBalanceAfter = await provider.getBalance(recipientAddress);
    const expectedRecipientBalance = recipientBalanceBefore + transferAmount;

    expect(recipientBalanceAfter).to.equal(expectedRecipientBalance);
  });
});

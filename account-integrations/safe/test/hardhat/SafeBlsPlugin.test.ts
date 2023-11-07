import { expect } from "chai";
import { ethers, getBytes, keccak256, solidityPacked } from "ethers";
import { signer as hubbleBlsSigner } from "@thehubbleproject/bls";
import { getUserOpHash } from "@account-abstraction/utils";
import SafeSingletonFactory from "./utils/SafeSingletonFactory";
import {
  EntryPoint__factory,
  SafeBlsPlugin__factory,
} from "../../typechain-types";
import { setupTests } from "./utils/setupTests";
import receiptOf from "./utils/receiptOf";
import {
  createInitCode,
  createUnsignedUserOperation,
} from "./utils/createUserOp";

const BLS_PRIVATE_KEY =
  "0xdbe3d601b1b25c42c50015a87855fdce00ea9b3a7e33c92d31c69aeb70708e08";

describe("SafeBlsPlugin", () => {
  it("should pass the ERC4337 validation", async () => {
    const {
      bundlerProvider,
      provider,
      admin,
      owner,
      entryPointAddress,
      safeProxyFactory,
      safeSingleton,
    } = await setupTests();

    const domain = getBytes(keccak256(Buffer.from("eip4337.bls.domain")));
    const signerFactory = await hubbleBlsSigner.BlsSignerFactory.new();
    const blsSigner = signerFactory.getSigner(domain, BLS_PRIVATE_KEY);

    const ssf = await SafeSingletonFactory.init(admin);
    const safeBlsPlugin = await ssf.connectOrDeploy(SafeBlsPlugin__factory, [
      entryPointAddress,
      blsSigner.pubkey,
    ]);

    const signer = new ethers.Wallet(
      "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
    );
    const recipientAddress = signer.address;
    const transferAmount = ethers.parseEther("1");

    const encoder = ethers.AbiCoder.defaultAbiCoder();
    const dummyHash = ethers.keccak256(
      encoder.encode(["string"], ["dummyHash"]),
    );
    const dummySignature = solidityPacked(
      ["uint256", "uint256"],
      blsSigner.sign(dummyHash),
    );

    const userOpCallData = safeBlsPlugin.interface.encodeFunctionData(
      "execTransaction",
      [recipientAddress, transferAmount, "0x00"],
    );

    const { initCode, deployedAddress } = await createInitCode(
      admin,
      owner,
      safeBlsPlugin,
      safeSingleton,
      safeProxyFactory,
    );

    const unsignedUserOperation = await createUnsignedUserOperation(
      provider,
      bundlerProvider,
      deployedAddress,
      initCode,
      userOpCallData,
      entryPointAddress,
      dummySignature,
    );

    const userOpHash = getUserOpHash(
      unsignedUserOperation,
      entryPointAddress,
      Number((await provider.getNetwork()).chainId),
    );

    // Create BLS signature of the userOpHash
    const userOpSignature = blsSigner.sign(userOpHash);

    const userOperation = {
      ...unsignedUserOperation,
      signature: solidityPacked(["uint256", "uint256"], userOpSignature),
    };

    const recipientBalanceBefore = await provider.getBalance(recipientAddress);

    // TODO: #138 Send via bundler once BLS lib is 4337 compatible
    // await sendUserOpAndWait(userOperation, entryPointAddress, bundlerProvider);

    const entryPoint = EntryPoint__factory.connect(entryPointAddress, admin);

    await receiptOf(
      entryPoint
        .connect(admin)
        .handleOps([userOperation], await admin.getAddress()),
    );
    await entryPoint.getUserOpHash(userOperation);

    const recipientBalanceAfter = await provider.getBalance(recipientAddress);
    const expectedRecipientBalance = recipientBalanceBefore + transferAmount;

    expect(recipientBalanceAfter).to.equal(expectedRecipientBalance);
  });
});

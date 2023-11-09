import { expect } from "chai";
import { ethers, getBytes, keccak256, solidityPacked } from "ethers";
import { signer as hubbleBlsSigner } from "@thehubbleproject/bls";
import { getUserOpHash } from "@account-abstraction/utils";
import {
  EntryPoint__factory,
  SafeBlsPlugin__factory,
} from "../../typechain-types";
import { setupTests } from "./utils/setupTests";
import receiptOf from "./utils/receiptOf";
import {
  generateInitCodeAndAddress,
  createUnsignedUserOperation,
} from "./utils/createUserOp";
import { getSigners } from "./utils/getSigners";

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
      ssf,
      safeProxyFactory,
      safeSingleton,
    } = await setupTests();

    // Deploy bls plugin
    const domain = getBytes(keccak256(Buffer.from("eip4337.bls.domain")));
    const signerFactory = await hubbleBlsSigner.BlsSignerFactory.new();
    const blsSigner = signerFactory.getSigner(domain, BLS_PRIVATE_KEY);

    const safeBlsPlugin = await ssf.connectOrDeploy(SafeBlsPlugin__factory, [
      entryPointAddress,
      blsSigner.pubkey,
    ]);

    // Construct userOp
    const [, , signer] = getSigners();

    const recipientAddress = await signer.getAddress();
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

    const { initCode, deployedAddress } = await generateInitCodeAndAddress(
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

    const userOpSignature = blsSigner.sign(userOpHash);

    const userOperation = {
      ...unsignedUserOperation,
      signature: solidityPacked(["uint256", "uint256"], userOpSignature),
    };

    const recipientBalanceBefore = await provider.getBalance(recipientAddress);

    // TODO: #138 Send via bundler once BLS lib is 4337 compatible
    // await sendUserOpAndWait(userOperation, entryPointAddress, bundlerProvider);

    const entryPoint = EntryPoint__factory.connect(entryPointAddress, admin);

    // Send userOp
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

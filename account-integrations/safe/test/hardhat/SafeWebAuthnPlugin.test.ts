import { expect } from "chai";
import { ethers, BigNumberish } from "ethers";
import sendUserOpAndWait from "./utils/sendUserOpAndWait";
import { setupTests } from "./utils/setupTests";
import { SafeWebAuthnPlugin__factory } from "../../typechain-types";
import {
  generateInitCodeAndAddress,
  createUnsignedUserOperation,
} from "./utils/createUserOp";
import { getSigners } from "./utils/getSigners";

describe("SafeWebAuthnPlugin", () => {
  const getPublicKeyAndSignature = () => {
    const publicKey: [BigNumberish, BigNumberish] = [
      BigInt(
        "114874632398302156264159990279427641021947882640101801130664833947273521181002",
      ),
      BigInt(
        "32136952818958550240756825111900051564117520891182470183735244184006536587423",
      ),
    ];

    const authenticatorData =
      "0xf8e4b678e1c62f7355266eaa4dc1148573440937063a46d848da1e25babbd20b010000004d";
    const authenticatorDataFlagMask = "0x01";
    const clientData =
      "0x7b2274797065223a22776562617574686e2e676574222c226368616c6c656e6765223a224e546f2d3161424547526e78786a6d6b61544865687972444e5833697a6c7169316f776d4f643955474a30222c226f726967696e223a2268747470733a2f2f66726573682e6c65646765722e636f6d222c2263726f73734f726967696e223a66616c73657d";
    const clientChallenge =
      "0x353a3ed5a0441919f1c639a46931de872ac3357de2ce5aa2d68c2639df54189d";
    const clientChallengeDataOffset = 36;
    const signature: [BigNumberish, BigNumberish] = [
      BigInt(
        "45847212378479006099766816358861726414873720355505495069909394794949093093607",
      ),
      BigInt(
        "55835259151215769394881684156457977412783812617123006733908193526332337539398",
      ),
    ];

    const encoder = new ethers.AbiCoder();
    const userOpSignature = encoder.encode(
      [
        "bytes",
        "bytes1",
        "bytes",
        "bytes32",
        "uint256",
        "uint256[2]",
        "uint256[2]",
      ],
      [
        authenticatorData,
        authenticatorDataFlagMask,
        clientData,
        clientChallenge,
        clientChallengeDataOffset,
        signature,
        publicKey,
      ],
    );

    return { publicKey, userOpSignature };
  };

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
    const { publicKey, userOpSignature } = getPublicKeyAndSignature();

    // Deploy webauthn plugin
    const safeWebAuthnPlugin = await ssf.connectOrDeploy(
      SafeWebAuthnPlugin__factory,
      [entryPointAddress, publicKey],
    );

    // Construct userOp
    const [, , signer] = getSigners();

    const recipientAddress = await signer.getAddress();
    const transferAmount = ethers.parseEther("1");

    const userOpCallData = safeWebAuthnPlugin.interface.encodeFunctionData(
      "execTransaction",
      [recipientAddress, transferAmount, "0x00"],
    );

    const { initCode, deployedAddress } = await generateInitCodeAndAddress(
      admin,
      owner,
      safeWebAuthnPlugin,
      safeSingleton,
      safeProxyFactory,
    );

    const recipientBalanceBefore = await provider.getBalance(recipientAddress);

    const unsignedUserOperation = await createUnsignedUserOperation(
      provider,
      bundlerProvider,
      deployedAddress,
      initCode,
      userOpCallData,
      entryPointAddress,
      userOpSignature,
    );

    // Send userOp
    await sendUserOpAndWait(
      unsignedUserOperation,
      entryPointAddress,
      bundlerProvider,
    );

    const recipientBalanceAfter = await provider.getBalance(recipientAddress);

    const expectedRecipientBalance = recipientBalanceBefore + transferAmount;
    expect(recipientBalanceAfter).to.equal(expectedRecipientBalance);
  });
});

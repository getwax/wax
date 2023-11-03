import { expect } from "chai";
import { getBytes, ethers } from "ethers";
import { getUserOpHash } from "@account-abstraction/utils";
import {
  AddressRegistry__factory,
  FallbackDecompressor__factory,
  SafeCompressionFactory__factory,
  SafeCompressionPlugin__factory,
} from "../../typechain-types";
import sendUserOpAndWait from "./utils/sendUserOpAndWait";
import receiptOf from "./utils/receiptOf";
import SafeSingletonFactory from "./utils/SafeSingletonFactory";
import { createUnsignedUserOperation, setupTests } from "./utils/setupTests";

describe("SafeCompressionPlugin", () => {
  it("should pass the ERC4337 validation", async () => {
    const {
      bundlerProvider,
      provider,
      admin,
      owner,
      entryPointAddress,
      safeSingleton,
    } = await setupTests();

    const ssf = await SafeSingletonFactory.init(admin);

    const safeCompressionFactory = await ssf.connectOrDeploy(
      SafeCompressionFactory__factory,
      [],
    );
    await safeCompressionFactory.waitForDeployment();

    const addressRegistry = await ssf.connectOrDeploy(
      AddressRegistry__factory,
      [],
    );

    const fallbackDecompressor = await ssf.connectOrDeploy(
      FallbackDecompressor__factory,
      [await addressRegistry.getAddress()],
    );

    const createArgs = [
      safeSingleton,
      entryPointAddress,
      await fallbackDecompressor.getAddress(),
      owner.address,
      0,
    ] satisfies Parameters<typeof safeCompressionFactory.create.staticCall>;

    const accountAddress = await safeCompressionFactory.create.staticCall(
      ...createArgs,
    );

    await receiptOf(safeCompressionFactory.create(...createArgs));

    const compressionAccount = SafeCompressionPlugin__factory.connect(
      accountAddress,
      owner,
    );

    const recipient = new ethers.Wallet(
      "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
    );
    const transferAmount = ethers.parseEther("1");

    const compressedActions = await fallbackDecompressor.compress(
      [
        {
          to: recipient.address,
          value: transferAmount,
          data: "0x",
        },
      ],
      [],
    );
    // TODO: why is this needed to prevent "nonce too low" error

    const userOpCallData = compressionAccount.interface.encodeFunctionData(
      "decompressAndPerform",
      [compressedActions],
    );
    const dummySignature = await owner.signMessage("dummy sig");

    // Native tokens for the pre-fund 💸
    await receiptOf(
      admin.sendTransaction({
        to: accountAddress,
        value: ethers.parseEther("10"), // TODO: increasing this from 1 to 10 prevents error of balance not updating for assertion??????
      }),
    );

    const unsignedUserOperation = await createUnsignedUserOperation(
      provider,
      bundlerProvider,
      accountAddress,
      userOpCallData,
      entryPointAddress,
      dummySignature,
    );

    // const resolvedUserOp = await resolveProperties(unsignedUserOperation);
    const userOpHash = getUserOpHash(
      unsignedUserOperation,
      entryPointAddress,
      Number((await provider.getNetwork()).chainId),
    );
    const userOpSignature = await owner.signMessage(getBytes(userOpHash));

    const userOperation = {
      ...unsignedUserOperation,
      signature: userOpSignature,
    };

    const recipientBalanceBefore = await provider.getBalance(recipient.address);

    await sendUserOpAndWait(userOperation, entryPointAddress, bundlerProvider);

    const recipientBalanceAfter = await provider.getBalance(recipient.address);

    const expectedRecipientBalance = recipientBalanceBefore + transferAmount;
    expect(recipientBalanceAfter).to.equal(expectedRecipientBalance);
  });
});

import { expect } from "chai";
import { ethers } from "ethers";
import {
  AddressRegistry__factory,
  FallbackDecompressor__factory,
  SafeCompressionFactory__factory,
  SafeCompressionPlugin__factory,
} from "../../typechain-types";
import receiptOf from "./utils/receiptOf";
import { setupTests } from "./utils/setupTests";
import { createAndSendUserOpWithEcdsaSig } from "./utils/createUserOp";

describe("SafeCompressionPlugin", () => {
  it("should pass the ERC4337 validation", async () => {
    const {
      bundlerProvider,
      provider,
      admin,
      owner,
      entryPointAddress,
      ssf,
      safeSingleton,
    } = await setupTests();

    // Deploy compression contracts and compression plugin
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

    // construct userOp
    const compressionAccount = SafeCompressionPlugin__factory.connect(
      accountAddress,
      owner,
    );

    const recipient = ethers.Wallet.createRandom();
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

    const userOpCallData = compressionAccount.interface.encodeFunctionData(
      "decompressAndPerform",
      [compressedActions],
    );

    // Note: initCode is not used because we need to create both the safe
    // proxy and the plugin, and 4337 currently only allows one contract
    // creation in this step. Since we need an extra step anyway, it's simpler
    // to do the whole create outside of 4337.
    const initCode = "0x";

    const dummySignature = await owner.signMessage("dummy sig");

    // Native tokens for the pre-fund
    await receiptOf(
      admin.sendTransaction({
        to: accountAddress,
        value: ethers.parseEther("10"),
      }),
    );

    const recipientBalanceBefore = await provider.getBalance(recipient.address);

    // send userOp
    await createAndSendUserOpWithEcdsaSig(
      provider,
      bundlerProvider,
      owner,
      accountAddress,
      initCode,
      userOpCallData,
      entryPointAddress,
      dummySignature,
    );

    const recipientBalanceAfter = await provider.getBalance(recipient.address);

    const expectedRecipientBalance = recipientBalanceBefore + transferAmount;
    expect(recipientBalanceAfter).to.equal(expectedRecipientBalance);
  });
});

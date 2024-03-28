import { expect } from "chai";
import { ethers, solidityPacked } from "ethers";
import {
  AddressRegistry__factory,
  EntryPoint__factory,
  FallbackDecompressor__factory,
  SafeCompressionFactory__factory,
  SafeCompressionPlugin__factory,
} from "../../typechain-types";
import receiptOf from "./utils/receiptOf";
import { setupTests } from "./utils/setupTests";
import { createUserOperation } from "./utils/createUserOp";
import setupBls from "./utils/setupBls";
import getBlsUserOpHash from "./utils/getBlsUserOpHash";
import { packUserOp } from "./utils/userOpUtils";

const BLS_PRIVATE_KEY =
  "0xdbe3d601b1b25c42c50015a87855fdce00ea9b3a7e33c92d31c69aeb70708e08";

describe("SafeCompressionPlugin", () => {
  it("should pass the ERC4337 validation", async () => {
    const {
      bundlerProvider,
      provider,
      admin,
      owner,
      entryPointAddress,
      deployer,
      safeSingleton,
    } = await setupTests();

    const entryPoint = EntryPoint__factory.connect(entryPointAddress, admin);

    const { blsSignatureAggregator, blsSigner } = await setupBls(
      deployer,
      entryPointAddress,
      BLS_PRIVATE_KEY,
    );

    // Deploy compression contracts and compression plugin
    const safeCompressionFactory = await deployer.connectOrDeploy(
      SafeCompressionFactory__factory,
      [],
    );

    const addressRegistry = await deployer.connectOrDeploy(
      AddressRegistry__factory,
      [],
    );

    const fallbackDecompressor = await deployer.connectOrDeploy(
      FallbackDecompressor__factory,
      [await addressRegistry.getAddress()],
    );

    const createArgs = [
      safeSingleton,
      entryPointAddress,
      await blsSignatureAggregator.getAddress(),
      blsSigner.pubkey,
      await fallbackDecompressor.getAddress(),
      await owner.getAddress(),
      0,
    ] satisfies Parameters<typeof safeCompressionFactory.create.staticCall>;

    const accountAddress = await safeCompressionFactory.create.staticCall(
      ...createArgs,
    );

    await receiptOf(safeCompressionFactory.create(...createArgs));

    // construct userOp
    const compressionAccount =
      SafeCompressionPlugin__factory.connect(accountAddress);

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

    // Note: factoryParams is not used because we need to create both the safe
    // proxy and the plugin, and 4337 currently only allows one contract
    // creation in this step. Since we need an extra step anyway, it's simpler
    // to do the whole create outside of 4337.
    const factoryParams = {
      factory: "0x",
      factoryData: "0x",
    };

    // Native tokens for the pre-fund
    await receiptOf(
      admin.sendTransaction({
        to: accountAddress,
        value: ethers.parseEther("10"),
      }),
    );

    const recipientBalanceBefore = await provider.getBalance(recipient.address);

    const unsignedUserOperation = await createUserOperation(
      provider,
      bundlerProvider,
      accountAddress,
      factoryParams,
      userOpCallData,
      entryPointAddress,
      "0x",
    );
    const packedUserOperation = packUserOp(unsignedUserOperation);

    const blsUserOpHash = getBlsUserOpHash(
      (await provider.getNetwork()).chainId,
      await blsSignatureAggregator.getAddress(),
      blsSigner.pubkey,
      packedUserOperation,
      entryPointAddress,
    );

    const aggReportedUserOpHash =
      await blsSignatureAggregator.getUserOpHash(packedUserOperation);

    expect(blsUserOpHash).to.equal(aggReportedUserOpHash);

    const userOperation = {
      ...packedUserOperation,
      signature: solidityPacked(
        ["uint256[2]"],
        [blsSigner.sign(blsUserOpHash)],
      ),
    };

    // TODO: Ideally we would use the bundler here via `sendUserOpAndWait`.
    // However, eth-infinitism's bundler doesn't appear to have any support for
    // sending aggregated bundles, since handleAggregatedOps does not appear in
    // its code.

    // Send userOp
    const receipt = await receiptOf(
      entryPoint.connect(admin).handleAggregatedOps(
        [
          {
            userOps: [{ ...userOperation, signature: "0x" }],
            aggregator: await blsSignatureAggregator.getAddress(),
            signature: userOperation.signature,
          },
        ],
        await admin.getAddress(),
      ),
    );

    const recipientBalanceAfter = await provider.getBalance(
      recipient.address,
      receipt.blockNumber,
    );

    const expectedRecipientBalance = recipientBalanceBefore + transferAmount;
    expect(recipientBalanceAfter).to.equal(expectedRecipientBalance);
  });
});

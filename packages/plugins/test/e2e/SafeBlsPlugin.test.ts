import { expect } from "chai";
import { ethers, solidityPacked } from "ethers";
import {
  EntryPoint__factory,
  SafeBlsPlugin__factory,
} from "../../typechain-types";
import { setupTests } from "./utils/setupTests";
import receiptOf from "./utils/receiptOf";
import {
  generateFactoryParamsAndAddress,
  createUserOperation,
} from "./utils/createUserOp";
import { getSigners } from "./utils/getSigners";
import getBlsUserOpHash from "./utils/getBlsUserOpHash";
import appendKeyToInitCode from "./utils/appendKeyToInitCode";
import setupBls from "./utils/setupBls";
import { packUserOp } from "./utils/userOpUtils";

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
      deployer,
      safeProxyFactory,
      safeSingleton,
    } = await setupTests();

    const entryPoint = EntryPoint__factory.connect(entryPointAddress, admin);

    const { blsSignatureAggregator, blsSigner } = await setupBls(
      deployer,
      entryPointAddress,
      BLS_PRIVATE_KEY,
    );

    const safeBlsPlugin = await deployer.connectOrDeploy(
      SafeBlsPlugin__factory,
      [
        entryPointAddress,
        await blsSignatureAggregator.getAddress(),
        blsSigner.pubkey,
      ],
    );

    const [, , recipient] = getSigners();
    const recipientAddress = await recipient.getAddress();

    const transferAmount = ethers.parseEther("1");

    const userOpCallData = safeBlsPlugin.interface.encodeFunctionData(
      "execTransaction",
      [recipientAddress, transferAmount, "0x"],
    );

    let { factoryParams, deployedAddress } =
      await generateFactoryParamsAndAddress(
        admin,
        owner,
        safeBlsPlugin,
        safeSingleton,
        safeProxyFactory,
      );

    factoryParams.factoryData = appendKeyToInitCode(
      factoryParams.factoryData,
      blsSigner.pubkey,
    );

    const unsignedUserOperation = await createUserOperation(
      provider,
      bundlerProvider,
      deployedAddress,
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

    await blsSignatureAggregator.validateUserOpSignature(userOperation);

    const recipientBalanceBefore = await provider.getBalance(recipientAddress);

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

    await entryPoint.getUserOpHash(userOperation);

    const recipientBalanceAfter = await provider.getBalance(
      recipientAddress,
      receipt.blockNumber,
    );

    const expectedRecipientBalance = recipientBalanceBefore + transferAmount;

    expect(recipientBalanceAfter).to.equal(expectedRecipientBalance);
  });
});

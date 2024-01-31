import { expect } from "chai";
import { ethers, getBytes, keccak256, solidityPacked } from "ethers";
import { signer as hubbleBlsSigner } from "@thehubbleproject/bls";
import {
  BLSOpen__factory,
  BLSSignatureAggregator__factory,
  EntryPoint__factory,
  SafeBlsPlugin__factory,
} from "../../typechain-types";
import { setupTests } from "./utils/setupTests";
import receiptOf from "./utils/receiptOf";
import {
  generateInitCodeAndAddress,
  createUserOperation,
} from "./utils/createUserOp";
import { getSigners } from "./utils/getSigners";
import DeterministicDeployer from "./utils/DeterministicDeployer";
import getBlsUserOpHash from "./utils/getBlsUserOpHash";

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

    // Deploy bls plugin
    const domain = getBytes(keccak256(Buffer.from("eip4337.bls.domain")));
    const signerFactory = await hubbleBlsSigner.BlsSignerFactory.new();
    const blsSigner = signerFactory.getSigner(domain, BLS_PRIVATE_KEY);

    const blsOpen = await deployer.connectOrDeploy(BLSOpen__factory, []);

    const blsSignatureAggregator = await deployer.connectOrDeploy(
      DeterministicDeployer.link(BLSSignatureAggregator__factory, [
        {
          "lib/account-abstraction/contracts/samples/bls/lib/BLSOpen.sol:BLSOpen":
            await blsOpen.getAddress(),
        },
      ]),
      [],
    );

    // TODO: Revise aggregator staking
    await receiptOf(
      blsSignatureAggregator.addStake(entryPointAddress, 100n * 86_400n, {
        value: ethers.parseEther("1"),
      }),
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

    let { initCode, deployedAddress } = await generateInitCodeAndAddress(
      admin,
      owner,
      safeBlsPlugin,
      safeSingleton,
      safeProxyFactory,
    );

    // TODO: Explain (and revise?)
    initCode += blsSigner.pubkey.map((w) => w.slice(2)).join("");

    const unsignedUserOperation = await createUserOperation(
      provider,
      bundlerProvider,
      deployedAddress,
      initCode,
      userOpCallData,
      entryPointAddress,
      "0x",
    );

    const blsUserOpHash = getBlsUserOpHash(
      (await provider.getNetwork()).chainId,
      await blsSignatureAggregator.getAddress(),
      blsSigner.pubkey,
      unsignedUserOperation,
    );

    const aggReportedUserOpHash = await blsSignatureAggregator.getUserOpHash(
      unsignedUserOperation,
    );

    expect(blsUserOpHash).to.equal(aggReportedUserOpHash);

    const userOperation = {
      ...unsignedUserOperation,
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

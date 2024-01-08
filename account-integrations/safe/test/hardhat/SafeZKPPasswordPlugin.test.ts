import { getUserOpHash } from "@account-abstraction/utils";
import { ERC4337ZKPPasswordClient } from "@getwax/circuits";
import { expect } from "chai";
import { resolveProperties, ethers } from "ethers";
import sendUserOpAndWait from "./utils/sendUserOpAndWait";
import receiptOf from "./utils/receiptOf";
import {
  MockGroth16Verifier__factory,
  SafeZKPPasswordFactory__factory,
  SafeZKPPasswordPlugin__factory,
} from "../../typechain-types";
import { setupTests } from "./utils/setupTests";
import { createUserOperation } from "./utils/createUserOp";

describe("SafeZKPPasswordPlugin", () => {
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

    const zkpClient = await ERC4337ZKPPasswordClient.create();

    // Deploy zk password plugin
    const safeZKPPasswordFactory = await ssf.connectOrDeploy(
      SafeZKPPasswordFactory__factory,
      [],
    );

    const signer = await provider.getSigner();
    // TODO (merge-ok) Use real verifier from zkp dir
    // https://github.com/getwax/wax/issues/143
    const groth16Verifier = await new MockGroth16Verifier__factory(
      signer,
    ).deploy();

    const createArgs = [
      safeSingleton,
      entryPointAddress,
      owner.address,
      0,
      groth16Verifier,
    ] satisfies Parameters<typeof safeZKPPasswordFactory.create.staticCall>;

    const accountAddress = await safeZKPPasswordFactory.create.staticCall(
      ...createArgs,
    );

    await receiptOf(safeZKPPasswordFactory.create(...createArgs));

    // Native tokens for the pre-fund
    await receiptOf(
      admin.sendTransaction({
        to: accountAddress,
        value: ethers.parseEther("100"),
      }),
    );

    // Construct userOp
    const to = "0x42ef9B061d2B8416387FaA738Af7251668b0b142"; // Random address
    const value = ethers.parseEther("1");
    const data = "0x";

    const userOpCallData =
      SafeZKPPasswordPlugin__factory.createInterface().encodeFunctionData(
        "execTransaction",
        [to, value, data],
      );

    const encoder = ethers.AbiCoder.defaultAbiCoder();
    const dummySignature = encoder.encode(
      ["uint256[2]", "uint256[2][2]", "uint256[2]"],
      [
        [0, 0],
        [
          [0, 0],
          [0, 0],
        ],
        [0, 0],
      ],
    );

    // Note: initCode is not used because we need to create both the safe
    // proxy and the plugin, and 4337 currently only allows one contract
    // creation in this step. Since we need an extra step anyway, it's simpler
    // to do the whole create outside of 4337.
    const initCode = "0x";

    const unsignedUserOperation = await createUserOperation(
      provider,
      bundlerProvider,
      accountAddress,
      initCode,
      userOpCallData,
      entryPointAddress,
      dummySignature,
    );

    const resolvedUserOp = await resolveProperties(unsignedUserOperation);
    const userOpHash = getUserOpHash(
      resolvedUserOp,
      entryPointAddress,
      Number((await provider.getNetwork()).chainId),
    );

    const emojiPassword = "👻🎃🕸🦇🕷🪦";
    const { signature } = await zkpClient.proveUserOp(
      emojiPassword,
      userOpHash,
    );

    const userOp = {
      ...unsignedUserOperation,
      signature,
    };

    const recipientBalanceBefore = await provider.getBalance(to);

    // Send userOp
    await sendUserOpAndWait(userOp, entryPointAddress, bundlerProvider);

    const recipientBalanceAfter = await provider.getBalance(to);

    const expectedRecipientBalance = recipientBalanceBefore + value;
    expect(recipientBalanceAfter).to.equal(expectedRecipientBalance);
  });
});

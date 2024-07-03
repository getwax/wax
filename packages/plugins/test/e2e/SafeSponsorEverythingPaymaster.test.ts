import { expect } from "chai";
import { ethers } from "ethers";
import {
  SafeECDSAFactory__factory,
  SafeECDSAPlugin__factory,
  SponsorEverythingPaymaster__factory,
  EntryPoint__factory
} from "../../typechain-types";
import receiptOf from "./utils/receiptOf";
import { setupTests } from "./utils/setupTests";
import { createAndSendUserOpWithEcdsaSig } from "./utils/createUserOp";

const oneEther = ethers.parseEther("1");

describe("SafeSponsorEverythingPaymasterPlugin", () => {
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

    // Deploy paymaster.
    const paymaster = await deployer.connectOrDeploy(
      SponsorEverythingPaymaster__factory,
      [entryPointAddress],
    );
    const paymasterAddress = await paymaster.getAddress();
    
    // Paymaster deposits.
    await paymaster.deposit({ value: ethers.parseEther("1") })

    const recipient = ethers.Wallet.createRandom();
    const transferAmount = ethers.parseEther("1");
    const dummySignature = await owner.signMessage("dummy sig");

    // Deploy ecdsa plugin
    const safeECDSAFactory = await deployer.connectOrDeploy(
      SafeECDSAFactory__factory,
      [],
    );

    const createArgs = [
      safeSingleton,
      entryPointAddress,
      await owner.getAddress(),
      0,
    ] satisfies Parameters<typeof safeECDSAFactory.create.staticCall>;

    const accountAddress = await safeECDSAFactory.create.staticCall(
      ...createArgs,
    );

    await receiptOf(safeECDSAFactory.create(...createArgs));

    const safeEcdsaPlugin = SafeECDSAPlugin__factory.connect(
      accountAddress,
      owner,
    );

    // Native tokens for the pre-fund
    await receiptOf(
      admin.sendTransaction({
        to: accountAddress,
        value: ethers.parseEther("1"),
      }),
    );

    // Construct userOp
    const userOpCallData = safeEcdsaPlugin.interface.encodeFunctionData(
      "execTransaction",
      [recipient.address, transferAmount, "0x00"],
    );

    // Note: factoryParams is not used because we need to create both the safe
    // proxy and the plugin, and 4337 currently only allows one contract
    // creation in this step. Since we need an extra step anyway, it's simpler
    // to do the whole create outside of 4337.
    const factoryParams = {
      factory: "0x",
      factoryData: "0x",
    };

    // Check paymaster balances before and after sending UserOp.
    const entrypoint = EntryPoint__factory.connect(entryPointAddress, provider)
    const paymasterBalanceBefore = await entrypoint.balanceOf(paymasterAddress)

    // Send userOp
    await createAndSendUserOpWithEcdsaSig(
      provider,
      bundlerProvider,
      owner,
      accountAddress,
      factoryParams,
      userOpCallData,
      entryPointAddress,
      dummySignature,
      paymasterAddress,
      3e5,
      "0x"
    );

    const paymasterBalanceAfter = await entrypoint.balanceOf(paymasterAddress)

    expect(paymasterBalanceBefore).greaterThan(paymasterBalanceAfter)
    expect(await provider.getBalance(recipient.address)).to.equal(oneEther);
  });
});

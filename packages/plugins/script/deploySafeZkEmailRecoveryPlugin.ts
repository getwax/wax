import hre from "hardhat";
import { SafeZkEmailRecoveryPlugin__factory } from "../typechain-types";

// base sepolia
// TODO make configurable
const emailAuthContracts = {
  verifier: "0xEdC642bbaD91E21cCE6cd436Fdc6F040FD0fF998",
  dkimRegistry: "0xC83256CCf7B94d310e49edA05077899ca036eb78",
  emailAuthImpl: "0x1C76Aa365c17B40c7E944DcCdE4dC6e6D2A7b748",
};

async function deploySafeZkEmailRecoveryPlugin() {
  console.log("Deploying SafeZkEmailRecoveryPlugin");

  const [firstSigner] = await hre.ethers.getSigners();

  console.log(`Using ${await firstSigner.getAddress()} as signer/deployer`);

  const recoveryPlugin = await new SafeZkEmailRecoveryPlugin__factory()
    .connect(firstSigner)
    .deploy(
      emailAuthContracts.verifier,
      emailAuthContracts.dkimRegistry,
      emailAuthContracts.emailAuthImpl,
    );
  await recoveryPlugin.waitForDeployment();

  console.log(
    `SafeZkEmailRecoveryPlugin deployed to ${await recoveryPlugin.getAddress()}`,
  );
}

deploySafeZkEmailRecoveryPlugin().catch((error: Error) => {
  console.error(error);
  process.exitCode = 1;
});

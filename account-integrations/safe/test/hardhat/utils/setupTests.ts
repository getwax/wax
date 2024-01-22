import { ethers, NonceManager } from "ethers";
import {
  SafeProxyFactory__factory,
  Safe__factory,
} from "../../../typechain-types";
import DeterministicDeployer from "./DeterministicDeployer";
import receiptOf from "./receiptOf";
import makeDevFaster from "./makeDevFaster";
import { getSigners } from "./getSigners";

export async function setupTests() {
  const { BUNDLER_URL, NODE_URL } = process.env;

  if (!BUNDLER_URL) {
    throw new Error(
      "missing bundler env var BUNDLER_URL. Make sure you have copied or created a .env file",
    );
  }
  if (!NODE_URL) {
    throw new Error(
      "missing bundler env var NODE_URL. Make sure you have copied or created a .env file",
    );
  }

  const bundlerProvider = new ethers.JsonRpcProvider(BUNDLER_URL);
  const provider = new ethers.JsonRpcProvider(NODE_URL);
  await makeDevFaster(provider);

  const [, signer, otherSigner] = getSigners();
  const admin = new NonceManager(signer.connect(provider));
  const owner = new NonceManager(ethers.Wallet.createRandom(provider));
  const otherAccount = new NonceManager(otherSigner.connect(provider));

  await receiptOf(
    await admin.sendTransaction({
      to: await owner.getAddress(),
      value: ethers.parseEther("1"),
    }),
  );

  const entryPoints = (await bundlerProvider.send(
    "eth_supportedEntryPoints",
    [],
  )) as string[];

  if (entryPoints.length === 0) {
    throw new Error("No entry points found");
  }

  const entryPointAddress = entryPoints[0];

  const safeDeployer = await DeterministicDeployer.initSafeVersion(admin);

  const safeProxyFactory = await safeDeployer.connectOrDeploy(
    SafeProxyFactory__factory,
    [],
  );
  const safeSingleton = await safeDeployer.connectOrDeploy(Safe__factory, []);

  const deployer = await DeterministicDeployer.init(admin);

  return {
    bundlerProvider,
    provider,
    admin,
    owner,
    otherAccount,
    entryPointAddress,
    deployer,
    safeProxyFactory,
    safeSingleton,
  };
}

import { ethers } from "ethers";
import DeterministicDeployer from "../lib-ts/deterministic-deployer/DeterministicDeployer";
import {
  SimulateTxAccessor__factory,
  SafeProxyFactory__factory,
  CompatibilityFallbackHandler__factory,
  CreateCall__factory,
  MultiSend__factory,
  MultiSendCallOnly__factory,
  SignMessageLib__factory,
  SafeL2__factory,
  Safe__factory,
  EntryPoint__factory,
  BLSSignatureAggregator__factory,
  BLSOpen__factory,
} from "../typechain-types";
import makeDevFaster from "../test/e2e/utils/makeDevFaster";
import { TokenCallbackHandler__factory } from "../typechain-types/factories/lib/safe-contracts/contracts/handler/TokenCallbackHandler__factory";
import bundlerConfig from "./../config/bundler.config.json";

async function deploy() {
  const { NODE_URL, MNEMONIC } = process.env;
  const provider = new ethers.JsonRpcProvider(NODE_URL);
  await makeDevFaster(provider);
  const hdNode = ethers.HDNodeWallet.fromPhrase(MNEMONIC!);
  const wallet = new ethers.Wallet(hdNode.privateKey, provider);

  const deployer = await DeterministicDeployer.init(wallet);

  const contractFactories = [
    SimulateTxAccessor__factory,
    TokenCallbackHandler__factory,
    CompatibilityFallbackHandler__factory,
    CreateCall__factory,
    EntryPoint__factory,
    MultiSend__factory,
    MultiSendCallOnly__factory,
    SignMessageLib__factory,
    BLSOpen__factory,
  ];

  for (const contractFactory of contractFactories) {
    const contract = await deployer.connectOrDeploy(contractFactory, []);

    const contractName = contractFactory.name.split("_")[0];
    console.log(`deployed ${contractName} to ${await contract.getAddress()}`);
  }

  const blsSignatureAggregatorFactory = DeterministicDeployer.link(
    BLSSignatureAggregator__factory,
    [
      {
        "lib/account-abstraction/contracts/samples/bls/lib/BLSOpen.sol:BLSOpen":
          deployer.calculateAddress(BLSOpen__factory, []),
      },
    ],
  );
  const blsSignatureAggregator = await deployer.connectOrDeploy(
    blsSignatureAggregatorFactory,
    [bundlerConfig.entryPoint],
  );
  console.log(
    `deployed ${
      BLSSignatureAggregator__factory.name.split("_")[0]
    } to ${await blsSignatureAggregator.getAddress()}`,
  );

  const safeDeployer = await DeterministicDeployer.initSafeVersion(wallet);

  const safeContractFactories = [
    SafeProxyFactory__factory,
    SafeL2__factory,
    Safe__factory,
  ];

  for (const contractFactory of safeContractFactories) {
    const contract = await safeDeployer.connectOrDeploy(contractFactory, []);

    const contractName = contractFactory.name.split("_")[0];
    console.log(`deployed ${contractName} to ${await contract.getAddress()}`);
  }
}

deploy().catch((error: Error) => {
  console.error(error);
  process.exitCode = 1;
});

import { ethers } from "ethers";
import DeterministicDeployer from "../test/hardhat/utils/DeterministicDeployer";
import {
  SimulateTxAccessor__factory,
  SafeProxyFactory__factory,
  TokenCallbackHandler__factory,
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
import makeDevFaster from "../test/hardhat/utils/makeDevFaster";

async function deploy() {
  const { NODE_URL, MNEMONIC } = process.env;
  const provider = new ethers.JsonRpcProvider(NODE_URL);
  await makeDevFaster(provider);
  const hdNode = ethers.HDNodeWallet.fromPhrase(MNEMONIC!);
  const wallet = new ethers.Wallet(hdNode.privateKey, provider);

  const deployer = await DeterministicDeployer.init(wallet);

  const contractFactories = [
    SimulateTxAccessor__factory,
    SafeProxyFactory__factory,
    TokenCallbackHandler__factory,
    CompatibilityFallbackHandler__factory,
    CreateCall__factory,
    EntryPoint__factory,
    MultiSend__factory,
    MultiSendCallOnly__factory,
    SignMessageLib__factory,
    SafeL2__factory,
    Safe__factory,
    BLSOpen__factory,
    DeterministicDeployer.link(BLSSignatureAggregator__factory, [
      {
        "lib/account-abstraction/contracts/samples/bls/lib/BLSOpen.sol:BLSOpen":
          deployer.calculateAddress(BLSOpen__factory, []),
      },
    ]),
  ];

  for (const contractFactory of contractFactories) {
    const contract = await deployer.connectOrDeploy(contractFactory, []);

    const contractName = contractFactory.name.split("_")[0];
    console.log(`deployed ${contractName} to ${await contract.getAddress()}`);
  }
}

deploy().catch((error: Error) => {
  console.error(error);
  process.exitCode = 1;
});

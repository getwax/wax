import { ethers } from "ethers";
import DeterministicDeployer from "../lib-ts/deterministic-deployer/DeterministicDeployer";
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
  HandleOpsCaller__factory,
  HandleAggregatedOpsCaller__factory,
  AddressRegistry__factory,
} from "../typechain-types";
import makeDevFaster from "../test/e2e/utils/makeDevFaster";

async function deploy() {
  const { NODE_URL, MNEMONIC } = process.env;
  const provider = new ethers.JsonRpcProvider(NODE_URL);
  await makeDevFaster(provider);
  const hdNode = ethers.HDNodeWallet.fromPhrase(MNEMONIC!);
  const wallet = new ethers.Wallet(hdNode.privateKey, provider);

  const deployer = await DeterministicDeployer.init(wallet);

  const linkedAggregator = DeterministicDeployer.link(
    BLSSignatureAggregator__factory,
    [
      {
        "lib/account-abstraction/contracts/samples/bls/lib/BLSOpen.sol:BLSOpen":
          deployer.calculateAddress(BLSOpen__factory, []),
      },
    ],
  );

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
    linkedAggregator,
    AddressRegistry__factory,
  ];

  for (const contractFactory of contractFactories) {
    const contract = await deployer.connectOrDeploy(contractFactory, []);

    const contractName = contractFactory.name.split("_")[0];
    console.log(`deployed ${contractName} to ${await contract.getAddress()}`);
  }

  const handleOpsCaller = await deployer.connectOrDeploy(
    HandleOpsCaller__factory,
    [
      deployer.calculateAddress(EntryPoint__factory, []),
      testAbsentAddress,
      deployer.calculateAddress(AddressRegistry__factory, []),
    ],
  );

  console.log(
    `deployed HandleOpsCaller to ${await handleOpsCaller.getAddress()}`,
  );

  const handleAggregatedOpsCaller = await deployer.connectOrDeploy(
    HandleAggregatedOpsCaller__factory,
    [
      deployer.calculateAddress(EntryPoint__factory, []),
      testAbsentAddress,
      deployer.calculateAddress(linkedAggregator, []),
      deployer.calculateAddress(AddressRegistry__factory, []),
    ],
  );

  console.log(
    `deployed HandleAggregatedOpsCaller to ${await handleAggregatedOpsCaller.getAddress()}`,
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

// 'test '.repeat(11) + 'absent'
const testAbsentAddress = "0xe8250207B79D7396631bb3aE38a7b457261ae0B6";

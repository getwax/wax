import fs from "fs/promises";
import { ethers } from "ethers";
import DeterministicDeployer, {
  ContractFactoryConstructor,
  DeployParams,
} from "../lib-ts/deterministic-deployer/DeterministicDeployer";
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
  HandleOpsCaller__factory,
  HandleAggregatedOpsCaller__factory,
  AddressRegistry__factory,
} from "../typechain-types";
import makeDevFaster from "../test/e2e/utils/makeDevFaster";
import { TokenCallbackHandler__factory } from "../typechain-types/factories/lib/safe-contracts/contracts/handler/TokenCallbackHandler__factory";
import bundlerConfig from "./../config/bundler.config.json";

// 'test '.repeat(11) + 'absent'
const testAbsentAddress = "0xe8250207B79D7396631bb3aE38a7b457261ae0B6";

async function deploy() {
  const { NODE_URL, MNEMONIC } = process.env;
  const provider = new ethers.JsonRpcProvider(NODE_URL);
  await makeDevFaster(provider);
  const hdNode = ethers.HDNodeWallet.fromPhrase(MNEMONIC!);
  const wallet = new ethers.Wallet(hdNode.privateKey, provider);

  const recordingDeployer = await RecordingDeployer.init(wallet);

  const linkedAggregator = DeterministicDeployer.link(
    BLSSignatureAggregator__factory,
    [
      {
        "lib/account-abstraction/contracts/samples/bls/lib/BLSOpen.sol:BLSOpen":
          recordingDeployer.deployer.calculateAddress(BLSOpen__factory, []),
      },
    ],
  );

  const deployments = [
    ["SimulateTxAccessor", SimulateTxAccessor__factory],
    ["TokenCallbackHandler", TokenCallbackHandler__factory],
    ["CompatibilityFallbackHandler", CompatibilityFallbackHandler__factory],
    ["CreateCall", CreateCall__factory],
    ["EntryPoint", EntryPoint__factory],
    ["MultiSend", MultiSend__factory],
    ["MultiSendCallOnly", MultiSendCallOnly__factory],
    ["SignMessageLib", SignMessageLib__factory],
    ["BLSOpen", BLSOpen__factory],
    ["BLSSignatureAggregator", linkedAggregator],
    ["AddressRegistry", AddressRegistry__factory],
  ] as const;

  for (const [name, contractFactory] of deployments) {
    await recordingDeployer.deploy(name, contractFactory, []);
  }

  const handleOpsCaller = await recordingDeployer.deploy(
    "HandleOpsCaller",
    HandleOpsCaller__factory,
    [
      recordingDeployer.deployer.calculateAddress(EntryPoint__factory, []),
      testAbsentAddress,
      recordingDeployer.deployer.calculateAddress(AddressRegistry__factory, []),
    ],
  );

  const handleAggregatedOpsCaller = await recordingDeployer.deploy(
    "HandleAggregatedOpsCaller",
    HandleAggregatedOpsCaller__factory,
    [
      recordingDeployer.deployer.calculateAddress(EntryPoint__factory, []),
      testAbsentAddress,
      recordingDeployer.deployer.calculateAddress(linkedAggregator, []),
      recordingDeployer.deployer.calculateAddress(AddressRegistry__factory, []),
    ],
  );

  void handleOpsCaller;
  void handleAggregatedOpsCaller;

  const safeContractFactories = [
    ["SafeProxyFactory", SafeProxyFactory__factory],
    ["SafeL2", SafeL2__factory],
    ["Safe", Safe__factory],
  ] as const;

  for (const [name, contractFactory] of safeContractFactories) {
    await recordingDeployer.deployWithSafeDeployer(name, contractFactory, []);
  }

  await recordingDeployer.finish();
}

deploy().catch((error: Error) => {
  console.error(error);
  process.exitCode = 1;
});

class RecordingDeployer {
  deployments: Record<string, string> = {};

  private constructor(
    public deployer: DeterministicDeployer,
    public safeDeployer: DeterministicDeployer,
  ) {}

  static async init(wallet: ethers.Wallet): Promise<RecordingDeployer> {
    const deployer = await DeterministicDeployer.init(wallet);
    const safeDeployer = await DeterministicDeployer.initSafeVersion(wallet);

    try {
      await fs.rename(
        "deployedAddresses.json",
        "deployedAddresses.backup.json",
      );
    } catch (e) {
      if ((e as { code: string }).code !== "ENOENT") {
        throw e;
      }
    }

    return new RecordingDeployer(deployer, safeDeployer);
  }

  async deploy<CFC extends ContractFactoryConstructor>(
    name: string,
    factory: CFC,
    args: DeployParams<CFC>,
  ) {
    return this.deployImpl(name, factory, args, this.deployer);
  }

  async deployWithSafeDeployer<CFC extends ContractFactoryConstructor>(
    name: string,
    factory: CFC,
    args: DeployParams<CFC>,
  ) {
    return this.deployImpl(name, factory, args, this.safeDeployer);
  }

  private async deployImpl<CFC extends ContractFactoryConstructor>(
    name: string,
    factory: CFC,
    args: DeployParams<CFC>,
    deployer: DeterministicDeployer,
  ) {
    const contract = await deployer.connectOrDeploy(factory, args);
    const address = await contract.getAddress();
    console.log(`Deployed ${name} to ${address}`);
    this.deployments[name] = address;

    return contract;
  }

  async finish() {
    await fs.writeFile(
      "deployedAddresses.json",
      JSON.stringify(this.deployments, null, 2),
    );

    await fs.rm("deployedAddresses.backup.json", { force: true });
  }
}

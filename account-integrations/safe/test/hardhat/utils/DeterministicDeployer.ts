import { ethers, Signer } from "ethers";
import SignerOrProvider from "./SignerOrProvider";
import assert from "./assert";

/**
 * Filters out the optional elements of an array type because an optional
 * element isn't considered to match First in [infer First, ...].
 */
type NonOptionalElementsOf<A extends unknown[]> = A extends [
  infer First,
  ...infer Tail,
]
  ? [First, ...NonOptionalElementsOf<Tail>]
  : A extends [opt?: unknown]
  ? []
  : never;

export type ContractFactoryConstructor = {
  new (): ethers.ContractFactory;
  connect(
    address: string,
    runner?: ethers.ContractRunner | null,
  ): Pick<ethers.Contract, "getAddress">;
};

export type DeployParams<CFC extends ContractFactoryConstructor> =
  NonOptionalElementsOf<Parameters<InstanceType<CFC>["deploy"]>>;

type Deployment = {
  gasPrice: bigint;
  gasLimit: bigint;
  signerAddress: string;
  transaction: string;
  address: string;
};

/**
 * Deploys contracts to deterministic addresses.
 *
 * Based on create2 and the deployer contract from:
 *   https://github.com/Arachnid/deterministic-deployment-proxy
 *
 * This class also uses generics to allow type information from TypeChain to
 * ensure constructor arguments are correct.
 */
export default class DeterministicDeployer {
  static address = "0x4e59b44847b379578588920ca78fbf26c0b4956c";

  static deployment = {
    transaction: [
      "0x",
      "f8a58085174876e800830186a08080b853604580600e600039806000f350fe7fffffff",
      "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffe0360160008160",
      "2082378035828234f58015156039578182fd5b8082525050506014600cf31ba0222222",
      "2222222222222222222222222222222222222222222222222222222222a02222222222",
      "222222222222222222222222222222222222222222222222222222",
    ].join(""),
    gasPrice: 100_000_000_000n, // 100 gwei
    gasLimit: 100_000n,
    signerAddress: "0x3fab184622dc19b6109349b94811493bf2a45362",
  };

  provider: ethers.Provider;
  viewer: DeterministicDeploymentViewer;

  private constructor(
    public signer: ethers.Signer,
    public chainId: bigint,
    public address: string,
  ) {
    if (!signer.provider) {
      throw new Error("Expected signer with provider");
    }

    this.provider = signer.provider;

    this.viewer = new DeterministicDeploymentViewer(signer, chainId);
  }

  static async init(signer: ethers.Signer): Promise<DeterministicDeployer> {
    const { provider } = signer;
    assert(provider, "Expected signer with provider");

    const { chainId } = await provider.getNetwork();

    const address = DeterministicDeployer.address;

    const existingCode = await provider.getCode(address);

    if (existingCode !== "0x") {
      return new DeterministicDeployer(signer, chainId, address);
    }

    const deployment = DeterministicDeployer.deployment;

    // Fund the eoa account for the presigned transaction
    await (
      await signer.sendTransaction({
        to: deployment.signerAddress,
        value: BigInt(deployment.gasPrice) * BigInt(deployment.gasLimit),
      })
    ).wait();

    await (await provider.broadcastTransaction(deployment.transaction)).wait();

    const deployedCode = await provider.getCode(DeterministicDeployer.address);
    assert(deployedCode !== "0x", "Failed to deploy safe singleton factory");

    return new DeterministicDeployer(
      signer,
      chainId,
      DeterministicDeployer.address,
    );
  }

  static async from(signerOrFactory: ethers.Signer | DeterministicDeployer) {
    if (signerOrFactory instanceof DeterministicDeployer) {
      return signerOrFactory;
    }

    return await DeterministicDeployer.init(signerOrFactory);
  }

  // TODO: Explain
  static link<CFC extends ContractFactoryConstructor>(
    ContractFactoryConstructor: CFC,
    constructorParams: ConstructorParameters<CFC>,
  ): CFC {
    return class LinkedCFC extends (ContractFactoryConstructor as any) {
      constructor() {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        super(...constructorParams);
      }
    } as CFC;
  }

  calculateAddress<CFC extends ContractFactoryConstructor>(
    ContractFactoryConstructor: CFC,
    deployParams: DeployParams<CFC>,
    salt: ethers.BytesLike = ethers.solidityPacked(["uint256"], [0]),
  ) {
    return this.viewer.calculateAddress(
      ContractFactoryConstructor,
      deployParams,
      salt,
    );
  }

  async isDeployed<CFC extends ContractFactoryConstructor>(
    ContractFactoryConstructor: CFC,
    deployParams: DeployParams<CFC>,
    salt: ethers.BytesLike = ethers.solidityPacked(["uint256"], [0]),
  ): Promise<boolean> {
    return this.viewer.isDeployed(
      ContractFactoryConstructor,
      deployParams,
      salt,
    );
  }

  async connectIfDeployed<CFC extends ContractFactoryConstructor>(
    ContractFactoryConstructor: CFC,
    deployParams: DeployParams<CFC>,
    salt: ethers.BytesLike = ethers.solidityPacked(["uint256"], [0]),
  ): Promise<ReturnType<CFC["connect"]> | undefined> {
    const contract = await this.viewer.connectIfDeployed(
      ContractFactoryConstructor,
      deployParams,
      salt,
    );

    return contract;
  }

  async connectOrDeploy<CFC extends ContractFactoryConstructor>(
    ContractFactoryConstructor: CFC,
    deployParams: DeployParams<CFC>,
    salt: ethers.BytesLike = ethers.solidityPacked(["uint256"], [0]),
  ): Promise<ReturnType<CFC["connect"]>> {
    const contractFactory = new ContractFactoryConstructor();

    const initCode =
      contractFactory.bytecode +
      contractFactory.interface.encodeDeploy(deployParams).slice(2);

    const address = this.calculateAddress(
      ContractFactoryConstructor,
      deployParams,
      salt,
    );

    const existingCode = await this.provider.getCode(address);

    if (existingCode !== "0x") {
      return ContractFactoryConstructor.connect(
        address,
        this.signer,
      ) as ReturnType<CFC["connect"]>;
    }

    const deployTx = {
      to: this.address,
      data: ethers.solidityPacked(["uint256", "bytes"], [salt, initCode]),
    };

    let receipt;
    let failedAttempts = 0;

    while (true) {
      try {
        receipt = await (await this.signer.sendTransaction(deployTx)).wait();
        break;
      } catch (error) {
        const errorCode = (error as { code: unknown }).code;

        if (errorCode === "NONCE_EXPIRED") {
          failedAttempts += 1;

          if (failedAttempts >= 3) {
            throw error;
          }

          continue;
        }

        if (errorCode === "INSUFFICIENT_FUNDS") {
          const gasEstimate = await this.provider.estimateGas(deployTx);
          const { gasPrice } = await this.provider.getFeeData();

          if (!gasPrice) {
            throw error;
          }

          const balance = await this.provider.getBalance(
            this.signer.getAddress(),
          );

          throw new Error(
            [
              "Account",
              await this.signer.getAddress(),
              "has insufficient funds:",
              ethers.formatEther(balance),
              "ETH, need (approx):",
              ethers.formatEther(gasEstimate * gasPrice),
              "ETH",
            ].join(" "),
          );
        }

        throw error;
      }
    }

    if (receipt === null) {
      throw new Error("Failed to get transaction receipt for deployment");
    }

    const deployedCode = await this.provider.getCode(
      address,
      receipt.blockNumber,
    );

    assert(deployedCode !== "0x", "Failed to deploy to expected address");

    return ContractFactoryConstructor.connect(
      address,
      this.signer,
    ) as ReturnType<CFC["connect"]>;
  }
}

export class DeterministicDeploymentViewer {
  safeSingletonFactoryAddress: string;
  signer?: Signer;
  provider: ethers.Provider;

  constructor(
    public signerOrProvider: SignerOrProvider,
    public chainId: bigint,
  ) {
    this.safeSingletonFactoryAddress = DeterministicDeployer.address;

    let provider: ethers.Provider | undefined;

    if ("getNetwork" in signerOrProvider) {
      provider = signerOrProvider;
    } else {
      assert(signerOrProvider.provider);
      provider = signerOrProvider.provider;
      this.signer = signerOrProvider;
    }

    if (!provider) {
      throw new Error("No provider found");
    }

    this.provider = provider;
  }

  static async from(signerOrProvider: SignerOrProvider) {
    const provider =
      "getNetwork" in signerOrProvider
        ? signerOrProvider
        : signerOrProvider.provider;

    if (!provider) {
      throw new Error("No provider found");
    }

    const network = await provider.getNetwork();

    return new DeterministicDeploymentViewer(signerOrProvider, network.chainId);
  }

  calculateAddress<CFC extends ContractFactoryConstructor>(
    ContractFactoryConstructor: CFC,
    deployParams: DeployParams<CFC>,
    salt: ethers.BytesLike = ethers.solidityPacked(["uint256"], [0]),
  ) {
    const contractFactory = new ContractFactoryConstructor();

    const initCode =
      contractFactory.bytecode +
      contractFactory.interface.encodeDeploy(deployParams).slice(2);

    return ethers.getCreate2Address(
      this.safeSingletonFactoryAddress,
      salt,
      ethers.keccak256(initCode),
    );
  }

  async isDeployed<CFC extends ContractFactoryConstructor>(
    ContractFactoryConstructor: CFC,
    deployParams: DeployParams<CFC>,
    salt: ethers.BytesLike = ethers.solidityPacked(["uint256"], [0]),
  ) {
    const address = this.calculateAddress(
      ContractFactoryConstructor,
      deployParams,
      salt,
    );

    const existingCode = await this.provider.getCode(address);

    return existingCode !== "0x";
  }

  connectAssume<CFC extends ContractFactoryConstructor>(
    ContractFactoryConstructor: CFC,
    deployParams: DeployParams<CFC>,
    salt: ethers.BytesLike = ethers.solidityPacked(["uint256"], [0]),
  ): ReturnType<CFC["connect"]> {
    const address = this.calculateAddress(
      ContractFactoryConstructor,
      deployParams,
      salt,
    );

    const contract = ContractFactoryConstructor.connect(
      address,
      this.signer ?? this.provider,
    ) as ReturnType<CFC["connect"]>;

    return contract;
  }

  async connectIfDeployed<CFC extends ContractFactoryConstructor>(
    ContractFactoryConstructor: CFC,
    deployParams: DeployParams<CFC>,
    salt: ethers.BytesLike = ethers.solidityPacked(["uint256"], [0]),
  ): Promise<ReturnType<CFC["connect"]> | undefined> {
    const contract = this.connectAssume(
      ContractFactoryConstructor,
      deployParams,
      salt,
    );

    const existingCode = await this.provider.getCode(contract.getAddress());

    if (existingCode === "0x") {
      return undefined;
    }

    return contract;
  }

  async connectOrThrow<CFC extends ContractFactoryConstructor>(
    ContractFactoryConstructor: CFC,
    deployParams: DeployParams<CFC>,
    salt: ethers.BytesLike = ethers.solidityPacked(["uint256"], [0]),
  ): Promise<ReturnType<CFC["connect"]>> {
    const contract = await this.connectIfDeployed(
      ContractFactoryConstructor,
      deployParams,
      salt,
    );

    if (!contract) {
      throw new Error(
        `Contract ${
          ContractFactoryConstructor.name
        } not deployed at ${this.calculateAddress(
          ContractFactoryConstructor,
          deployParams,
          salt,
        )}`,
      );
    }

    return contract;
  }
}

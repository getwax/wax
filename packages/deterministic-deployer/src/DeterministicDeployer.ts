import { ethers, Overrides, Signer } from "ethers";
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

// Deterministic Deployer Deployment
export type DDDeployment = {
  transaction?: string;
  gasPrice?: bigint;
  gasLimit?: bigint;
  signerAddress: string;
  address: string;
};

// AKA SafeSingletonFactory
const safeDeployerAddress = "0x914d7Fec6aaC8cd542e72Bca78B30650d45643d7";

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
  static defaultDeployment: DDDeployment = {
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
    address: "0x4e59b44847b379578588920ca78fbf26c0b4956c",
  };

  provider: ethers.Provider;
  viewer: DeterministicDeploymentViewer;

  private constructor(
    public signer: ethers.Signer,
    public chainId: bigint,
    public deployment: DDDeployment,
    public overrides: Overrides,
  ) {
    if (!signer.provider) {
      throw new Error("Expected signer with provider");
    }

    this.provider = signer.provider;

    this.viewer = new DeterministicDeploymentViewer(
      signer,
      chainId,
      deployment.address,
    );
  }

  static async init(
    signer: ethers.Signer,
    overrides: Overrides = {},
    deployment = DeterministicDeployer.defaultDeployment,
  ): Promise<DeterministicDeployer> {
    const { provider } = signer;
    assert(provider, "Expected signer with provider");

    const { chainId } = await provider.getNetwork();

    const address = deployment.address;

    const existingCode = await provider.getCode(address);

    if (existingCode !== "0x") {
      return new DeterministicDeployer(signer, chainId, deployment, overrides);
    }

    if (
      !deployment.transaction ||
      !deployment.gasPrice ||
      !deployment.gasLimit
    ) {
      throw new Error("Missing details for deploying deployer contract");
    }

    const requiredBalance =
      BigInt(deployment.gasPrice) * BigInt(deployment.gasLimit);
    const currentBalance = await provider.getBalance(deployment.signerAddress);
    const balanceDeficit = requiredBalance - currentBalance;

    if (balanceDeficit > 0n) {
      // Fund the eoa account for the presigned transaction
      await (
        await signer.sendTransaction({
          ...overrides,
          to: deployment.signerAddress,
          value: BigInt(deployment.gasPrice) * BigInt(deployment.gasLimit),
        })
      ).wait();
    }

    await (await provider.broadcastTransaction(deployment.transaction)).wait();

    const deployedCode = await provider.getCode(deployment.address);
    assert(deployedCode !== "0x", "Failed to deploy safe singleton factory");

    return new DeterministicDeployer(signer, chainId, deployment, overrides);
  }

  /**
   * Safe forked DeterministicDeployer to create SafeSingletonFactory:
   * https://github.com/safe-global/safe-singleton-factory
   *
   * At the time, Safe wanted to support chains that didn't support the legacy
   * transactions needed to make a deployment that works for all chains.
   *
   * That no longer appears to be an issue, and Arachnid's original version is
   * much more popular, simple, and removes the need to rely on a third party
   * (Safe).
   *
   * However, since Safe still uses this version, it can be useful for deploying
   * the Safe contracts themselves to the same addresses that they exist on
   * other networks, particularly local test nets.
   */
  static async initSafeVersion(
    signer: ethers.Signer,
    overrides: Overrides = {},
  ): Promise<DeterministicDeployer> {
    const { provider } = signer;
    assert(provider, "Expected signer with provider");

    const signerAddress = "0xE1CB04A0fA36DdD16a06ea828007E35e1a3cBC37";
    const address = safeDeployerAddress;
    const existingCode = await provider.getCode(address);

    if (existingCode !== "0x") {
      const { chainId } = await provider.getNetwork();

      return new DeterministicDeployer(
        signer,
        chainId,
        {
          signerAddress,
          address,
        },
        overrides,
      );
    }

    const { chainId } = await provider.getNetwork();

    if (chainId === 1337n) {
      const deployer = await DeterministicDeployer.init(signer, overrides, {
        transaction: [
          "0x",
          "f8a78085174876e800830186a08080b853604580600e600039806000f350fe7fff",
          "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe03601",
          "600081602082378035828234f58015156039578182fd5b8082525050506014600c",
          "f3820a96a0460c6ea9b8f791e5d9e67fbf2c70aba92bf88591c39ac3747ea1bedc",
          "2ef1750ca04b08a4b5cea15a56276513da7a0c0b34f16e89811d5dd911efba5f86",
          "25a921cc",
        ].join(""),
        gasPrice: 100000000000n,
        gasLimit: 100000n,
        signerAddress: "0xE1CB04A0fA36DdD16a06ea828007E35e1a3cBC37",
        address,
      });

      return deployer;
    }

    if (chainId === 31337n) {
      const deployer = await DeterministicDeployer.init(signer, overrides, {
        transaction: [
          "0x",
          "f8a78085174876e800830186a08080b853604580600e600039806000f350fe7fff",
          "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe03601",
          "600081602082378035828234f58015156039578182fd5b8082525050506014600c",
          "f382f4f5a00dc4d1d21b308094a30f5f93da35e4d72e99115378f135f2295bea47",
          "301a3165a0636b822daad40aa8c52dd5132f378c0c0e6d83b4898228c7e21c84e6",
          "31a0b891",
        ].join(""),
        gasPrice: 100000000000n,
        gasLimit: 100000n,
        signerAddress: "0xE1CB04A0fA36DdD16a06ea828007E35e1a3cBC37",
        address,
      });

      return deployer;
    }

    throw new Error(
      [
        "Safe singleton factory (0x914d..43d7) has not been deployed on this",
        "network and we don't have the deployment details to deploy it.",
        "Consult https://github.com/safe-global/safe-singleton-factory about",
        `support for network id ${chainId}`,
      ].join(" "),
    );
  }

  static async from(signerOrFactory: ethers.Signer | DeterministicDeployer) {
    if (signerOrFactory instanceof DeterministicDeployer) {
      return signerOrFactory;
    }

    return await DeterministicDeployer.init(signerOrFactory);
  }

  /**
   * When using libraries in solidity, the ContractFactory constructor (in js,
   * not the smart contract) requires addresses to be specified for those
   * libraries.
   *
   * The limitations of TypeScript's type system cause these required arguments
   * to be skipped when using methods here that use ContractFactoryConstructor:
   *
   * ```ts
   * const deployer = await DeterministicDeployer.init(signer);
   *
   * const widget = await deployer.connectOrDeploy(
   *   // Implicitly calls `new Widget__factory()`, failing to provide libraries
   *   Widget__factory,
   *   [], // <--- constructor arguments go here, but libraries are different
   * );
   * ```
   *
   * As a workaround, you can use this method like so:
   *
   * ```ts
   * const deployer = await DeterministicDeployer.init(signer);
   *
   * const widgetLib = await deployer.connectOrDeploy(
   *   WidgetLib__factory,
   *   [],
   * );
   *
   * const widget = await deployer.connectOrDeploy(
   *   DeterministicDeployer.link(
   *     Widget__factory,
   *     {
   *       "path/to/WidgetLib.sol:WidgetLib": await widgetLib.getAddress(),
   *     },
   *   ),
   *   [],
   * );
   * ```
   */
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
      ...this.overrides,
      to: this.deployment.address,
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
  signer?: Signer;
  provider: ethers.Provider;

  constructor(
    public signerOrProvider: SignerOrProvider,
    public chainId: bigint,
    public deployerAddress = DeterministicDeployer.defaultDeployment.address,
  ) {
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

  static async init(
    signerOrProvider: SignerOrProvider,
    deployerAddress = DeterministicDeployer.defaultDeployment.address,
  ) {
    const provider =
      "getNetwork" in signerOrProvider
        ? signerOrProvider
        : signerOrProvider.provider;

    if (!provider) {
      throw new Error("No provider found");
    }

    const network = await provider.getNetwork();

    return new DeterministicDeploymentViewer(
      signerOrProvider,
      network.chainId,
      deployerAddress,
    );
  }

  static async initSafeVersion(signerOrProvider: SignerOrProvider) {
    const viewer = await DeterministicDeploymentViewer.init(
      signerOrProvider,
      safeDeployerAddress,
    );

    return viewer;
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
      this.deployerAddress,
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

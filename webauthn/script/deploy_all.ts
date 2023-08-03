import { DeployFunction, DeployResult } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import hre from "hardhat";

type DeployResultWithContractName = DeployResult & {
  contractName: string;
};

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deployer } = await getNamedAccounts();
  const { deploy } = deployments;

  const contracts = [
    "SimulateTxAccessor",
    "SafeProxyFactory",
    "TokenCallbackHandler",
    "CompatibilityFallbackHandler",
    "CreateCall",
    "MultiSend",
    "MultiSendCallOnly",
    "SignMessageLib",
    "SafeL2",
    "Safe",
  ];

  for (const contract of contracts) {
    const deployment = (await deploy(contract, {
      from: deployer,
      args: [],
      log: true,
      deterministicDeployment: true,
      gasLimit: 10_000_000,
    })) as DeployResultWithContractName;
    console.log(`deployed ${deployment.contractName} to ${deployment.address}`);
  }
};

deploy(hre).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

import { ethers } from "ethers";
import SimulateTxAccessor from "../artifacts/lib/safe-contracts/contracts/accessors/SimulateTxAccessor.sol/SimulateTxAccessor.json";
import SafeProxyFactory from "../artifacts/lib/safe-contracts/contracts/proxies/SafeProxyFactory.sol/SafeProxyFactory.json";
import TokenCallbackHandler from "../artifacts/lib/safe-contracts/contracts/handler/TokenCallbackHandler.sol/TokenCallbackHandler.json";
import CompatibilityFallbackHandler from "../artifacts/lib/safe-contracts/contracts/handler/CompatibilityFallbackHandler.sol/CompatibilityFallbackHandler.json";
import CreateCall from "../artifacts/lib/safe-contracts/contracts/libraries/CreateCall.sol/CreateCall.json";
import MultiSend from "../artifacts/lib/safe-contracts/contracts/libraries/MultiSend.sol/MultiSend.json";
import MultiSendCallOnly from "../artifacts/lib/safe-contracts/contracts/libraries/MultiSendCallOnly.sol/MultiSendCallOnly.json";
import SignMessageLib from "../artifacts/lib/safe-contracts/contracts/libraries/SignMessageLib.sol/SignMessageLib.json";
import SafeL2 from "../artifacts/lib/safe-contracts/contracts/SafeL2.sol/SafeL2.json";
import Safe from "../artifacts/lib/safe-contracts/contracts/Safe.sol/Safe.json";
import EntryPoint from "../artifacts/lib/account-abstraction/contracts/core/EntryPoint.sol/EntryPoint.json";

const deploy = async function () {
  const contracts = [
    SimulateTxAccessor,
    SafeProxyFactory,
    TokenCallbackHandler,
    CompatibilityFallbackHandler,
    CreateCall,
    MultiSend,
    MultiSendCallOnly,
    SignMessageLib,
    SafeL2,
    Safe,
    EntryPoint,
  ];

  const provider = new ethers.JsonRpcProvider(process.env.NODE_URL);
  const signer = await provider.getSigner();

  for (const contract of contracts) {
    const contractFactory = new ethers.ContractFactory(
      contract.abi,
      contract.bytecode
    );
    const deployedContract = await contractFactory
      .connect(signer)
      .deploy({ gasLimit: 10_000_000 });
    await deployedContract.waitForDeployment();

    console.log(
      `deployed ${
        contract.contractName
      } to ${await deployedContract.getAddress()}`
    );
  }
};

deploy().catch((error: Error) => {
  console.error(error);
  process.exitCode = 1;
});

import { ConnectKitButton } from "connectkit";
import { Button } from "./Button";
import {
  useAccount,
  useReadContract,
  useWriteContract,
} from "wagmi";
import { safe7579, safeRecoveryModule } from "../../contracts.base-sepolia.json";
import { abi as safeAbi } from "../abi/Safe.json";
import { abi as safe7579Abi } from "../abi/Safe7579.json";
import { useCallback, useContext, useEffect, useState } from "react";
import { StepsContext } from "../App";
import { STEPS } from "../constants";
import Loader from "./Loader";
import toast from "react-hot-toast";
import { zeroAddress } from "viem";

const EnableSafeModule = () => {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();

  const stepsContext = useContext(StepsContext);
  const [isEnableModalLoading, setIsEnableModuleLoading] = useState(false);

  // TODO Update this to check Safe7579.isModuleInstalled
  const { data: isModuleEnabled, isLoading: isCheckModuleEnabledLoading } =
    useReadContract({
      address,
      abi: safeAbi,
      functionName: "isModuleEnabled",
      args: [safeRecoveryModule],
    });

  useEffect(() => {
    console.log(isModuleEnabled);
  }, [isModuleEnabled]);

  console.log(isModuleEnabled);

  if (isModuleEnabled) {
    console.log("Module is enabled");
    setIsEnableModuleLoading(false);
    stepsContext?.setStep(STEPS.REQUEST_GUARDIAN);
  }

  const enableSafe7579Module = useCallback(async () => {
    setIsEnableModuleLoading(true);
    if (!address) {
      throw new Error("unable to get account address");
    }

    toast("Please check Safe Website to complete transaction", {
      // TODO Where is this infoIcon from?
      // icon: <img src={infoIcon} />,
      style: {
        background: 'white'
      }
    })

    console.debug("1", "Enable 7579 Module");

    await writeContractAsync({
      abi: safeAbi,
      address,
      functionName: "enableModule",
      args: [safe7579]
    });

    console.debug("2", "Set as fallback handler");

    await writeContractAsync({
      abi: safeAbi,
      address,
      functionName: "setFallbackHandler",
      args: [safe7579]
    });

    console.debug("3", "Initiliaze Safe w/ 7579 Adapter");

    await writeContractAsync({
      abi: safe7579Abi,
      address: safe7579 as `0x{string}`,
      functionName: "initializeAccount",
      args: [
        [], // Validators
        [], // Executors TODO We may need to add a default
        [], // Fallbacks
        [], // Hooks
        {
          registry: zeroAddress, // TODO Set to deployed registry (if needed)
          attesters: [],
          threshold: 0,
        },
      ],
    });

    // TODO Consider batching all of the above ^ via `safeAppsSDK.txs.send({ txs })` from @safe-global/safe-apps-sdk
    // May also be able to use MultiCall3

    // At this point, we should be setup for ERC-4337 & ERC-7579

    // TODO This step currently reverts as it needs to be run via ERC-4337 Entrypoint (UserOp)
    // Since this is likely the only UserOp we need to run, can directly submit to entrypoint
    console.debug("4", "Install email recovery module");

    // TODO Move to env
    // const bundlerUrl = "https://public.stackup.sh/api/v1/node/base-sepolia";

    // TODO Move to ConfigureSafeModule component?
    // TODO Check this is not already installed, can just directly submit to entrypoint
    const executorModuleTypeId = 2; // Executor
    await writeContractAsync({
      abi: safe7579Abi,
      address: safe7579 as `0x{string}`,
      functionName: "installModule",
      args: [
        executorModuleTypeId,
        safeRecoveryModule,
        "", // TODO Check this install data is no longer needed
      ]
    });

    console.debug("Done!");

  }, [address, writeContractAsync]);

  if (isCheckModuleEnabledLoading) {
    return <Loader />;
  }

  return (
    <div style={{ display: "flex", gap: "2rem", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        Connected wallet: <ConnectKitButton />
      </div>
      {!isModuleEnabled ? (
        <Button
          disabled={isEnableModalLoading}
          loading={isEnableModalLoading}
          onClick={enableSafe7579Module}
        >
          Enable Safe ERC-7579 Module
        </Button>
      ) : null}
      {/* {isEnableModalLoading ? (
        <>Please check Safe Website to complete transaction</>
      ) : null} */}
    </div>
  );
};

export default EnableSafeModule;

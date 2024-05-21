import { ConnectKitButton } from "connectkit";
import { Button } from "./Button";
import {
  useAccount,
  useReadContract,
  useWalletClient,
  useWriteContract,
} from "wagmi";
import { safeZkSafeZkEmailRecoveryPlugin } from "../../contracts.base-sepolia.json";
import { abi as safeAbi } from "../abi/Safe.json";
import { useCallback, useContext, useEffect, useState } from "react";
import { StepsContext } from "../App";
import { STEPS } from "../constants";
import Loader from "./Loader";
import toast from "react-hot-toast";

const EnableSafeModule = () => {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const stepsContext = useContext(StepsContext);
  const [isEnableModalLoading, setIsEnableModuleLoading] = useState(false);

  console.log(address);

  // useEffect(() => {
  //   if (!address) {
  //     stepsContext?.setStep(STEPS.CONNECT_WALLETS);
  //   }
  // }, [address, stepsContext]);

  const { data: isModuleEnabled, isLoading: isCheckModuleEnabledLoading } =
    useReadContract({
      address,
      abi: safeAbi,
      functionName: "isModuleEnabled",
      args: [safeZkSafeZkEmailRecoveryPlugin],
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

  const enableEmailRecoveryModule = useCallback(async () => {
    setIsEnableModuleLoading(true);
    if (!address) {
      throw new Error("unable to get account address");
    }

    toast("Please check Safe Website to complete transaction", {
      icon: <img src={infoIcon} />,
      style: {
        background: 'white'
      }
    })

    await writeContractAsync({
      abi: safeAbi,
      address,
      functionName: "enableModule",
      args: [safeZkSafeZkEmailRecoveryPlugin],
    });
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
          onClick={enableEmailRecoveryModule}
        >
          Enable Email Recovery Module
        </Button>
      ) : null}
      {/* {isEnableModalLoading ? (
        <>Please check Safe Website to complete transaction</>
      ) : null} */}
    </div>
  );
};

export default EnableSafeModule;

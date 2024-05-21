import { ConnectKitButton } from "connectkit";
import { Button } from "../Button";
import {
  useAccount,
  useReadContract,
  useWalletClient,
  useWriteContract,
} from "wagmi";
import { safeZkSafeZkEmailRecoveryPlugin } from "../../../contracts.base-sepolia.json";
import { abi as safeAbi } from "../../abi/Safe.json";
import { useCallback, useContext, useEffect, useState } from "react";
import { StepsContext } from "../../App";
import { STEPS } from "../../constants";

const SafeModuleRecovery = () => {
  const { address } = useAccount();
  const test = useWalletClient();
  const { writeContractAsync } = useWriteContract();
  const stepsContext = useContext(StepsContext);
  const [loading, setLoading] = useState(false);

  console.log(test);

  // useEffect(() => {
  //   if (!address) {
  //     stepsContext?.setStep(STEPS.CONNECT_WALLETS);
  //   }
  // }, [address, stepsContext]);

  const { data: isModuleEnabled } = useReadContract({
    address,
    abi: safeAbi,
    functionName: "isModuleEnabled",
    args: [safeZkSafeZkEmailRecoveryPlugin],
  });

  console.log(isModuleEnabled);

  if (isModuleEnabled) {
    console.log("Module is enabled");
    setLoading(false);
    stepsContext?.setStep(STEPS.REQUEST_GUARDIAN);
  }

  const enableEmailRecoveryModule = useCallback(async () => {
    setLoading(true);
    if (!address) {
      throw new Error("unable to get account address");
    }

    await writeContractAsync({
      abi: safeAbi,
      address,
      functionName: "enableModule",
      args: [safeZkSafeZkEmailRecoveryPlugin],
    });
  }, [address, writeContractAsync]);

  return (
    <div style={{ display: "flex", gap: "2rem", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        Connected wallet: <ConnectKitButton />
      </div>
      {!isModuleEnabled ? (
        <Button disabled={loading} onClick={enableEmailRecoveryModule}>
          Enable Email Recovery Module
        </Button>
      ) : null}
    </div>
  );
};

export default SafeModuleRecovery;

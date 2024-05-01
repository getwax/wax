import { ConnectKitButton } from "connectkit";
import { Button } from "./Button";
import { useAccount, useBytecode, useChainId, useReadContract, useWriteContract } from "wagmi";
import { safeZkSafeZkEmailRecoveryPlugin } from "../../contracts.base-sepolia.json";
import { abi as safeAbi } from "../abi/Safe.json";
import { abi as proxyAbi } from "../abi/IProxy.json";
import { useCallback, useContext, useEffect, useState, useMemo } from "react";
import { StepsContext } from "../App";
import { STEPS } from "../constants";
import { getSafeL2SingletonDeployment } from "@safe-global/safe-deployments";

const SafeModuleRecovery = () => {
  const chainId = useChainId();
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const stepsContext = useContext(StepsContext);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!address) {
      stepsContext?.setStep(STEPS.CONNECT_WALLETS);
    }
  }, [address, stepsContext]);

  // See https://ethereum.stackexchange.com/a/141258
  const { data: addressBytecode } = useBytecode({ address });
  const { data: masterCopy } = useReadContract({
    address,
    abi: proxyAbi,
    functionName: "masterCopy",
  });
  const isSafeAccount = useMemo(() => {
    const safeL2SingletonAddr = getSafeL2SingletonDeployment({ network: `${chainId}` });
    return addressBytecode && masterCopy === safeL2SingletonAddr;
  }, [chainId, addressBytecode, masterCopy])

  const { data: isModuleEnabled } = useReadContract({
    address,
    abi: safeAbi,
    functionName: "isModuleEnabled",
    args: [safeZkSafeZkEmailRecoveryPlugin],
  });

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
      {!isSafeAccount && (
        <div>Connected account is not a Safe, please connect a Safe</div>
      )}
      {isSafeAccount && !isModuleEnabled && (
        <Button disabled={loading} onClick={enableEmailRecoveryModule}>
          Enable Email Recovery Module
        </Button>
      )}
    </div>
  );
};

export default SafeModuleRecovery;

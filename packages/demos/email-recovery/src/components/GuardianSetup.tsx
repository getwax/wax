import { useCallback, useContext, useMemo, useState } from "react";
import { ConnectKitButton } from "connectkit";
import { Button } from "./Button";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { abi as safeAbi } from "../abi/Safe.json";
import infoIcon from "../assets/infoIcon.svg";
import { useAppContext } from "../context/AppContextHook";

import { abi as recoveryPluginAbi } from "../abi/SafeZkEmailRecoveryPlugin.json";
import { safeZkSafeZkEmailRecoveryPlugin } from "../../contracts.base-sepolia.json";
import {
  genAccountCode,
  getRequestGuardianSubject,
  templateIdx,
} from "../utils/email";
import { readContract } from "wagmi/actions";
import { config } from "../providers/config";
import { pad } from "viem";
import { relayer } from "../services/relayer";
import { StepsContext } from "../App";
import { STEPS } from "../constants";
import toast from "react-hot-toast";

const GuardianSetup = () => {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();

  const { guardianEmail, setGuardianEmail, accountCode, setAccountCode } =
    useAppContext();
  const stepsContext = useContext(StepsContext);

  const [loading, setLoading] = useState(false);
  // 0 = 2 week default delay, don't do for demo
  const [recoveryDelay, setRecoveryDelay] = useState(1);

  const isMobile = window.innerWidth < 768;

  const { data: safeOwnersData } = useReadContract({
    address,
    abi: safeAbi,
    functionName: "getOwners",
  });
  const firstSafeOwner = useMemo(() => {
    const safeOwners = safeOwnersData as string[];
    if (!safeOwners?.length) {
      return;
    }
    return safeOwners[0];
  }, [safeOwnersData]);

  const configureRecoveryAndRequestGuardian = useCallback(async () => {
    if (!address) {
      throw new Error("unable to get account address");
    }

    if (!guardianEmail) {
      throw new Error("guardian email not set");
    }

    if (!firstSafeOwner) {
      throw new Error("safe owner not found");
    }

    try {
      setLoading(true);
      toast("Please check Safe Website to complete transaction", {
        icon: <img src={infoIcon} />,
        style: {
          background: 'white'
        }
      });

      const acctCode = await genAccountCode();
      setAccountCode(accountCode);

      const guardianSalt = await relayer.getAccountSalt(
        acctCode,
        guardianEmail
      );
      const guardianAddr = await readContract(config, {
        abi: recoveryPluginAbi,
        address: safeZkSafeZkEmailRecoveryPlugin as `0x${string}`,
        functionName: "computeEmailAuthAddress",
        args: [guardianSalt],
      });
      // TODO Should this be something else?
      const previousOwnerInLinkedList = pad("0x1", {
        size: 20,
      });

      await writeContractAsync({
        abi: recoveryPluginAbi,
        address: safeZkSafeZkEmailRecoveryPlugin as `0x${string}`,
        functionName: "configureRecovery",
        args: [
          firstSafeOwner,
          guardianAddr,
          recoveryDelay,
          previousOwnerInLinkedList,
        ],
      });

      console.debug("recovery configured");

      const recoveryRouterAddr = (await readContract(config, {
        abi: recoveryPluginAbi,
        address: safeZkSafeZkEmailRecoveryPlugin as `0x${string}`,
        functionName: "getRouterForSafe",
        args: [address],
      })) as string;

      const subject = getRequestGuardianSubject(address);
      const { requestId } = await relayer.acceptanceRequest(
        recoveryRouterAddr,
        guardianEmail,
        acctCode,
        templateIdx,
        subject
      );

      console.debug("accept req id", requestId);

      // TODO Use polling instead
      stepsContext?.setStep(STEPS.REQUESTED_RECOVERIES);
      // let checkGuardianAcceptanceInterval = null

      // const checkGuardianAcceptance = async () => {
      //   if (!requestId) {
      //     throw new Error("missing guardian request id");
      //   }
      //   const resBody = await relayer.requestStatus(requestId);
      //   console.debug("guardian req res body", resBody);
      //   if(resBody?.is_success) {
      //     stepsContext?.setStep(STEPS.REQUESTED_RECOVERIES);
      //     checkGuardianAcceptanceInterval?.clearInterval()
      //   }
      // }
      // checkGuardianAcceptanceInterval = setInterval(async () => {
      //     const res = await checkGuardianAcceptance();
      //     console.log(res)
      // }, 5000);
    } catch (err) {
      toast.error(err.shortMessage);
    } finally {
      setLoading(false);
    }
  }, [
    address,
    firstSafeOwner,
    guardianEmail,
    recoveryDelay,
    accountCode,
    setAccountCode,
    writeContractAsync,
  ]);

  return (
    <div
      style={{
        maxWidth: isMobile ? "100%" : "50%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "flex-start",
        gap: "2rem",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        Connected wallet:
        <ConnectKitButton />
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          width: "100%",
        }}
      >
        Guardian Details:
        <div className="container">
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              gap: "2rem",
              width: "100%",
              alignItems: "flex-end",
              flexWrap: "wrap",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                width: isMobile ? "90%" : "60%",
              }}
            >
              <p>Guardian's Email</p>
              <input
                style={{ width: "100%" }}
                type="email"
                value={guardianEmail}
                onChange={(e) => setGuardianEmail(e.target.value)}
              />
            </div>
            <div>
              <span>Recovery Delay (seconds)</span>
              <input
                style={{ width: "1.875rem", marginLeft: "1rem" }}
                type="number"
                min={1}
                value={recoveryDelay}
                onChange={(e) => setRecoveryDelay(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>
      <div style={{ margin: "auto" }}>
        <Button disabled={!guardianEmail} loading={loading} onClick={configureRecoveryAndRequestGuardian}>
          Configure Recovery and Request Guardian
        </Button>
      </div>
    </div>
  );
};

export default GuardianSetup;

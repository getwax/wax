import { useCallback, useContext, useState } from "react";
import { Web3Provider } from "../providers/Web3Provider";
import { ConnectKitButton } from "connectkit";
import { Button } from "./Button";
import cancelRecoveryIcon from "../assets/cancelRecoveryIcon.svg";
import completeRecoveryIcon from "../assets/completeRecoveryIcon.svg";
import recoveredIcon from "../assets/recoveredIcon.svg";
import { useAppContext } from "../context/AppContextHook";
import { useAccount, useReadContract } from "wagmi";

import { relayer } from "../services/relayer";
import { abi as recoveryPluginAbi } from "../abi/SafeZkEmailRecoveryPlugin.json";
import { getRequestsRecoverySubject, templateIdx } from "../utils/email";
import { safeZkSafeZkEmailRecoveryPlugin } from "../../contracts.base-sepolia.json";
import { StepsContext } from "../App";
import { STEPS } from "../constants";
import { FlowContext } from "./StepSelection";
import toast from "react-hot-toast";

const BUTTON_STATES = {
  TRIGGER_RECOVERY: "Trigger Recovery",
  CANCEL_RECOVERY: "Cancel Recovery",
  COMPLETE_RECOVERY: "Complete Recovery",
  RECOVERY_COMPLETED: "Recovery Completed",
};

const RequestedRecoveries = () => {
  const isMobile = window.innerWidth < 768;
  const { address } = useAccount();
  const { guardianEmail } = useAppContext();
  const stepsContext = useContext(StepsContext);

  const [newOwner, setNewOwner] = useState<string>();
  const [safeWalletAddress, setSafeWalletAddress] = useState(address);
  const [guardianEmailAddress, setGuardianEmailAddress] =
    useState(guardianEmail);
  const [buttonState, setButtonState] = useState(
    BUTTON_STATES.TRIGGER_RECOVERY
  );
  const flowContext = useContext(FlowContext);

  const [loading, setLoading] = useState<boolean>(false);
  const [gurdianRequestId, setGuardianRequestId] = useState<number>();

  const { data: recoveryRouterAddr } = useReadContract({
    abi: recoveryPluginAbi,
    address: safeZkSafeZkEmailRecoveryPlugin as `0x${string}`,
    functionName: "getRouterForSafe",
    args: [safeWalletAddress],
  });

  const requestRecovery = useCallback(async () => {
    setLoading(true);
    if (!safeWalletAddress) {
      throw new Error("unable to get account address");
    }

    if (!guardianEmailAddress) {
      throw new Error("guardian email not set");
    }

    if (!newOwner) {
      throw new Error("new owner not set");
    }

    if (!recoveryRouterAddr) {
      throw new Error("could not find recovery router for safe");
    }

    const subject = getRequestsRecoverySubject(safeWalletAddress, newOwner);

    try {
      const { requestId } = await relayer.recoveryRequest(
        recoveryRouterAddr as string,
        guardianEmailAddress,
        templateIdx,
        subject
      );
      setGuardianRequestId(requestId);

      setButtonState(BUTTON_STATES.COMPLETE_RECOVERY);
    } catch (error) {
      console.log(error);
      toast.error("Something went wrong while requesting recovery")
      setLoading(false);
    } finally {
      setLoading(false);
    }

    // let checkRequestRecoveryStatusInterval = null

    // const checkGuardianAcceptance = async () => {
    //   if (!requestId) {
    //     throw new Error("missing guardian request id");
    //   }

    //   const resBody = await relayer.requestStatus(requestId);
    //   console.debug("guardian req res body", resBody);

    //   if(resBody?.is_success) {
    //     setLoading(false);
    //     setButtonState(BUTTON_STATES.COMPLETE_RECOVERY);
    //     checkRequestRecoveryStatusInterval?.clearInterval()
    //   }
    // }

    // checkRequestRecoveryStatusInterval = setInterval(async () => {
    //     const res = await checkGuardianAcceptance();
    //     console.log(res)
    // }, 5000);
  }, [recoveryRouterAddr, safeWalletAddress, guardianEmailAddress, newOwner]);

  const completeRecovery = useCallback(async () => {
    setLoading(true);
    if (!recoveryRouterAddr) {
      throw new Error("could not find recovery router for safe");
    }

    const res = relayer.completeRecovery(recoveryRouterAddr as string);

    console.debug("complete recovery res", res);
    setLoading(false);

    setButtonState(BUTTON_STATES.RECOVERY_COMPLETED);
  }, [recoveryRouterAddr]);

  // const checkGuardianAcceptance = useCallback(async () => {
  //   if (!gurdianRequestId) {
  //     throw new Error("missing guardian request id");
  //   }

  //   const resBody = await relayer.requestStatus(gurdianRequestId);
  //   console.debug("guardian req res body", resBody);
  // }, [gurdianRequestId]);

  const getButtonComponent = () => {
    switch (buttonState) {
      case BUTTON_STATES.TRIGGER_RECOVERY:
        return (
          <Button loading={loading} onClick={requestRecovery}>
            Trigger Recovery
          </Button>
        );
      case BUTTON_STATES.CANCEL_RECOVERY:
        return (
          <Button endIcon={<img src={cancelRecoveryIcon} />}>
            Cancel Recovery
          </Button>
        );
      case BUTTON_STATES.COMPLETE_RECOVERY:
        return (
          <Button
            loading={loading}
            onClick={completeRecovery}
            endIcon={<img src={completeRecoveryIcon} />}
          >
            Complete Recovery
          </Button>
        );
      case BUTTON_STATES.RECOVERY_COMPLETED:
        return (
          <Button
            loading={loading}
            onClick={() => stepsContext.setStep(STEPS.CONNECT_WALLETS)}
          >
            Complete! Connect new wallet to set new guardians ➔
          </Button>
        );
    }
  };

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
      {flowContext === "WALLET_RECOVERY" ? null : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          Connected wallet:
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              justifyContent: "center",
              alignItems: "center",
              gap: "1rem",
            }}
          >
            <ConnectKitButton />
            {buttonState === BUTTON_STATES.RECOVERY_COMPLETED ? (
              <div
                style={{
                  background: "#4E1D09",
                  border: "1px solid #93370D",
                  color: "#FEC84B",
                  padding: "0.25rem 0.75rem",
                  borderRadius: "3.125rem",
                  width: "fit-content",
                  height: "fit-content",
                }}
              >
                Recovered
                <img src={recoveredIcon} style={{ marginRight: "0.5rem" }} />
              </div>
            ) : null}
          </div>
        </div>
      )}
      {buttonState === BUTTON_STATES.RECOVERY_COMPLETED ? null : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
            width: "100%",
          }}
        >
          Requested Recoveries:
          <div className="container">
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                gap: isMobile ? "1rem" : "3rem",
                width: "100%",
                alignItems: "flex-end",
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  width: isMobile ? "90%" : "45%",
                }}
              >
                <p>Guardian's Email</p>
                <input
                  style={{ width: "100%" }}
                  type="email"
                  value={guardianEmailAddress}
                  onChange={(e) => setGuardianEmailAddress(e.target.value)}
                  readOnly={guardianEmail ? true : false}
                />
              </div>
              {address ? null : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    width: isMobile ? "90%" : "45%",
                  }}
                >
                  <p>Safe Wallet Address</p>
                  <input
                    style={{ width: "100%" }}
                    type="email"
                    value={safeWalletAddress}
                    onChange={(e) => setSafeWalletAddress(e.target.value)}
                  />
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  width: isMobile ? "90%" : "45%",
                }}
              >
                <p>Requested New Wallet Address</p>
                <input
                  style={{ width: "100%" }}
                  type="email"
                  value={newOwner}
                  onChange={(e) => setNewOwner(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>
      )}
      <div style={{ margin: "auto" }}>{getButtonComponent()}</div>
    </div>
  );
};

export default RequestedRecoveries;

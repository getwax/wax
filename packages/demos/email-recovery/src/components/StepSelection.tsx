import { useContext } from "react";
import { STEPS } from "../constants";
import { Button } from "./Button";
import { StepsContext } from "../App";

import { createContext, useEffect, useState } from "react";
import ConnectWallets from "./ConnectWallets";
import Navbar from "./Navbar";
import RequestedRecoveries from "./RequestedRecoveries";
import RequestGuardian from "./GuardianSetup";
import React from "react";
import SafeModuleRecovery from "./EnableSafeModule";
import TriggerAccountRecovery from "./TriggerAccountRecovery";
// import { Web3Provider } from "./providers/Web3Provider";
import { ConnectKitButton } from "connectkit";
import { useAccount } from "wagmi";
import { AppContextProvider } from "./context/AppContextProvider";
import { createBurnerSafeConfig } from "../providers/burnerWalletConfig";
import { Web3Provider } from "../providers/Web3Provider";
import { BurnerWalletProvider } from "../providers/BurnerWalletProvider";
import { actionType } from "../types";

export const FlowContext = createContext(null);

const StepSelection = () => {
  const stepsContext = useContext(StepsContext);
  const [selectedFlow, setSelectedFlow] = useState<actionType | null>();
  const [isBurnerWalletCreating, setIsBurnerWalletCreating] = useState(false);
  const [burnerWalletConfig, setBurnerWalletConfig] = useState();

  const handleClick = async (action: actionType) => {
    setSelectedFlow(action);

    switch (action) {
      case "SAFE_WALLET":
        return stepsContext?.setStep(STEPS.CONNECT_WALLETS);
      case "BURNER_WALLET":
        stepsContext?.setStep(STEPS.CONNECT_WALLETS);
        setIsBurnerWalletCreating(true);
        const config = await createBurnerSafeConfig();

        setBurnerWalletConfig(config);

        setIsBurnerWalletCreating(false);
        break;
      case "WALLET_RECOVERY":
        return stepsContext?.setStep(STEPS.REQUESTED_RECOVERIES);

      default:
        console.log(action);
        break;
    }
  };

  console.log(
    stepsContext?.step,
    selectedFlow,
    burnerWalletConfig
  );

  const renderBody = () => {
    switch (stepsContext?.step) {
      // case STEPS.STEP_SELECTION:
      //   return <StepSelection />;
      case STEPS.CONNECT_WALLETS:
        return <ConnectWallets />;
      case STEPS.SAFE_MODULE_RECOVERY:
        return <SafeModuleRecovery />;
      case STEPS.REQUEST_GUARDIAN:
        return <RequestGuardian />;
      case STEPS.REQUESTED_RECOVERIES:
        return <RequestedRecoveries />;
      case STEPS.TRIGGER_ACCOUNT_RECOVERY:
        return <TriggerAccountRecovery />;
      default:
        return <ConnectWallets />;
    }
  };

  if (stepsContext?.step) {
    if (isBurnerWalletCreating) {
      return <>Loading...</>;
    }

    if (selectedFlow === "SAFE_WALLET" || selectedFlow === "WALLET_RECOVERY") {
      return (
        <FlowContext.Provider value={selectedFlow}>
          <Web3Provider>{renderBody()}</Web3Provider>
        </FlowContext.Provider>
      );
    }

    return (
      <BurnerWalletProvider config={burnerWalletConfig}>
        {renderBody()}
      </BurnerWalletProvider>
    );
  }

  return (
    <div style={{ display: "flex", gap: "2rem" }}>
      <Button onClick={() => handleClick("SAFE_WALLET")}>
        Safe Wallet Flow
      </Button>
      <Button onClick={() => handleClick("BURNER_WALLET")}>
        Burner Wallet Flow
      </Button>
      <Button onClick={() => handleClick("WALLET_RECOVERY")}>
        Recover Wallet Flow
      </Button>
    </div>
  );
};

export default StepSelection;

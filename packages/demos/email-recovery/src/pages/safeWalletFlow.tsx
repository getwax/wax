import { createContext, useContext, useState } from "react";
import { StepsContext } from "../App";
import { actionType } from "../types";
import ConnectWallets from "../components/ConnectWallets";
import EnableSafeModule from "../components/EnableSafeModule";
import GuardianSetup from "../components/GuardianSetup";
import RequestedRecoveries from "../components/RequestedRecoveries";
import TriggerAccountRecovery from "../components/TriggerAccountRecovery";
import { STEPS } from "../constants";
import { Web3Provider } from "../providers/Web3Provider";

export const FlowContext = createContext(null);

const SafeWalletFlow = () => {
  const stepsContext = useContext(StepsContext);
  const [selectedFlow, setSelectedFlow] = useState<actionType | null>();
  const [isBurnerWalletCreating, setIsBurnerWalletCreating] = useState(false);
  const [burnerWalletConfig, setBurnerWalletConfig] = useState();

  const renderBody = () => {
    switch (stepsContext?.step) {
      // case STEPS.STEP_SELECTION:
      //   return <StepSelection />;
      case STEPS.CONNECT_WALLETS:
        return <ConnectWallets />;
      case STEPS.SAFE_MODULE_RECOVERY:
        return <EnableSafeModule />;
      case STEPS.REQUEST_GUARDIAN:
        return <GuardianSetup />;
      case STEPS.REQUESTED_RECOVERIES:
        return <RequestedRecoveries />;
      case STEPS.TRIGGER_ACCOUNT_RECOVERY:
        return <TriggerAccountRecovery />;
      default:
        return <ConnectWallets />;
    }
  };

  return (
    <Web3Provider>
      <div className="app">{renderBody()}</div>
    </Web3Provider>
  );
};

export default SafeWalletFlow;

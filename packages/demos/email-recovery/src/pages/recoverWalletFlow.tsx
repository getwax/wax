import { useContext, useState } from "react";
import ConnectWallets from "../components/ConnectWallets";
import RequestedRecoveries from "../components/RequestedRecoveries";
import TriggerAccountRecovery from "../components/TriggerAccountRecovery";
import { STEPS } from "../constants";
import { StepsContext } from "../App";
import { Web3Provider } from "../providers/Web3Provider";

const RecoverWalletFlow = () => {
  const stepsContext = useContext(StepsContext);
  const [selectedFlow, setSelectedFlow] = useState<actionType | null>();
  const [isBurnerWalletCreating, setIsBurnerWalletCreating] = useState(false);
  const [burnerWalletConfig, setBurnerWalletConfig] = useState();

  const renderBody = () => {
    switch (stepsContext?.step) {
      case STEPS.REQUESTED_RECOVERIES:
        return <RequestedRecoveries />;
      case STEPS.TRIGGER_ACCOUNT_RECOVERY:
        return <TriggerAccountRecovery />;
      default:
        return <RequestedRecoveries />;
    }
  };

  return (
    <Web3Provider>
      <div className="app">{renderBody()}</div>
    </Web3Provider>
  );
};

export default RecoverWalletFlow;

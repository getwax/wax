import { createContext, useEffect, useState } from "react";
import "./App.css";
import ConnectWallets from "./components/ConnectWallets";
import Navbar from "./components/Navbar";
import RequestedRecoveries from "./components/RequestedRecoveries";
import RequestGuardian from "./components/RequestGuardian";
import SafeModuleRecovery from "./components/SafeModuleRecovery";
import TriggerAccountRecovery from "./components/TriggerAccountRecovery";
import { STEPS } from "./constants";
import { Web3Provider } from "./providers/Web3Provider";
import { ConnectKitButton } from "connectkit";
import { useAccount } from "wagmi";
import { AppContextProvider } from "./context/AppContextProvider";

export const StepsContext = createContext(null);

function App() {
  const [step, setStep] = useState(STEPS.CONNECT_WALLETS);

  const renderBody = () => {
    switch (step) {
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

  return (
    <Web3Provider>
      <AppContextProvider>
        <StepsContext.Provider
          value={{
            setStep,
          }}
        >
          <div className="app">
            <Navbar />
            <h1>Safe Email Recovery Demo</h1>
            {renderBody()}
          </div>
        </StepsContext.Provider>{" "}
      </AppContextProvider>
    </Web3Provider>
  );
}

export default App;

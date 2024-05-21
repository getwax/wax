import { Button } from "./Button";
import walletIcon from "../assets/wallet.svg";
import { ConnectKitButton } from "connectkit";
import { useAccount } from "wagmi";
import { useContext } from "react";
import { StepsContext } from "../App";
import { STEPS } from "../constants";

const ConnectWallets = () => {
  const { address } = useAccount();
  const stepsContext = useContext(StepsContext);

  if (address) {
    console.log(stepsContext, address, "inside useeffect");
    stepsContext?.setStep(STEPS.SAFE_MODULE_RECOVERY);
  }

  return (
    <div className="connect-wallets-container">
      <ConnectKitButton.Custom>
        {({ show }) => {
          return (
            <Button onClick={show} endIcon={<img src={walletIcon} />}>
              Connect Safe
            </Button>
          );
        }}
      </ConnectKitButton.Custom>
    </div>
  );
};

export default ConnectWallets;

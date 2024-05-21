import { useState } from "react";
import { Web3Provider } from "../providers/Web3Provider";
import { ConnectKitButton } from "connectkit";
import { Button } from "./Button";
import cancelRecoveryIcon from "../assets/cancelRecoveryIcon.svg";
import completeRecoveryIcon from "../assets/completeRecoveryIcon.svg";

const BUTTON_STATES = {
  CANCEL_RECOVERY: "Cancel Recovery",
  COMPLETE_RECOVERY: "Complete Recovery",
};

const TriggerAccountRecovery = () => {
  const isMobile = window.innerWidth < 768;

  const [guardianEmail, setGuardianEmail] = useState("");
  const [newWalletAddress, setNewWalletAddress] = useState("");
  const [buttonState, setButtonState] = useState(BUTTON_STATES.CANCEL_RECOVERY);

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
          Triggered Account Recoveries:
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
                  value={guardianEmail}
                  onChange={(e) => setGuardianEmail(e.target.value)}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  width: isMobile ? "90%" : "45%",
                }}
              >
                <p>Safe Address</p>
                <input
                  style={{ width: "100%" }}
                  type="email"
                  value={guardianEmail}
                  onChange={(e) => setGuardianEmail(e.target.value)}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  width: isMobile ? "90%" : "45%",
                }}
              >
                <p>New Wallet Address</p>
                <input
                  style={{ width: "100%" }}
                  type="email"
                  value={newWalletAddress}
                  onChange={(e) => setNewWalletAddress(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>
        <div style={{ margin: "auto" }}>
          <Button
            endIcon={
              buttonState === BUTTON_STATES.CANCEL_RECOVERY ? (
                <img src={cancelRecoveryIcon} />
              ) : (
                <img src={completeRecoveryIcon} />
              )
            }
          >
            {buttonState === BUTTON_STATES.CANCEL_RECOVERY
              ? "Cancel "
              : "Complete"}
            Recovery
          </Button>
        </div>
      </div>
  );
};

export default TriggerAccountRecovery;

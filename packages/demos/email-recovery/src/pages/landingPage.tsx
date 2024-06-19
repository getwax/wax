import { useNavigate } from "react-router-dom";
import { Button } from "../components/Button";

type actionType = "SAFE_WALLET" | "BURNER_WALLET" | "WALLET_RECOVERY";

const LandingPage = () => {
  const navigate = useNavigate();

  const handleClick = async (action: actionType) => {
    switch (action) {
      case "SAFE_WALLET":
        return navigate("/safe-wallet");
      case "BURNER_WALLET":
        return navigate("/burner-wallet");
      case "WALLET_RECOVERY":
        return navigate("/wallet-recovery");
      default:
        console.log(action);
        break;
    }
  };
  return (
    <div className="app">
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
    </div>
  );
};

export default LandingPage;

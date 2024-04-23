import { getDefaultConfig } from "connectkit";
import { baseSepolia } from "viem/chains";
import { createConfig } from "wagmi";

// TODO Consider https://wagmi.sh/core/api/connectors/safe
export const config = createConfig(
    getDefaultConfig({
      chains: [baseSepolia], // TODO Update with non-public prc endpoint
      walletConnectProjectId: import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID,
      appName: "Safe Email Recovery Demo",
      appDescription: "Safe Email Recovery Demo",
      appUrl: window.location.origin, 
      appIcon: "https://i.imgur.com/46VRTCF.png",
    }),
  );
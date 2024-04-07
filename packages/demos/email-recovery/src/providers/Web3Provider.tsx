import { ReactNode } from "react";
import { WagmiProvider, createConfig } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConnectKitProvider, getDefaultConfig } from "connectkit";

const connectKitOptions = {
    walletConnectName: 'WalletConnect',
    hideNoWalletCTA: true,
};

// TODO Consider https://wagmi.sh/core/api/connectors/safe
const config = createConfig(
  getDefaultConfig({
    chains: [baseSepolia], // TODO Update with non-public prc endpoint
    walletConnectProjectId: import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID,
    appName: "Safe Email Recovery Demo",
    appDescription: "Safe Email Recovery Demo",
    appUrl: window.location.origin, 
    appIcon: "https://i.imgur.com/46VRTCF.png",
  }),
);

const queryClient = new QueryClient();

export const Web3Provider = ({ children }: { children: ReactNode }) => {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ConnectKitProvider options={connectKitOptions}>
            {children}
        </ConnectKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
};
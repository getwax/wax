import { WagmiProvider, createConfig, http } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConnectKitProvider, getDefaultConfig } from "connectkit";

const connectKitOptions = {
    walletConnectCTA: 'both',
    walletConnectName: 'WalletConnect',
    hideNoWalletCTA: true,
};

const config = createConfig(
  getDefaultConfig({
    chains: [baseSepolia],
    transports: {
      [baseSepolia.id]: http(
        'https://sepolia.base.org', // TODO Update with non-public prc endpoint
      ),
    },
    walletConnectProjectId: import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID,
    appName: "Safe Email Recovery Demo",
    appDescription: "Safe Email Recovery Demo",
    appUrl: window.location.origin, 
    appIcon: "https://i.imgur.com/46VRTCF.png",
  }),
);

const queryClient = new QueryClient();

export const Web3Provider = ({ children }) => {
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
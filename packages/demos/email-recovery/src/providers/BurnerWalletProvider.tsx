import { ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConnectKitProvider } from "connectkit";

const connectKitOptions = {
  walletConnectName: "WalletConnect",
  hideNoWalletCTA: true,
};

const queryClient = new QueryClient();

export const BurnerWalletProvider = ({ children, config }: { children: ReactNode, config: any }) => {

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

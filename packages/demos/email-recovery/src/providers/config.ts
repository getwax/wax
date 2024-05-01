import { getDefaultConfig } from "connectkit";
import { baseSepolia } from "viem/chains";
import { createConfig, custom } from "wagmi";

import { ethers } from "ethers";
import { EthersAdapter } from "@safe-global/protocol-kit";

import { SafeFactory } from "@safe-global/protocol-kit";

const RPC_URL = "https://sepolia.base.org";
const provider = new ethers.JsonRpcProvider(RPC_URL);

const OWNER_1_PRIVATE_KEY=import.meta.env.VITE_OWNER_1_PRIVATE_KEY

const owner1Signer = new ethers.Wallet(
  OWNER_1_PRIVATE_KEY,
  provider
);

const ethAdapterOwner1 = new EthersAdapter({
  ethers,
  signerOrProvider: owner1Signer,
});

const createSafe = async () => {
  const safeFactory = await SafeFactory.create({
    ethAdapter: ethAdapterOwner1,
    
  });

  const safeAccountConfig = {
    owners: [
      await owner1Signer.getAddress(),
    ],
    threshold: 1,
  };

  const protocolKitOwner1 = await safeFactory.deploySafe({ safeAccountConfig, saltNonce: Date.now().toString()});

  const safeAddress = await protocolKitOwner1.getAddress();

  console.log(`Safe address ${safeAddress}`);
};

createSafe();

// TODO Consider https://wagmi.sh/core/api/connectors/safe
export const config = createConfig(
    getDefaultConfig({
      chains: [baseSepolia], // TODO Update with non-public prc endpoint
      walletConnectProjectId: import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID,
      appName: "Safe Email Recovery Demo",
      appDescription: "Safe Email Recovery Demo",
      appUrl: window.location.origin, 
      appIcon: "https://i.imgur.com/46VRTCF.png",
      transports: {
        [84532]: custom(ethAdapterOwner1.getProvider()) 
      }
    }),
  );
import { getDefaultConfig } from "connectkit";
import { baseSepolia } from "viem/chains";
import { createConfig } from "wagmi";

import { ethers, BrowserProvider } from "ethers";
import { EthersAdapter, SafeFactory } from "@safe-global/protocol-kit";
import { injected } from "wagmi/connectors";

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

const eip1173Wrapper = {
  ...provider,
  request: ({ method, params }: { method: string, params?: Array<any> | Record<string, any> }): Promise<any> => {
    return provider.send(method, params ?? []);
  }
}
const browserProvider = new BrowserProvider(eip1173Wrapper);

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

const connectors = [injected({
  target: {
      // TODO What does this need to be?
    id: "TODO",
    name: 'Safe Burner Wallet',
    // TODO This should be the correct construct to pass here,
    // why still typing errors?
    provider: browserProvider as any,
  },
})]

// TODO Consider https://wagmi.sh/core/api/connectors/safe
export const config = createConfig(
    getDefaultConfig({
      chains: [baseSepolia], // TODO Update with non-public prc endpoint
      walletConnectProjectId: import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID,
      appName: "Safe Email Recovery Demo",
      appDescription: "Safe Email Recovery Demo",
      appUrl: window.location.origin, 
      appIcon: "https://i.imgur.com/46VRTCF.png",
      connectors,
    }),
  );
  
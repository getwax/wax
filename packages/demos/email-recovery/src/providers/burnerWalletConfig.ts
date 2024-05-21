import { getDefaultConfig } from "connectkit";
import { baseSepolia } from "viem/chains";
import { createConfig, custom } from "wagmi";

import { ethers, BrowserProvider } from "ethers";
import { SafeFactory, SafeProvider } from "@safe-global/protocol-kit";
// import { EthersAdapter, SafeFactory } from "@safe-global/protocol-kit";
import { injected } from "wagmi/connectors";
import {
  createClient,
  createWalletClient,
  publicActions,
  walletActions,
} from "viem";

const RPC_URL = "https://sepolia.base.org";
const provider = new ethers.JsonRpcProvider(RPC_URL);

const OWNER_1_PRIVATE_KEY = import.meta.env.VITE_OWNER_1_PRIVATE_KEY;

const owner1Signer = new ethers.Wallet(OWNER_1_PRIVATE_KEY, provider);

// const ethAdapterOwner1 = new EthersAdapter({
//   ethers,
//   signerOrProvider: owner1Signer,
// });

const eip1173Wrapper = {
  ...provider,
  request: ({
    method,
    params,
  }: {
    method: string;
    params?: Array<any> | Record<string, any>;
  }): Promise<any> => {
    return provider.send(method, params ?? []);
  },
};
const browserProvider = new BrowserProvider(eip1173Wrapper);

export const createBurnerSafeConfig = async () => {
  const safeFactory = await SafeFactory.create({
    provider: eip1173Wrapper,
    signer: OWNER_1_PRIVATE_KEY,
  });

  const safeAccountConfig = {
    owners: [await owner1Signer.getAddress()],
    threshold: 1,
  };

  const protocolKitOwner1 = await safeFactory.deploySafe({
    safeAccountConfig,
    saltNonce: Date.now().toString(),
  });

  const safeAddress: `0x${string}` = await protocolKitOwner1.getAddress();

  console.log(`Safe address ${safeAddress}`);
  // const clientObj = await createClient(safeAddress);
  const clientObj = await createClient({
    account: safeAddress,
    transport: custom({
      async request({ method, params }) {
        eip1173Wrapper.request({ method, params });
      },
    }),
  })
    .extend(publicActions)
    .extend(walletActions);

  const connectors = [
    injected({
      target: {
        // TODO What does this need to be?
        id: "TODO",
        name: "Safe Burner Wallet",
        icon: "https://i.imgur.com/46VRTCF.png",
        // TODO This should be the correct construct to pass here,
        // why still typing errors?
        provider: safeFactory.getSafeProvider(),
      },
    }),
  ];

  // const config = createConfig({
  //   chains: [baseSepolia],
  //   // connectors,
  //   multiInjectedProviderDiscovery: true,
  //   // walletConnectProjectId: import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID,
  //   client({ chain }) {
  //     // return createWalletClient({
  //     //   chain: baseSepolia,
  //     //   account: safeAddress,

  //     //   transport: custom({
  //     //     async request({ method, params }) {
  //     //       eip1173Wrapper.request({ method, params });
  //     //     },
  //     //   }),
  //     // });
  //     return createClient({
  //       chain,
  //       account: safeAddress,
  //       transport: custom({
  //         async request({ method, params }) {
  //           eip1173Wrapper.request({ method, params });
  //         },
  //       }),
  //     })
  //       .extend(publicActions)
  //       .extend(walletActions);
  //   },
  // });

  // return { config, clientObj };

  const config = createConfig(
    getDefaultConfig({
      chains: [baseSepolia], // TODO Update with non-public prc endpoint
      walletConnectProjectId: import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID,
      appName: "Safe Email Recovery Demo",
      appDescription: "Safe Email Recovery Demo",
      appUrl: window.location.origin,
      appIcon: "https://i.imgur.com/46VRTCF.png",
      multiInjectedProviderDiscovery: true,
      connectors,
      // client({ chain }) {
      //   return createClient({
      //     account: safeAddress,
      //     chain,
      //     transport: custom({
      //       async request({ method, params }) {
      //         eip1173Wrapper.request({ method, params });
      //       },
      //     }),
      //   })
      //     .extend(publicActions)
      //     .extend(walletActions);
      // },
    })
  );

  return config;
};

// const createClient = async (accountAddress: `0x{string}`) => {
//   console.log("Creating client");
//   const client = await createClient(accountAddress).extend(publicActions, walletActions)
//   // const client = await createWalletClient({
//   //   // chain: baseSepolia,
//   //   account: accountAddress,

//   //   transport: custom({
//   //     async request({ method, params }) {
//   //       eip1173Wrapper.request({ method, params });
//   //     },
//   //   }),
//   // });
//   console.log(" client", client);

//   return client;
// };

// const config = createBurnerSafeConfig();

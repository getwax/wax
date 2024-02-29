// config.template.ts is tracked in git
// config.ts is not tracked in git
//
// This allows us to track the starting recommendations for the config without
// getting mixed up with local preferences.
//
// If config.ts doesn't yet exist, it will be created as a copy of the template
// during `yarn setup`.

import { hardhat } from "viem/chains";
import ConfigType from "./ConfigType";

const config: ConfigType = {
    emailPollingInterval: 8000,
    healthCheckPort: 3001,
    imapClient: {
        host: "imap.gmail.com",
        port: 993,
        secure: true,
        auth: {
            user: "yourEmailAddress",
            pass: "yourEmailPassword",
        },
        logger: false,
    },
    smtpClient: {
        service: "gmail",
        port: 587,
        secure: true,
        auth: {
            user: "yourEmailAddress",
            pass: "yourEmailPassword",
        },
    },
    viem: {
        networks: {
            hardhat: {
                chain: hardhat,
                mnenmonic:
                    "test test test test test test test test test test test junk",
                path: "m/44'/60'/0'/0/3",
            },
            zkSyncEraInMemory: {
                chain: {
                    id: 260,
                    name: "zk sync era in-memory node",
                    nativeCurrency: {
                        decimals: 18,
                        name: "Ether",
                        symbol: "ETH",
                    },
                    rpcUrls: {
                        default: {
                            http: ["http://127.0.0.1:8011"],
                        },
                    },
                },
                mnenmonic:
                    "crumble clutch mammal lecture lazy broken nominee visit gentle gather gym erupt",
                path: undefined,
            },
        },
    },
};

export default config;

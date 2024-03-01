import { Logger } from "imapflow";
import { Chain } from "viem";

type ConfigType = {
    emailPollingInterval: number;
    healthCheckPort: number;
    imapClient: {
        host: string;
        port: number;
        secure: boolean;
        auth: {
            user: string;
            pass: string;
        };
        logger: false | Logger | undefined;
    };
    smtpClient: {
        service: string;
        port: number;
        secure: boolean;
        auth: {
            user: string;
            pass: string;
        };
    };
    viem: {
        networks: {
            hardhat: {
                chain: Chain;
                mnenmonic: string;
                path: `m/44'/60'/${string}` | undefined;
            };
            zkSyncSepoliaTestnet: {
                chain: Chain;
                mnenmonic: string;
                path: `m/44'/60'/${string}` | undefined;
            };
            zkSyncEraInMemory: {
                chain: Chain;
                mnenmonic: string;
                path: `m/44'/60'/${string}` | undefined;
            };
        };
    };
};

export default ConfigType;

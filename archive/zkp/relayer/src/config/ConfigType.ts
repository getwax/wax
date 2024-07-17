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
        chain: Chain;
        mnenmonic: string;
    };
};

export default ConfigType;

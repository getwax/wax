import { ImapFlowOptions } from "imapflow";
import { Chain } from "viem";

type ConfigType = {
    emailPollingInterval: number;
    healthCheckPort: number;
    imapClient: ImapFlowOptions;
    viem: {
        chain: Chain;
        mnenmonic: string;
    };
};

export default ConfigType;

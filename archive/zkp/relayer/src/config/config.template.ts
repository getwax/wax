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
        chain: hardhat,
        mnenmonic:
            "test test test test test test test test test test test junk",
    },
};

export default config;

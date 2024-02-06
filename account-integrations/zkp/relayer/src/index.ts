import express from "express";
import { createPublicClient, createWalletClient, http } from "viem";
import { mnemonicToAccount } from "viem/accounts";
import Database from "better-sqlite3";
import EventEmitter from "node:events";
import config from "./config/config";
import ImapClient from "./lib/imapClient";
import router from "./routes/healthCheck";
import EmailService from "./services/emailService";
import EthereumService from "./services/ethereumService";
import EmailTable from "./tables/emailTable";

const app = express();

const main = async () => {
    const account = mnemonicToAccount(config.viem.mnenmonic, {
        // hardhat account #3
        path: "m/44'/60'/0'/0/3",
    });

    const imapClient = new ImapClient(config.imapClient);
    const ethPublicClient = createPublicClient({
        chain: config.viem.chain,
        transport: http(),
    });
    const ethWalletClient = createWalletClient({
        account: account,
        chain: config.viem.chain,
        transport: http(),
    });

    const dbOptions = {};
    const db = new Database("relayer.db", dbOptions);
    db.pragma("journal_mode = WAL"); // recommended by better-sqlite3

    const eventEmitter = new EventEmitter();

    const emailTable = new EmailTable(db);
    const ethereumService = new EthereumService(
        ethPublicClient,
        ethWalletClient,
        emailTable
    );
    const emailService = new EmailService(
        imapClient,
        ethereumService,
        emailTable,
        config.emailPollingInterval,
        eventEmitter
    );

    await emailService.start();

    process.once("SIGINT", async () => {
        await emailService.stop();
        process.exit(0);
    });

    app.use(router);

    app.listen(config.healthCheckPort, () => {
        console.log(
            `Health check running at http://localhost:${config.healthCheckPort}`
        );
    });
};

main().catch((error) => {
    console.log("Error occured running relayer", error);
    process.exit(1);
});

import express from "express";
import { createPublicClient, createWalletClient, http } from "viem";
import { mnemonicToAccount } from "viem/accounts";
import Database from "better-sqlite3";
import EventEmitter from "node:events";
import nodemailer from "nodemailer";
import config from "./config/config";
import ImapClient from "./lib/imapClient";
import router from "./routes/healthCheck";
import EmailService from "./services/emailService";
import EthereumService from "./services/ethereumService";
import EmailTable from "./tables/emailTable";
import SmtpClient from "./lib/smtpClient";

const app = express();

const main = async () => {
    const network = getNetwork(process.env.NETWORK);

    const account = network.path
        ? mnemonicToAccount(network.mnenmonic, {
              path: network.path,
          })
        : mnemonicToAccount(network.mnenmonic);

    const imapClient = new ImapClient(config.imapClient);

    const transporter = nodemailer.createTransport(config.smtpClient);
    transporter.verify((error) => {
        if (error) {
            console.error(
                "An error occured verifying the SMTP configuration:",
                error
            );
        } else {
            console.log("SMTP configuration verified");
        }
    });

    const smtpClient = new SmtpClient(transporter, config.smtpClient.auth.user);
    const ethPublicClient = createPublicClient({
        chain: network.chain,
        transport: http(),
    });
    const ethWalletClient = createWalletClient({
        account: account,
        chain: network.chain,
        transport: http(),
    });

    const dbOptions = {};
    const db = new Database("relayer.db", dbOptions);
    db.pragma("journal_mode = WAL"); // recommended by better-sqlite3

    const eventEmitter = new EventEmitter();

    const emailTable = new EmailTable(db);
    const ethereumService = new EthereumService(
        ethPublicClient,
        ethWalletClient
    );
    const emailService = new EmailService(
        imapClient,
        smtpClient,
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

const getNetwork = (network: string | undefined) => {
    switch (network) {
        case "hardhat":
            return config.viem.networks.hardhat;
        case "zksync":
            return config.viem.networks.zkSyncEraInMemory;
        default:
            return config.viem.networks.hardhat;
    }
};

main().catch((error) => {
    console.error("Error occured running relayer", error);
    process.exit(1);
});

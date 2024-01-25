import { ImapFlowOptions } from 'imapflow';
import express from 'express';
import { createPublicClient, createWalletClient, http } from 'viem';
import { hardhat } from 'viem/chains';
import { mnemonicToAccount } from 'viem/accounts';
import Database from "better-sqlite3";
import EventEmitter from 'node:events';
import config from "./config/config";
import ImapClient from './lib/imapClient';
import router from './routes/healthCheck';
import EmailService from './services/emailService';
import EthereumService from './services/ethereumService';
import EmailTable from './tables/emailTable';

const imapConfig: ImapFlowOptions = {
  ...config,
  logger: false
}

const viemConfig = {
    // FIXME: add config
    // chain
    // mnenmonic
}

const app = express();
const port = 3001;

const main = async () => {

  const account = mnemonicToAccount(
    'test test test test test test test test test test test junk',
    {
      // hardhat account #3
      path: "m/44'/60'/0'/0/3"
    }
  );

  const imapClient = new ImapClient(imapConfig);
  const ethPublicClient = createPublicClient({ 
    chain: hardhat, 
    transport: http(), 
  });
  const ethWalletClient = createWalletClient({
    account: account,
    chain: hardhat,
    transport: http()
  });

  const dbOptions = {};
  const db = new Database("relayer.db", dbOptions);
  db.pragma("journal_mode = WAL"); // recommended by better-sqlite3

  const eventEmitter = new EventEmitter();

  const emailTable = new EmailTable(db);
  const ethereumService = new EthereumService(ethPublicClient, ethWalletClient, emailTable, eventEmitter);
  const emailService = new EmailService(imapClient, ethereumService, emailTable, 5000, eventEmitter);

  await emailService.start();

  process.once('SIGINT', async () => {
    await emailService.stop();
    process.exit(0);
  });

  app.use(router);
    
  app.listen(port, () => {
      console.log(`Health check running at http://localhost:${port}`);
  });
}

main().catch(error => {
  console.log("Error occured running relayer", error);
  process.exit(1);
});
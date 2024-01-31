import { ImapFlowOptions } from 'imapflow';
import config from "./config/config";
import startExpressServer from './server/server';
import ImapClient from './imap/imapClient';

const imapConfig: ImapFlowOptions = {
  ...config,
  logger: false
}

const main = async () => {
  const imapClient = new ImapClient(imapConfig, 5000);

  process.once('SIGINT', async () => {
    await imapClient.stop();
    process.exit(0);
  });

  startExpressServer();

  console.log('Starting imap client');
  await imapClient.start();
}

main().catch(error => {
  console.log("Error occured running relayer", error);
  process.exit(1);
});
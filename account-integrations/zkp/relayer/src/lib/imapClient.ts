import { ImapFlow, ImapFlowOptions } from "imapflow";

class ImapClient {
    public imapConfig: ImapFlowOptions;

    constructor(imapConfig: ImapFlowOptions) {
        this.imapConfig = imapConfig;
    }

    public async fetchEmails() {
        const imapClient = new ImapFlow(this.imapConfig);
        await imapClient.connect();

        const lock = await imapClient.getMailboxLock("INBOX");

        const emails = [];
        try {
            for await (const message of imapClient.fetch(
                { seen: false },
                { headers: true, envelope: true }
            )) {
                if (!message.envelope.sender[0].address) {
                    console.log("No sender found");
                    continue;
                }
                emails.push({
                    headers: message.headers,
                    sender: message.envelope.sender[0].address,
                    subject: message.envelope.subject,
                });
            }

            await imapClient.messageFlagsSet({ seen: false }, ["\\Seen"]);
        } finally {
            lock.release();
        }

        await imapClient.logout();
        return emails;
    }
}

export default ImapClient;

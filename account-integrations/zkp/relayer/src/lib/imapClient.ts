import { ImapFlow, ImapFlowOptions } from "imapflow";

type EmailResponse = {
    headers: Buffer,
    sender: string,
    subject: string,
}

class ImapClient {
    private imapClient: ImapFlow;

    constructor(imapConfig: ImapFlowOptions) {
        this.imapClient = new ImapFlow(imapConfig);
    }

    public async start(): Promise<void> {
        await this.imapClient.connect();
    };

    public async stop(): Promise<void> {
        await this.imapClient.logout();
    };

    public async fetchEmails(): Promise<Array<EmailResponse>> {
        const lock = await this.imapClient.getMailboxLock('INBOX');
        const emails = new Array<EmailResponse>
        try {
            for await (const message of this.imapClient.fetch({ seen:  false }, { headers: true, envelope: true, source: true, bodyStructure: true, flags: true })) {
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

            await this.imapClient.messageFlagsSet({seen: false}, ['\\Seen']);
        } catch (error) {
            console.error("Error fetching emails:", error)
        } finally {
            lock.release();
            return emails;
        }
    }
}


export default ImapClient
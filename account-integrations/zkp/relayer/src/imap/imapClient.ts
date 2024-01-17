import { ImapFlow, ImapFlowOptions } from "imapflow";

class ImapClient {
    private imapClient: ImapFlow;
    private readonly pollingInterval: number;

    constructor(imapConfig: ImapFlowOptions, pollingInterval: number) {
        this.imapClient = new ImapFlow(imapConfig);
        this.pollingInterval = pollingInterval;
    }

    public async start(): Promise<void> {
        await this.imapClient.connect();
        this.pollEmails();
    };

    public async stop(): Promise<void> {
        await this.imapClient.logout();
    };

    private async pollEmails(): Promise<void> {
        while (true) {
            await this.fetchEmails();
            await new Promise(resolve => setTimeout(resolve, this.pollingInterval));
        }
    }

    private async fetchEmails() {
        const lock = await this.imapClient.getMailboxLock('INBOX');
        try {
            for await (const message of this.imapClient.fetch('1:*', { envelope: true })) {
                console.log(`${message.uid}: ${message.envelope.subject}`);
            }
        } catch (error) {
            console.error("Error fetching emails:", error)
        } finally {
            lock.release();
        }
    }
}


export default ImapClient
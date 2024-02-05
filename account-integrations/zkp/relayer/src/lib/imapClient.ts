import { ImapFlow, ImapFlowOptions } from "imapflow";

class ImapClient {
    public imapClient: ImapFlow;

    constructor(imapClientConfig: ImapFlowOptions) {
        this.imapClient = new ImapFlow(imapClientConfig);
    }

    public async start() {
        await this.imapClient.connect();
    }

    public async stop() {
        await this.imapClient.logout();
    }

    public async fetchEmails() {
        const lock = await this.imapClient.getMailboxLock("INBOX");

        const emails = [];
        try {
            // For some reason calling .status() seems to "refresh" the inbox so that
            // new emails can be detected. Without this line, new emails are not detected.
            const mailbox = await this.imapClient.status("INBOX", {
                unseen: true,
            });

            if (mailbox.unseen && mailbox.unseen > 0) {
                const messages = this.imapClient.fetch(
                    { seen: false },
                    { headers: true, envelope: true }
                );

                for await (const message of messages) {
                    if (!message.envelope.sender[0].address) {
                        console.log("No sender found");
                        continue;
                    }
                    emails.push({
                        uid: message.uid,
                        headers: message.headers,
                        sender: message.envelope.sender[0].address,
                        subject: message.envelope.subject,
                    });
                }

                if (emails.length > 0) {
                    const uids = emails.map((email) => email.uid).join(",");
                    console.log("uids:", uids);
                    await this.imapClient.messageFlagsSet(`${uids}`, [
                        "\\Seen",
                    ]);
                }
            }
        } finally {
            lock.release();
        }

        return emails;
    }
}

export default ImapClient;

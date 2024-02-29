import { EventEmitter } from "node:events";
import { Address } from "viem";
import ImapClient from "../lib/imapClient";
import SmtpClient from "../lib/smtpClient";
import EmailTable, { Email, EmailStatus } from "../tables/emailTable";
import EthereumService, { InitiateRecoveryResult } from "./ethereumService";
import extractAccountAddress from "../utils/extractAccountAddress";
import extractNewOwner from "../utils/extractNewOwner";
import extractRecoveryPluginAddress from "../utils/extractRecoveryPluginAddress";

export default class EmailService {
    private running = false;

    constructor(
        private imapClient: ImapClient,
        private smtpClient: SmtpClient,
        private ethereumService: EthereumService,
        private emailTable: EmailTable,
        private pollingInterval: number,
        private eventEmitter: EventEmitter
    ) {
        this.eventEmitter.on("email(s) saved", () => this.processEmails());
    }

    public async start() {
        this.running = true;
        await this.pollEmails();
    }

    public async stop() {
        this.running = false;
        await this.imapClient.stop();
    }

    private async pollEmails(): Promise<void> {
        await this.imapClient.start();

        while (this.running) {
            const emails = await this.imapClient.fetchEmails();
            console.log(`Received ${emails.length} emails`);

            // TODO: (merge-ok) handle duplicate emails
            if (emails.length > 0) {
                for (const email of emails) {
                    this.emailTable.insert({
                        headers: email.headers,
                        subject: email.subject,
                        sender: email.sender,
                        status: EmailStatus.PENDING,
                    });
                }
                this.eventEmitter.emit("email(s) saved");
            }

            await new Promise((resolve) =>
                setTimeout(resolve, this.pollingInterval)
            );
        }
    }

    private async processEmails() {
        const emails = this.emailTable.findEligible();

        for (let i = 0; i < emails.length; i++) {
            const { accountAddress, newOwner, recoveryPluginAddress } =
                await this.extractSubjectValues(emails[i]);

            if (!accountAddress) {
                this.emailTable.update({
                    ...emails[i],
                    status: EmailStatus.FAILED,
                });
                console.log("Invalid or no account address in email subject");
                continue;
            }
            if (!newOwner) {
                this.emailTable.update({
                    ...emails[i],
                    status: EmailStatus.FAILED,
                });
                console.log("Invalid or no new owner in email subject");
                continue;
            }
            if (!recoveryPluginAddress) {
                this.emailTable.update({
                    ...emails[i],
                    status: EmailStatus.FAILED,
                });
                console.log("Invalid or no plugin address in email subject");
                continue;
            }

            const emailDomain = "google.com";
            const { a, b, c } = await this.generateProof(emails[i]);

            console.log("emails[i]:", emails[i]);
            const initiateRecoveryResult = await this.initiateRecovery(
                emails[i],
                accountAddress,
                newOwner,
                recoveryPluginAddress,
                emailDomain,
                a,
                b,
                c
            );

            await this.replyToSender(emails[i].sender, initiateRecoveryResult);
        }
    }

    private async extractSubjectValues(email: Email) {
        const recoveryPluginAddress = extractRecoveryPluginAddress(
            email.subject
        );
        const newOwner = extractNewOwner(email.subject);
        const accountAddress = extractAccountAddress(email.subject);

        return {
            accountAddress,
            newOwner,
            recoveryPluginAddress,
        };
    }

    // TODO: (merge-ok) - mocking this stuff for now to come back to in future PR
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private async generateProof(email: Email) {
        const a: [bigint, bigint] = [BigInt(0), BigInt(0)];
        const b: [[bigint, bigint], [bigint, bigint]] = [
            [BigInt(0), BigInt(0)],
            [BigInt(0), BigInt(0)],
        ];
        const c: [bigint, bigint] = [BigInt(0), BigInt(0)];

        return {
            a,
            b,
            c,
        };
    }

    private async initiateRecovery(
        email: Email,
        accountAddress: Address,
        newOwner: string,
        recoveryPluginAddress: Address,
        emailDomain: string,
        a: [bigint, bigint],
        b: [[bigint, bigint], [bigint, bigint]],
        c: [bigint, bigint]
    ): Promise<InitiateRecoveryResult> {
        // FIXME: gracefully handle correct function call
        const initiateRecoveryResult =
            await this.ethereumService.initiateRecoveryClave(
                accountAddress,
                newOwner,
                recoveryPluginAddress,
                emailDomain,
                a,
                b,
                c
            );

        if ("revertReason" in initiateRecoveryResult) {
            this.emailTable.update({
                ...email,
                status: EmailStatus.FAILED,
            });

            console.error(
                `Could not initiate recovery. ${initiateRecoveryResult.revertReason}`
            );
            return initiateRecoveryResult;
        } else {
            this.emailTable.update({
                ...email,
                status: EmailStatus.PROCESSED,
            });
            console.log(`Recovery initiated by: ${email.sender}`);
            return initiateRecoveryResult;
        }
    }

    private async replyToSender(
        to: string,
        initiateRecoveryResult: InitiateRecoveryResult
    ) {
        await this.smtpClient.sendConfirmationEmail(to, initiateRecoveryResult);
    }
}

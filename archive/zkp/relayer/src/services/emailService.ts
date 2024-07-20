import { EventEmitter } from "stream";
import { Address } from "viem";
import ImapClient from "../lib/imapClient";
import SmtpClient from "../lib/smtpClient";
import EmailTable, { Email, EmailStatus } from "../tables/emailTable";
import EthereumService, { InitiateRecoveryResult } from "./ethereumService";

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
                        status: EmailStatus.PENDING,
                        subject: email.subject,
                        sender: email.sender,
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
            const {
                safeProxyAddress,
                newOwnerAddress,
                recoveryPluginAddress,
                emailDomain,
                a,
                b,
                c,
            } = await this.generateRecoveryArgs(emails[i]);

            const initiateRecoveryResult = await this.initiateRecovery(
                emails[i],
                safeProxyAddress,
                newOwnerAddress,
                recoveryPluginAddress,
                emailDomain,
                a,
                b,
                c
            );

            await this.replyToSender(emails[i].sender, initiateRecoveryResult);
        }
    }

    // TODO: (merge-ok) - mocking this stuff for now to come back to in future PR
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private async generateRecoveryArgs(emails: Email) {
        const safeProxyAddress: Address =
            "0x05d1EE1Ac4151918b9A222CD6e68103aC34b4bcD";
        const newOwnerAddress: Address =
            "0x90F79bf6EB2c4f870365E785982E1f101E93b906";
        const recoveryPluginAddress: Address =
            "0x68B15952EF368a6b5482Abdd7AE6d6CfDa31c752";
        const emailDomain = "google.com";

        const a: [bigint, bigint] = [BigInt(0), BigInt(0)];
        const b: [[bigint, bigint], [bigint, bigint]] = [
            [BigInt(0), BigInt(0)],
            [BigInt(0), BigInt(0)],
        ];
        const c: [bigint, bigint] = [BigInt(0), BigInt(0)];

        return {
            safeProxyAddress,
            newOwnerAddress,
            recoveryPluginAddress,
            emailDomain,
            a,
            b,
            c,
        };
    }

    private async initiateRecovery(
        email: Email,
        safeProxyAddress: Address,
        newOwnerAddress: Address,
        recoveryPluginAddress: Address,
        emailDomain: string,
        a: [bigint, bigint],
        b: [[bigint, bigint], [bigint, bigint]],
        c: [bigint, bigint]
    ): Promise<InitiateRecoveryResult> {
        const initiateRecoveryResult =
            await this.ethereumService.initiateRecovery(
                safeProxyAddress,
                newOwnerAddress,
                recoveryPluginAddress,
                emailDomain,
                a,
                b,
                c
            );

        if ("revertReason" in initiateRecoveryResult) {
            if (
                initiateRecoveryResult.revertReason ===
                "RECOVERY_ALREADY_INITIATED"
            ) {
                this.emailTable.update({
                    ...email,
                    status: EmailStatus.PROCESSED,
                });
            }

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

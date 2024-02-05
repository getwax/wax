import { EventEmitter } from "stream";
import { Address } from "viem";
import ImapClient from "../lib/imapClient";
import SmtpClient from "../lib/smtpClient";
import EmailTable, { Email, EmailStatus } from "../tables/emailTable";
import EthereumService, { InitiateRecoveryResult } from "./ethereumService";

export default class EmailService {
    constructor(
        public imapClient: ImapClient,
        public smtpClient: SmtpClient,
        public ethereumService: EthereumService,
        public emailTable: EmailTable,
        public pollingInterval: number,
        public eventEmitter: EventEmitter
    ) {
        this.eventEmitter.on("email(s) saved", () => this.processEmails());
    }

    public async pollEmails(): Promise<void> {
        // eslint-disable-next-line no-constant-condition
        while (true) {
            const emails = await this.imapClient.fetchEmails();

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

    public async processEmails() {
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
    async generateRecoveryArgs(emails: Email) {
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

    async initiateRecovery(
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

        if (initiateRecoveryResult.success) {
            this.emailTable.update({
                ...email,
                status: EmailStatus.PROCESSED,
            });
            console.log(`Recovery initiated by: ${email.sender}`);
            return initiateRecoveryResult;
        } else {
            if (
                initiateRecoveryResult.message === "RECOVERY_ALREADY_INITIATED"
            ) {
                this.emailTable.update({
                    ...email,
                    status: EmailStatus.PROCESSED,
                });
            }

            console.log(
                `Could not initiate recovery. ${initiateRecoveryResult.message}`
            );
            return initiateRecoveryResult;
        }
    }

    async replyToSender(
        to: string,
        initiateRecoveryResult: InitiateRecoveryResult
    ) {
        await this.smtpClient.sendConfirmateEmail(to, initiateRecoveryResult);
    }
}

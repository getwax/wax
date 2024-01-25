import { EventEmitter } from "stream";
import { Address, ContractFunctionRevertedError, BaseError } from "viem";
import ImapClient from "../lib/imapClient";
import EmailTable, { Email, EmailStatus } from "../tables/emailTable";
import EthereumService from "./ethereumService";

export default class EmailService {
    constructor(
        public imapClient: ImapClient,
        public ethereumService: EthereumService,
        public emailTable: EmailTable,
        public pollingInterval: number,
        public eventEmitter: EventEmitter
    ) {
        this.eventEmitter.on("email(s) saved", () => this.processEmails());
    }

    async start() {
        await this.pollEmails();
    }

    async stop() {
        await this.imapClient.stop();
    }

    public async pollEmails(): Promise<void> {
        await this.imapClient.start();
        // while (true) {
            const emails = await this.imapClient.fetchEmails();

            if (emails.length > 0) {
                for (const email of emails) {
                    this.emailTable.insert({
                        status: EmailStatus.PENDING,
                        subject: email.subject,
                        sender: email.sender
                    });
                }
                this.eventEmitter.emit("email(s) saved");
            }

            // await new Promise(resolve => setTimeout(resolve, this.pollingInterval));
        // }
    }

    public async processEmails() {
        const eligibleEmails = this.emailTable.findEligible();
        // const emails = this.emailTable.findEligible();
        const emails = [eligibleEmails[0]];
        console.log("emails:", emails);

        // TODO: (merge-ok) handle duplicate emails
        for (let i = 0; i < emails.length; i++) {
            // TODO: (merge-ok) - mocking this stuff for now to come back to in future PR
            const { safeProxyAddress, newOwnerAddress, recoveryPluginAddress, emailDomain, a, b, c } = await this.generateRecoveryArgs(emails[0]);

            let success: boolean;
            let errorName: string | undefined;
            try {
                success = await this.ethereumService.initiateRecovery(safeProxyAddress, newOwnerAddress, recoveryPluginAddress, emailDomain, a, b, c);
            } catch (e) {
                // TODO: clean up these nested if statements
                if (e instanceof BaseError) {
                    const revertError = e.walk(e => e instanceof ContractFunctionRevertedError);

                    if (revertError instanceof ContractFunctionRevertedError) {
                        errorName  = revertError.data?.errorName;

                        if (errorName === "RECOVERY_NOT_CONFIGURED") {
                            // TODO: (merge-ok) handle this case
                        }

                        if (errorName === "RECOVERY_ALREADY_INITIATED") {
                            this.emailTable.update({...emails[0], status: EmailStatus.PENDING});
                        }

                        if (errorName === "INVALID_DKIM_KEY_HASH") {
                            // TODO: (merge-ok) handle this case
                        }

                        if (errorName === "INVALID_PROOF") {
                            // TODO: (merge-ok) handle this case
                        }
                    }
                }
                success = false;
            }

            if (success) {
                this.emailTable.update({...emails[0], status: EmailStatus.PROCESSED});
                console.log(`Recovery initiated by: ${emails[0].sender}`);
            } else {
                console.log(`Could not initiate recovery. ${errorName ?? ""}`);
            }
        }
    }

    async generateRecoveryArgs(emails: Email) {
        const safeProxyAddress: Address = "0x05d1EE1Ac4151918b9A222CD6e68103aC34b4bcD";
        const newOwnerAddress: Address = "0x90F79bf6EB2c4f870365E785982E1f101E93b906";
        const recoveryPluginAddress: Address = "0x68B15952EF368a6b5482Abdd7AE6d6CfDa31c752";
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
            c
        }
    }
}
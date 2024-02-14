import { Transporter } from "nodemailer";
import { InitiateRecoveryResult } from "../services/ethereumService";

type Message = {
    from: string;
    to: string;
    subject: string;
    text: string;
};

export default class SmtpClient {
    constructor(
        private transporter: Transporter,
        private relayerEmail: string
    ) {}

    public async sendConfirmationEmail(
        to: string,
        initiateRecoveryResult: InitiateRecoveryResult
    ) {
        let message: Message;
        if ("revertReason" in initiateRecoveryResult) {
            message = this.generateFailureEmail(
                to,
                initiateRecoveryResult.newOwner,
                initiateRecoveryResult.recoveryPlugin,
                initiateRecoveryResult.safeAddress,
                initiateRecoveryResult.revertReason
            );
        } else {
            message = this.generateSuccessEmail(
                to,
                initiateRecoveryResult.newOwner,
                initiateRecoveryResult.recoveryPlugin,
                initiateRecoveryResult.safeAddress,
                initiateRecoveryResult.executeAfter,
                initiateRecoveryResult.blockTimestamp
            );
        }

        try {
            await this.transporter.sendMail(message);
        } catch (error) {
            console.error("Failed to send confirmation email.", error);
        }
    }

    private generateSuccessEmail(
        to: string,
        newOwner: string,
        pluginAddress: string,
        safeAddress: string,
        executeAfter: bigint,
        blockTimestamp: bigint
    ): Message {
        const executeAfterDate = new Date(Number(executeAfter) * 1000);
        const executeAfterUtcDate = executeAfterDate.toUTCString();
        const delay = this.formatDelay(executeAfter, blockTimestamp);

        const subject = "Recovery initiated";
        const text =
            `Recovery was initiated successfully. A new owner has been ` +
            `set to "${newOwner}" for the plugin "${pluginAddress}", on Safe ` +
            `"${safeAddress}". This is a pending request so recovery can only ` +
            `be executed after a pre-determined delay. There is a delay of ${delay}` +
            ` - you can complete recovery after ${executeAfterUtcDate}.`;

        return {
            from: this.relayerEmail,
            to,
            subject,
            text,
        };
    }

    private generateFailureEmail(
        to: string,
        newOwner: string,
        pluginAddress: string,
        safeAddress: string,
        revertReason: string
    ): Message {
        const formattedRevertReason = this.formatRevertReason(revertReason);
        const subject = "Failed to initiate recovery";
        const text =
            `Failed to initiate recovery. The owner on plugin "${pluginAddress}" ` +
            `could not be rotated to new owner "${newOwner}", on Safe ` +
            `"${safeAddress}". ${formattedRevertReason}`;

        return {
            from: this.relayerEmail,
            to,
            subject,
            text,
        };
    }

    private formatRevertReason(revertReason: string): string {
        const errorStringPrefix = "The recovery attempt failed because ";

        let result: string;
        switch (revertReason) {
            case "RECOVERY_NOT_CONFIGURED":
                result =
                    "recovery has not been configured. The owner must configure recovery first before attempting to recover.";
                break;
            case "RECOVERY_ALREADY_INITIATED":
                result =
                    "recovery has already been initiated. Wait for the recovery delay to elapse or cancel the recovery request.";
                break;
            case "INVALID_DKIM_KEY_HASH":
                result =
                    "the DKIM public key hash is invalid. You may need to update the hash or update the DKIM registry the account is querying.";
                break;
            case "INVALID_PROOF":
                result = "the proof is invalid.";
                break;
            default:
                result = "an unknown error as occured.";
        }

        return errorStringPrefix + result;
    }

    private formatDelay(executeAfter: bigint, blockTimestamp: bigint) {
        const delayInSeconds = Number(executeAfter) - Number(blockTimestamp);
        const delayInMinutes = Math.floor(delayInSeconds / 60);
        const delayInHours = Math.floor(delayInSeconds / 60 / 60);
        const delayInDays = Math.floor(delayInSeconds / 60 / 60 / 24);

        const oneMinuteInSeconds = 60;
        const oneHourInSeconds = 3600;
        const oneDayInSeconds = 86400;

        if (delayInSeconds < oneMinuteInSeconds) {
            return `${delayInSeconds} second(s)`;
        }

        const remainingSeconds = delayInSeconds % 60;
        if (delayInSeconds < oneHourInSeconds) {
            return `${delayInMinutes} minute(s), and ${remainingSeconds} second(s)`;
        }

        const remainingMinutes = delayInMinutes % 60;
        if (delayInSeconds < oneDayInSeconds) {
            return `${delayInHours} hour(s), ${remainingMinutes} minute(s), and ${remainingSeconds} second(s)`;
        }

        const remainingHours = delayInHours % 24;
        return `${delayInDays} day(s), ${remainingHours} hour(s), ${remainingMinutes} minute(s), and ${remainingSeconds} second(s)`;
    }
}

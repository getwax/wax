import { Transporter } from "nodemailer";
import { InitiateRecoveryResult } from "../services/ethereumService";

export default class SmtpClient {
    constructor(
        public transporter: Transporter,
        public relayerEmail: string
    ) {}

    public async sendConfirmateEmail(
        to: string,
        initiateRecoveryResult: InitiateRecoveryResult
    ) {
        let subject: string;
        let text: string;
        if (initiateRecoveryResult.success) {
            subject = "Recovery initiated";
            text = "Recovery was initiated successfully";
        } else {
            subject = "Failed to initiate recovery";
            text = "Failed to initiate recovery";
        }

        const message = {
            from: this.relayerEmail,
            to,
            subject,
            text,
        };

        try {
            await this.transporter.sendMail(message);
        } catch (error) {
            console.error("Failed to send confirmation email.", error);
        }
    }
}

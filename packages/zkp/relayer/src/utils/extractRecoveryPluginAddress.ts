import { Address, isAddress } from "viem";

export default function extractRecoveryPluginAddress(
    subject: string
): Address | null {
    const subjectWords = subject.split(" ");

    const index = subjectWords.indexOf("plugin");
    if (index === -1) {
        return null;
    }

    const ownerOffset = 1;
    const recoveryPluginAddress = subjectWords[index + ownerOffset];

    if (isAddress(recoveryPluginAddress)) {
        return recoveryPluginAddress;
    } else {
        return null;
    }
}

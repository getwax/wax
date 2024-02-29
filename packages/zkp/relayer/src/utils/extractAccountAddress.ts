import { Address, isAddress } from "viem";

export default function extractAccountAddress(subject: string): Address | null {
    const subjectWords = subject.split(" ");

    const index = subjectWords.indexOf("owner");
    if (index === -1) {
        return null;
    }

    const ownerOffset = 1;
    const accountAddress = subjectWords[index + ownerOffset];

    if (isAddress(accountAddress)) {
        return accountAddress;
    } else {
        return null;
    }
}

import { isHex } from "viem";

export default function extractNewOwner(subject: string): `0x${string}` | null {
    const subjectWords = subject.split(" ");

    const index = subjectWords.indexOf("plugin");
    if (index === -1) {
        return null;
    }

    const ownerOffset = 1;
    const newOwner = subjectWords[index + ownerOffset];

    if (isHex(newOwner)) {
        return newOwner;
    } else {
        return null;
    }
}

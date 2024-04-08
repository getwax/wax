import { buildPoseidon } from "circomlibjs";

export const templateIdx = 0

// From https://github.com/zkemail/email-wallet/blob/main/packages/frontend/src/components/RegisterUnclaim.tsx
// function padStringToBytes(str: string, len: number): Uint8Array {
//     const bytes = new Uint8Array(len);
//     const strBytes = (new TextEncoder).encode(str);
//     bytes.set(strBytes);
//     const empty = new Uint8Array(len - strBytes.length);
//     bytes.set(empty, strBytes.length);
//     return bytes;
// }

// function bytes2fields(bytes: Uint8Array, F: Poseidon['F']): bigint[] {
//     const fields: bigint[] = [];
//     for (let i = 0; i < bytes.length; i += 31) {
//         const bytes32 = new Uint8Array(32);
//         bytes32.set(bytes.slice(i, i + 31));
//         const val = F.fromRprLE(bytes32, 0);
//         fields.push(val);
//     }
//     return fields;
// }

export function bytesToHex(bytes: Uint8Array) {
    return [...bytes]
        .reverse()
        .map(x => x.toString(16).padStart(2, "0"))
        .join("");
}

export async function genAccountCode(): Promise<string> {
    const poseidon = await buildPoseidon();
    const accountCodeBytes: Uint8Array = poseidon.F.random();
    return bytesToHex(accountCodeBytes);
}

// Use relayer.getAccountSalt instead
// export async function getGuardianSalt(guardianEmail: string, accountCode: Uint8Array) {
//     const poseidon = await buildPoseidon();
//     const emailField = bytes2fields(padStringToBytes(guardianEmail, 256), poseidon.F);
//     const accountSaltBytes = poseidon([
//         ...emailField, accountCode, 0
//     ]);
//     const accountSalt: `0x${string}` = `0x${bytesToHex(accountSaltBytes)}`
//     return accountSalt;
// }

// TODO Update both with safe module accept subject
export const getRequestGuardianSubject = (acctAddr: string) => 
    `Accept guardian request for ${acctAddr}`;
export const getRequestsRecoverySubject = (acctAddr: string, newOwner: string) => 
    `Update owner to ${newOwner} on account ${acctAddr}`;

import { buildPoseidon } from "circomlibjs";

export const genAccountCode = async () => {
    const poseidon = await buildPoseidon();
    const F = poseidon.F;
    const rand: Uint8Array = F.random();
    const randHex = `0x${[...rand]
        .reverse()
        .map(x => x.toString(16).padStart(2, "0"))
        .join("")}`;
    return randHex;
}
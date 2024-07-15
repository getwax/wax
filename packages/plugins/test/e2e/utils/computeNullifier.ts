import {
	convertBigIntToByteArray,
	decompressByteArray,
	extractPhoto,
} from "@anon-aadhaar/core";
import { sha256Pad } from "@zk-email/helpers/dist/sha-utils";
import { buildPoseidon } from "circomlibjs";

// Method to extract a nullifier specific to each Aadhaar ID owner from Aadhaar QR code
// https://github.com/anon-aadhaar/anon-aadhaar/blob/main/packages/circuits/test/aadhaar-verifier.test.ts#L140
export async function copmuteUserNullifier(
	nullifierSeed: number,
	qrData: string
): Promise<bigint> {
	const qrDataBytes = convertBigIntToByteArray(BigInt(qrData));
	const decodedData = decompressByteArray(qrDataBytes);
	const signedData = decodedData.slice(0, decodedData.length - 256);
	const [qrDataPadded, qrDataPaddedLen] = sha256Pad(signedData, 512 * 3);

	const { bytes: photoBytes } = extractPhoto(
		Array.from(qrDataPadded),
		qrDataPaddedLen
	);

	const photoBytesPacked = padArrayWithZeros(
		bytesToIntChunks(new Uint8Array(photoBytes), 31),
		32
	);

	const poseidon = await buildPoseidon();

	const first16 = poseidon([...photoBytesPacked.slice(0, 16)]);
	const last16 = poseidon([...photoBytesPacked.slice(16, 32)]);
	const nullifier = poseidon([nullifierSeed, first16, last16]);

	return BigInt(poseidon.F.toString(nullifier));
}

export function bytesToIntChunks(
	bytes: Uint8Array,
	maxBytesInField: number
): bigint[] {
	const numChunks = Math.ceil(bytes.length / maxBytesInField);
	const ints: bigint[] = new Array(numChunks).fill(BigInt(0));

	for (let i = 0; i < numChunks; i++) {
		let intSum = BigInt(0);
		for (let j = 0; j < maxBytesInField; j++) {
			const idx = maxBytesInField * i + j;
			if (idx >= bytes.length) break; // Stop if we've processed all bytes

			// Shift byte into position and add to current integer sum
			intSum += BigInt(bytes[idx]) * BigInt(256) ** BigInt(j);
		}
		ints[i] = intSum;
	}

	return ints;
}

export function padArrayWithZeros(
	bigIntArray: bigint[],
	requiredLength: number
) {
	const currentLength = bigIntArray.length;
	const zerosToFill = requiredLength - currentLength;

	if (zerosToFill > 0) {
		return [...bigIntArray, ...Array(zerosToFill).fill(BigInt(0))];
	}

	return bigIntArray;
}

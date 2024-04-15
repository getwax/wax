/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/comma-dangle */
/* eslint-disable @typescript-eslint/prefer-for-of */
/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/naming-convention */
import {
	convertBigIntToByteArray,
	decompressByteArray,
	extractPhoto,
} from "@anon-aadhaar/core";
import { buildPoseidon } from "circomlibjs";

export async function copmuteUserNullifier(
	nullifierSeed: number,
	qrData: string
): Promise<bigint> {
	const QRDataBytes = convertBigIntToByteArray(BigInt(qrData));
	console.log("QRDataBytes: ", QRDataBytes);
	const QRDataDecode = decompressByteArray(QRDataBytes);
	console.log("QRDataDecode: ", QRDataDecode);
	const signedData = QRDataDecode.slice(0, QRDataDecode.length - 256);
	console.log("signedData: ", signedData);

	const { bytes: photoBytes } = extractPhoto(Array.from(signedData));
	console.log("photoBytes: ", photoBytes);
	const photoBytesPacked = padArrayWithZeros(
		bytesToIntChunks(new Uint8Array(photoBytes), 31),
		32
	);

	console.log("photoBytesPacked: ", photoBytesPacked);

	const poseidon = await buildPoseidon();

	const first16 = poseidon([...photoBytesPacked.slice(0, 16)]);
	console.log("first16: ", first16);
	const last16 = poseidon([...photoBytesPacked.slice(16, 32)]);
	console.log("last16: ", last16);
	const nullifier = poseidon([nullifierSeed, first16, last16]);
	console.log("nullifier: ", nullifier);
	console.log("nullifier str: ", nullifier.toString());

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

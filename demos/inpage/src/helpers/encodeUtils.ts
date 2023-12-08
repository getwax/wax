import { ethers } from 'ethers';
import { AddressRegistry } from '../../hardhat/typechain-types';

export function hexJoin(hexStrings: string[]) {
  return `0x${hexStrings.map(remove0x).join('')}`;
}

export function hexLen(hexString: string) {
  return (hexString.length - 2) / 2;
}

export function remove0x(hexString: string) {
  if (!hexString.startsWith('0x')) {
    throw new Error('Expected 0x prefix');
  }

  return hexString.slice(2);
}

export function encodeVLQ(xParam: bigint) {
  let x = xParam;
  const segments: bigint[] = [];

  while (true) {
    const segment = x % 128n;
    segments.unshift(segment);
    x -= segment;
    x /= 128n;

    if (x === 0n) {
      break;
    }
  }

  let result = '0x';

  for (let i = 0; i < segments.length; i++) {
    const keepGoing = i !== segments.length - 1;

    const byte = (keepGoing ? 128 : 0) + Number(segments[i]);
    result += byte.toString(16).padStart(2, '0');
  }

  return result;
}

export function encodePseudoFloat(xParam: bigint) {
  let x = xParam;

  if (x === 0n) {
    return '0x00';
  }

  let exponent = 0;

  while (x % 10n === 0n && exponent < 30) {
    x /= 10n;
    exponent++;
  }

  const exponentBits = (exponent + 1).toString(2).padStart(5, '0');

  const lowest3Bits = Number(x % 8n)
    .toString(2)
    .padStart(3, '0');

  const firstByte = parseInt(`${exponentBits}${lowest3Bits}`, 2)
    .toString(16)
    .padStart(2, '0');

  return hexJoin([`0x${firstByte}`, encodeVLQ(x / 8n)]);
}

export function encodeRegIndex(regIndex: bigint) {
  const vlqValue = regIndex / 0x010000n;
  const fixedValue = Number(regIndex % 0x010000n);

  return hexJoin([
    encodeVLQ(vlqValue),
    `0x${fixedValue.toString(16).padStart(4, '0')}`,
  ]);
}

/**
 * Bit stacks are just the bits of a uint256 encoded as a VLQ. There is also a
 * final 1 to indicate the end of the stack.
 * (Technically the encoding is unbounded, but 256 booleans is a lot and it's
 * much easier to just decode the VLQ into a uint256 in the EVM.)
 *
 * Notably, the bits are little endian - the first bit is the *lowest* bit. This
 * is because the lowest bit is clearly the 1-valued bit, but the highest valued
 * bit could be anywhere - there's infinitely many zero-bits to choose from.
 *
 * If it wasn't for this need to be little endian, we'd definitely use big
 * endian (like our other encodings generally do), since that's preferred by the
 * EVM and the ecosystem:
 *
 * ```ts
 * const abi = new ethers.utils.AbiCoder():
 * console.log(abi.encode(["uint"], [0xff]));
 * // 0x00000000000000000000000000000000000000000000000000000000000000ff
 *
 * // If Ethereum used little endian (like x86), it would instead be:
 * // 0xff00000000000000000000000000000000000000000000000000000000000000
 * ```
 */
export function encodeBitStack(bits: boolean[]) {
  let stack = 1n;

  for (let i = bits.length - 1; i >= 0; i--) {
    stack <<= 1n;
    stack += BigInt(bits[i]);
  }

  const stackVLQ = encodeVLQ(stack);

  return stackVLQ;
}

export function encodeBytes(bytes: string) {
  return hexJoin([encodeVLQ(BigInt(hexLen(bytes))), bytes]);
}

export function roundUpPseudoFloat(x: bigint) {
  let pow10 = 1n;

  while (pow10 < x) {
    pow10 *= 10n;
  }

  pow10 /= 1000n;

  if (pow10 === 0n) {
    return x;
  }

  const roundedDown = pow10 * (x / pow10);

  if (roundedDown === x) {
    return x;
  }

  return roundedDown + pow10;
}

export async function lookupAddress(
  registry: AddressRegistry,
  address: string,
) {
  if (!ethers.isAddress(address)) {
    throw new Error('Address is not valid');
  }

  const filter = registry.filters['AddressRegistered(uint256,address)'](
    undefined,
    address,
  );

  const event = (await registry.queryFilter(filter)).at(0);

  return event?.args[0];
}

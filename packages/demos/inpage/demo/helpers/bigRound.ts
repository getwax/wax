import assert from '../../src/helpers/assert';

export default function bigRound(value: bigint, significantFigures: number) {
  assert(significantFigures === Math.round(significantFigures));
  assert(significantFigures >= 1);

  const negative = value < 0;
  const absValue = negative ? -value : value;
  const absValueStr = absValue.toString();

  if (absValueStr.length <= significantFigures) {
    return value;
  }

  const firstRoundedDigit = Number(absValueStr[significantFigures]);
  let roundUp = firstRoundedDigit >= 5;

  if (roundUp && firstRoundedDigit === 5 && negative) {
    const firstNonZeroAfter5 = [
      ...absValueStr.slice(significantFigures + 1),
    ].find((c) => c !== '0');

    if (firstNonZeroAfter5 === undefined) {
      roundUp = false;
    }
  }

  let front = BigInt(absValueStr.slice(0, significantFigures));

  if (roundUp) {
    front += 1n;
  }

  const absRoundedValue = BigInt(
    `${front.toString()}${'0'.repeat(absValueStr.length - significantFigures)}`,
  );

  return negative ? -absRoundedValue : absRoundedValue;
}

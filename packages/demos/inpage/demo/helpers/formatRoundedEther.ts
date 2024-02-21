import bigRound from './bigRound';

const oneEth = 10n ** 18n;

export default function formatRoundedEther(
  wei: bigint,
  significantFigures = 6,
) {
  const roundedWei = bigRound(wei, significantFigures);
  const negative = roundedWei < 0;
  const signStr = negative ? '-' : '';
  const absRoundedWei = negative ? -roundedWei : roundedWei;
  const absRoundedWeiStr = absRoundedWei.toString();

  if (absRoundedWeiStr.endsWith('0'.repeat(18))) {
    return signStr + absRoundedWeiStr.slice(0, -18);
  }

  const wholeEth = absRoundedWei / oneEth;
  const fractionalWei = absRoundedWei - wholeEth * oneEth;

  let res = signStr + wholeEth.toString();

  if (fractionalWei === 0n) {
    return res;
  }

  res += `.${fractionalWei.toString().padStart(18, '0')}`;

  let trailingZeros = 0;

  while (res[res.length - 1 - trailingZeros] === '0') {
    trailingZeros += 1;
  }

  return res.slice(0, -trailingZeros);
}

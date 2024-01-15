/* eslint-disable no-console */

import { ethers } from 'hardhat';
import { Block, Provider } from 'ethers';

async function main() {
  const medianBasefee = await calculateMedianBasefee(ethers.provider);

  console.log(formatGwei(medianBasefee));
}

async function calculateMedianBasefee(provider: Provider) {
  const latestBlock = (await provider.getBlock('latest'))!;

  // Get 100 blocks for the last month and then calculate median basefee

  // Estimate block rate
  const oldBlock = (await provider.getBlock(latestBlock.number - 1_000_000))!;
  const secondsPerBlock =
    (latestBlock.timestamp - oldBlock.timestamp) / 1_000_000;

  const blockSpan = Math.round((86400 * 30) / secondsPerBlock);
  const firstBlockNumber = latestBlock.number - blockSpan;

  const blocks: Block[] = [];

  for (let i = 0; i < 100; i++) {
    blocks.push(
      (await provider.getBlock(
        firstBlockNumber + Math.round((i * blockSpan) / 99),
      ))!,
    );

    if (i % 5 === 4) {
      console.log(`Downloaded ${i + 1}/100 blocks`);
    }
  }

  const basefees = blocks.map((block) => block.baseFeePerGas!);

  basefees.sort((a, b) => Number(a - b));

  const lowerMedian = basefees[Math.floor(basefees.length / 2)];
  const upperMedian = basefees[Math.ceil(basefees.length / 2)];

  return (lowerMedian + upperMedian) / 2n;
}

function formatGwei(n: bigint) {
  const wholeGwei = n / (10n ** 9n);
  const remainder = n - wholeGwei * (10n ** 9n);

  return [
    wholeGwei.toString(),
    '.',
    remainder.toString().padStart(9, '0'),
    ' gwei',
  ].join('');
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

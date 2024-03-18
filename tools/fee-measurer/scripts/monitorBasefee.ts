/* eslint-disable no-console */

import { ethers } from 'hardhat';

async function main() {
  await new Promise(() => {
    ethers.provider.on('block', async (blockNumber) => {
      const block = (await ethers.provider.getBlock(blockNumber))!;
      console.log({ blockNumber, baseFeePerGas: block.baseFeePerGas });
    });
  });
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

/* eslint-disable no-console */

import { ethers } from 'hardhat';
import { FeeMeasurer__factory } from '../typechain-types';
import SafeSingletonFactory from '../src/SafeSingletonFactory';

async function main() {
  const [signer] = await ethers.getSigners();

  const ssf = await SafeSingletonFactory.init(signer);

  const feeMeasurer = await ssf.connectOrDeploy(FeeMeasurer__factory, []);

  console.log('FeeMeasurer deployed to:', await feeMeasurer.getAddress());

  const results = [];

  for (const size of [10n, 20n, 30n, 40n]) {
    console.log(size);

    const balanceBefore = await ethers.provider.getBalance(await signer.getAddress());
    const ordinaryGas = await feeMeasurer.useGasOrdinaryGasUsed(size);
    const receipt = (await (await feeMeasurer.useGas(size, { type: 2 })).wait())!;

    const tx = await receipt.getTransaction();
    console.log(tx);

    const balanceAfter = await ethers.provider.getBalance(await signer.getAddress());

    const result = {
      size,
      ordinaryGas,
      reportedGasUsed: receipt.gasUsed,
      reportedGasPrice: receipt.gasPrice,
      ethUsed: balanceBefore - balanceAfter,
      ethUsedFmt: ethers.formatEther(balanceBefore - balanceAfter),
    };

    console.log(result);
    results.push(result);
  }

  const firstResult = results[0];
  const lastResult = results.at(-1)!;

  const ordinaryGasPrice =
    (lastResult.ethUsed - firstResult.ethUsed) /
    (lastResult.ordinaryGas - firstResult.ordinaryGas);

  const ethUsedRelErrors = results.map((result) => {
    const prediction = (firstResult.ethUsed
      + ordinaryGasPrice * (result.ordinaryGas - firstResult.ordinaryGas));

    return Number(result.ethUsed - prediction) / Number(result.ethUsed);
  });

  console.log({ ethUsedRelErrors });
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

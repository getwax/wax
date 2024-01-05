/* eslint-disable no-console */

import { ethers } from 'hardhat';
import { FeeMeasurer__factory } from '../typechain-types';
import SafeSingletonFactory from '../src/SafeSingletonFactory';
import generateBytes from '../src/generateBytes';

async function main() {
  const [signer] = await ethers.getSigners();

  const ssf = await SafeSingletonFactory.init(signer);

  const feeMeasurer = await ssf.connectOrDeploy(FeeMeasurer__factory, []);

  console.log('FeeMeasurer deployed to:', await feeMeasurer.getAddress());

  let ordinaryGasPrice: bigint;

  {
    console.log("Measuring ordinary gas price...");
    console.log("===============================");
    console.log();

    const results = [];

    for (const size of [10n, 20n, 30n, 40n]) {
      console.log({ size });

      const balanceBefore = await ethers.provider.getBalance(await signer.getAddress());
      const ordinaryGas = await feeMeasurer.useGasOrdinaryGasUsed(size);
      const receipt = (await (await feeMeasurer.useGas(size, { /* TODO */ })).wait())!;

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

    ordinaryGasPrice =
      (lastResult.ethUsed - firstResult.ethUsed) /
      (lastResult.ordinaryGas - firstResult.ordinaryGas);

    const ethUsedRelErrors = results.map((result) => {
      const prediction = (firstResult.ethUsed
        + ordinaryGasPrice * (result.ordinaryGas - firstResult.ordinaryGas));

      return Number(result.ethUsed - prediction) / Number(result.ethUsed);
    });

    console.log({ ethUsedRelErrors });
  }

  {
    console.log();
    console.log();
    console.log("Measuring calldata price...");
    console.log("===========================");
    console.log();

    const results = [];

    for (const size of [0n, 50n, 100n, 150n]) {
      console.log({ size });

      const balanceBefore = await ethers.provider.getBalance(await signer.getAddress());
      const ordinaryGas = await feeMeasurer.fallbackOrdinaryGasUsed(size);
      const receipt = (await (await (feeMeasurer.fallback!)({
        data: generateBytes(Number(size)),
        /* TODO */
      })).wait())!;

      const balanceAfter = await ethers.provider.getBalance(await signer.getAddress());
      const ethUsed = balanceBefore - balanceAfter;
      const ethUsedForOrdinaryGas = ordinaryGasPrice * ordinaryGas;
      const ethUsedExtra = ethUsed - ethUsedForOrdinaryGas;

      const result = {
        size,
        ordinaryGas,
        reportedGasUsed: receipt.gasUsed,
        reportedGasPrice: receipt.gasPrice,
        ethUsed,
        ethUsedForOrdinaryGas,
        ethUsedExtra,
        ethUsedFmt: ethers.formatEther(ethUsed),
        ethUsedForOrdinaryGasFmt: ethers.formatEther(ethUsedForOrdinaryGas),
        ethUsedExtraFmt: ethers.formatEther(ethUsedExtra),
      };

      console.log(result);
      results.push(result);
    }

    const firstResult = results[0];
    const lastResult = results.at(-1)!;

    const baselineExtraEth = firstResult.ethUsedExtra;
    const extraEthPerByte = (lastResult.ethUsedExtra - firstResult.ethUsedExtra);

    const ethUsedRelErrors = results.map((result) => {
      const prediction = (
        baselineExtraEth +
        extraEthPerByte * result.size +
        ordinaryGasPrice * result.ordinaryGas
      );

      return Number(result.ethUsed - prediction) / Number(result.ethUsed);
    });

    console.log();
    console.log();

    console.log('Results', {
      ethUsedRelErrors,
      baselineExtraEth,
      extraEthPerByte,
      baselineExtraEthFmt: ethers.formatEther(baselineExtraEth),
      extraEthPerByteFmt: ethers.formatEther(extraEthPerByte),
    });
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

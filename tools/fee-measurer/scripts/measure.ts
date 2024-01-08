/* eslint-disable no-console */

import { ethers } from 'hardhat';
import { FeeMeasurer__factory } from '../typechain-types';
import SafeSingletonFactory from '../src/SafeSingletonFactory';
import generateBytes from '../src/generateBytes';
import { Signer } from 'ethers';

// TODO:
// - Don't use ethers' default fee because it gives optimism 1 gwei

async function main() {
  let signer: Signer;

  if (process.env.MNEMONIC) {
    signer = ethers.Wallet.fromPhrase(process.env.MNEMONIC, ethers.provider);
  } else {
    signer = (await ethers.getSigners())[0];
  }

  const ssf = await SafeSingletonFactory.init(signer);

  const feeMeasurer = await ssf.connectOrDeploy(FeeMeasurer__factory, []);

  console.log('FeeMeasurer deployed to:', await feeMeasurer.getAddress());

  let referenceBlock = await ethers.provider.getBlockNumber();

  let ordinaryGasPrice: bigint;

  {
    console.log("Measuring ordinary gas price...");
    console.log("===============================");
    console.log();

    const results = [];

    for (const size of [10n, 20n, 30n, 40n]) {
      console.log({ size });

      const balanceBefore = await ethers.provider.getBalance(await signer.getAddress(), referenceBlock);
      const ordinaryGas = await feeMeasurer.useGasOrdinaryGasUsed(size);
      const receipt = (await (await feeMeasurer.useGas(size, { /* TODO */ })).wait())!;
      referenceBlock = receipt.blockNumber;
      const balanceAfter = await ethers.provider.getBalance(await signer.getAddress(), referenceBlock);

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

    console.log({ ordinaryGasPrice, ethUsedRelErrors });
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

      const balanceBefore = await ethers.provider.getBalance(await signer.getAddress(), referenceBlock);
      const ordinaryGas = await feeMeasurer.fallbackOrdinaryGasUsed(size);
      const receipt = (await (await (feeMeasurer.fallback!)({
        data: generateBytes(Number(size)),
        /* TODO */
      })).wait())!;
      referenceBlock = receipt.blockNumber;

      const balanceAfter = await ethers.provider.getBalance(await signer.getAddress(), referenceBlock);
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
    const extraEthPerByte = (lastResult.ethUsedExtra - firstResult.ethUsedExtra) / (lastResult.size - firstResult.size);

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
      ordinaryGasPrice,
      baselineExtraEth,
      extraEthPerByte,
      ordinaryGasPriceFmt: (Number(ordinaryGasPrice) / 1e9).toFixed(9) + ' gwei',
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

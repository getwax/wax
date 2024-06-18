/* eslint-disable no-console */

import { ethers } from 'hardhat';
import { FeeMeasurer__factory } from '../typechain-types';
import SafeSingletonFactory from '../src/SafeSingletonFactory';
import generateBytes from '../src/generateBytes';
import { Overrides, Signer } from 'ethers';

async function main() {
  let signer: Signer;

  if (process.env.MNEMONIC) {
    signer = ethers.Wallet.fromPhrase(process.env.MNEMONIC, ethers.provider);
  } else {
    signer = (await ethers.getSigners())[0];
  }

  const startBlock = (await ethers.provider.getBlock('latest'))!;
  const maxFeePerGas = startBlock.baseFeePerGas! * 3n / 2n;
  const maxPriorityFeePerGas = 100_000n; // 0.0001 gwei

  const overrides: Overrides = {
    type: 2,
    maxFeePerGas,
    maxPriorityFeePerGas,
  };

  let referenceBlock = startBlock.number;

  const ssf = await SafeSingletonFactory.init(signer, overrides);
  const feeMeasurer = await ssf.connectOrDeploy(FeeMeasurer__factory, []);

  console.log(
    'FeeMeasurer connectOrDeployed to:',
    await feeMeasurer.getAddress(),
  );

  let ordinaryGasPrice: bigint;

  {
    console.log("Measuring ordinary gas price...");
    console.log("===============================");
    console.log();

    const results = [];

    for (const size of [50n, 100n, 150n, 200n]) {
      console.log({ size });

      const balanceBefore = await ethers.provider.getBalance(await signer.getAddress(), referenceBlock);
      const ordinaryGas = await feeMeasurer.useGasOrdinaryGasUsed(size);
      const receipt = (await (await feeMeasurer.useGas(size, overrides)).wait())!;
      referenceBlock = receipt.blockNumber;
      const balanceAfter = await ethers.provider.getBalance(await signer.getAddress(), referenceBlock);

      const result = {
        size,
        ordinaryGas,
        reportedGasUsed: receipt.gasUsed,
        reportedGasPrice: receipt.gasPrice,
        weiUsed: balanceBefore - balanceAfter,
        ethUsedFmt: ethers.formatEther(balanceBefore - balanceAfter),
      };

      console.log(result);
      results.push(result);
    }

    const firstResult = results[0];
    const lastResult = results.at(-1)!;

    ordinaryGasPrice =
      (lastResult.weiUsed - firstResult.weiUsed) /
      (lastResult.ordinaryGas - firstResult.ordinaryGas);

    const weiUsedRelErrors = results.map((result) => {
      const prediction = (firstResult.weiUsed
        + ordinaryGasPrice * (result.ordinaryGas - firstResult.ordinaryGas));

      return Number(result.weiUsed - prediction) / Number(result.weiUsed);
    });

    console.log({ ordinaryGasPrice, weiUsedRelErrors });
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
        ...overrides,
        data: generateBytes(Number(size)),
      })).wait())!;
      referenceBlock = receipt.blockNumber;

      const balanceAfter = await ethers.provider.getBalance(await signer.getAddress(), referenceBlock);
      const weiUsed = balanceBefore - balanceAfter;
      const weiUsedForOrdinaryGas = ordinaryGasPrice * ordinaryGas;
      const weiUsedExtra = weiUsed - weiUsedForOrdinaryGas;

      const result = {
        size,
        ordinaryGas,
        reportedGasUsed: receipt.gasUsed,
        reportedGasPrice: receipt.gasPrice,
        weiUsed,
        weiUsedForOrdinaryGas,
        weiUsedExtra,
        ethUsed: ethers.formatEther(weiUsed),
        ethUsedForOrdinaryGas: ethers.formatEther(weiUsedForOrdinaryGas),
        ethUsedExtra: ethers.formatEther(weiUsedExtra),
      };

      console.log(result);
      results.push(result);
    }

    const firstResult = results[0];
    const lastResult = results.at(-1)!;

    const baselineExtraWei = firstResult.weiUsedExtra;
    const extraWeiPerByte = (lastResult.weiUsedExtra - firstResult.weiUsedExtra) / (lastResult.size - firstResult.size);

    const weiUsedRelErrors = results.map((result) => {
      const prediction = (
        baselineExtraWei +
        extraWeiPerByte * result.size +
        ordinaryGasPrice * result.ordinaryGas
      );

      return Number(result.weiUsed - prediction) / Number(result.weiUsed);
    });

    console.log();
    console.log();

    console.log('Results', {
      weiUsedRelErrors,
      ordinaryGasPrice,
      baselineExtraWei,
      extraWeiPerByte,
      ordinaryGasPriceFmt: (Number(ordinaryGasPrice) / 1e9).toFixed(9) + ' gwei',
      baselineExtraEthFmt: ethers.formatEther(baselineExtraWei),
      extraEthPerByteFmt: ethers.formatEther(extraWeiPerByte),
    });
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

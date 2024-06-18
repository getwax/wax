/* eslint-disable no-console */

import { ethers } from 'hardhat';
import { FeeMeasurer__factory } from '../typechain-types';
import SafeSingletonFactory from '../src/SafeSingletonFactory';

async function main() {
  const [signer] = await ethers.getSigners();

  const ssf = await SafeSingletonFactory.init(signer);

  const feeMeasurer = await ssf.connectOrDeploy(FeeMeasurer__factory, []);

  console.log('FeeMeasurer deployed to:', await feeMeasurer.getAddress());

  for (let size = 1n; size <= 3n; size++) {
    console.log(size);
    for (let i = 0; i < 3; i++) {
      console.log("Gas prediction: ", await feeMeasurer.useGasOrdinaryGasUsed(size));
      const receipt = (await (await feeMeasurer.useGas(size)).wait())!;
      console.log("Gas used: ", receipt.gasUsed);
    }
  }

  const receipt = (await (await feeMeasurer.fallback!({ data: "0x01" })).wait())!;
  console.log(receipt.gasUsed);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

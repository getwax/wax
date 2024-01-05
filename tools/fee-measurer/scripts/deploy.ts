/* eslint-disable no-console */

import { ethers } from 'hardhat';
import { FeeMeasurer__factory } from '../typechain-types';

async function main() {
  const [signer] = await ethers.getSigners();

  const feeMeasurer = await new FeeMeasurer__factory().connect(signer).deploy();
  await feeMeasurer.deploymentTransaction()?.wait();

  console.log('FeeMeasurer deployed to:', await feeMeasurer.getAddress());

  for (let size = 101n; size <= 103n; size++) {
    console.log(size);
    for (let i = 0; i < 3; i++) {
      console.log("Gas prediction: ", await feeMeasurer.ordinaryGasUsed(size));
      const receipt = (await (await feeMeasurer.useGas(size)).wait())!;
      console.log("Gas used: ", receipt.gasUsed);
    }
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

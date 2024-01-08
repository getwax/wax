/* eslint-disable no-console */

import { ethers } from 'hardhat';
import { FeeMeasurer__factory } from '../typechain-types';
import SafeSingletonFactory from '../src/SafeSingletonFactory';
import { Signer } from 'ethers';

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
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

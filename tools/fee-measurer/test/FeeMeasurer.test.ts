import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';

describe('FeeMeasurer', () => {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function fixture() {
    const FeeMeasurer = await ethers.getContractFactory('FeeMeasurer');
    const feeMeasurer = await FeeMeasurer.deploy();

    return { feeMeasurer };
  }

  it('useGasOrdinaryGasUsed should match gas used by useGas', async () => {
    const { feeMeasurer } = await loadFixture(fixture);

    for (const size of [1, 2, 3, 50, 100, 200]) {
      const prediction = await feeMeasurer.useGasOrdinaryGasUsed(size);
      const receipt = (await (await feeMeasurer.useGas(size)).wait())!;
      
      expect(prediction).to.equal(receipt.gasUsed);
    }
  });

  it('fallbackOrdinaryGasUsed should match gas used by fallback function', async () => {
    const { feeMeasurer } = await loadFixture(fixture);

    for (const size of [4, 5, 6, 10, 50, 200, 1000, 100000]) {
      const prediction = await feeMeasurer.fallbackOrdinaryGasUsed(size);

      const receipt = (await (await (feeMeasurer.fallback!)({
        data: generateBytes(size),
      })).wait())!;

      expect(prediction).to.equal(receipt.gasUsed);
    }
  });
});

function generateBytes(size: number): string {
  let res = '0x';
  
  for (let i = 0; i < 2 * size; i++) {
    res += Math.floor(Math.random() * 15 + 1).toString(16);
  }

  return res;
}

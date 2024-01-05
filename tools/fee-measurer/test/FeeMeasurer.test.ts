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

  describe('Deployment', () => {
    it('useGasOrdinaryGasUsed should match gas used by useGas', async () => {
      const { feeMeasurer } = await loadFixture(fixture);

      for (const size of [1, 2, 3, 50, 100, 200]) {
        const prediction = await feeMeasurer.useGasOrdinaryGasUsed(size);
        const receipt = (await (await feeMeasurer.useGas(size)).wait())!;
        
        expect(prediction).to.equal(receipt.gasUsed);
      }
    });
  });
});

import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';

describe('Greeter', () => {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function fixture() {
    const Greeter = await ethers.getContractFactory('Greeter');
    const greeter = await Greeter.deploy('hello');

    return { greeter };
  }

  describe('Deployment', () => {
    it('Should say hello', async () => {
      const { greeter } = await loadFixture(fixture);

      expect(await greeter.greet()).to.equal('hello');
    });

    it('Set greeting to hi', async () => {
      const { greeter } = await loadFixture(fixture);

      await (await greeter.setGreeting('hi')).wait();
      expect(await greeter.greet()).to.equal('hi');
    });
  });
});

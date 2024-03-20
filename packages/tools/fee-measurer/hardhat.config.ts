import { HardhatUserConfig, task, types } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: '0.8.21',
        settings: {
          optimizer: {
            enabled: true,
            runs: 1_000_000,
          },
        },
      },
    ],
  },

  networks: {
    hardhat: {
      gasPrice: 20_000_000_000,
    },

    mainnet: {
      url: 'https://rpc.ankr.com/eth'
    },

    arbitrumOne: {
      url: 'https://arb1.arbitrum.io/rpc',
    },

    optimism: {
      url: 'https://mainnet.optimism.io',
    },
  },
};

task('sendEth', 'Sends ETH to an address')
  .addParam('address', 'Address to send ETH to', undefined, types.string)
  .addOptionalParam('amount', 'Amount of ETH to send', '1.0')
  .setAction(
    async ({ address, amount }: { address: string; amount: string }, hre) => {
      const wallet = hre.ethers.Wallet.fromPhrase(
        `${'test '.repeat(11)}junk`,
        hre.ethers.provider,
      );

      console.log(`${wallet.address} -> ${address} ${amount} ETH`);

      const txnRes = await wallet.sendTransaction({
        to: address,
        value: hre.ethers.parseEther(amount),
      });

      await txnRes.wait();
    },
  );

export default config;

import { HardhatUserConfig, task, types } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "hardhat-dependency-compiler";
import "hardhat-preprocessor";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

function getRemappings() {
  return fs
    .readFileSync("remappings.txt", "utf8")
    .split("\n")
    .filter(Boolean) // remove empty lines
    .map((line) => line.trim().split("="));
}

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.23",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1_000_000,
      },
    },
  },
  dependencyCompiler: {
    paths: ["@anon-aadhaar/contracts"],
  },
  networks: {
    localhost: {
      allowUnlimitedContractSize: true,
      blockGasLimit: 100000000,
      gas: 100000000,
      url: "http://localhost:8545",
    },
    basesepolia: {
      url: "https://sepolia.base.org",
      accounts: {
        mnemonic: process.env.MNEMONIC,
      },
    },
  },
  mocha: {
    timeout: 120000,
  },
  preprocess: {
    eachLine: (_hre) => ({
      transform: (line: string) => {
        if (line.match(/^\s*import /i)) {
          for (const [from, to] of getRemappings()) {
            if (line.includes(from)) {
              line = line.replace(from, to);
              break;
            }
          }
        }
        return line;
      },
      settings: true,
    }),
  },
  paths: {
    sources: "./src",
    cache: "./cache_hardhat",
  },
};

export default config;

task("sendEth", "Sends ETH to an address")
  .addParam("address", "Address to send ETH to", undefined, types.string)
  .addOptionalParam("amount", "Amount of ETH to send", "1.0")
  .setAction(
    async ({ address, amount }: { address: string; amount: string }, hre) => {
      const wallet = hre.ethers.Wallet.fromPhrase(
        "test ".repeat(11) + "junk",
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

task("generateMnemonic", "Generates and displays a random mnemonic").setAction(
  async (_params, hre) => {
    const wallet = hre.ethers.Wallet.createRandom();
    console.log(wallet.mnemonic?.phrase);
  },
);

task("accounts", "Prints the list of accounts", async (_params, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

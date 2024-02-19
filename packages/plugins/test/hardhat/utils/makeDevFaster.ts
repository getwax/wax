import { ethers } from "ethers";

export default async function makeDevFaster(provider: ethers.JsonRpcProvider) {
  const chainId = (await provider.getNetwork()).chainId;

  if (chainId === 1337n || chainId === 31337n) {
    provider.pollingInterval = 100;
  }
}

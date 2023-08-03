import { ethers, Contract } from "ethers";

export const calculateProxyAddress = async (
  factory: Contract,
  singleton: string,
  inititalizer: string,
  nonce: number | string
) => {
  const proxyCreationCode = await factory.proxyCreationCode();
  const deploymentCode = ethers.solidityPacked(
    ["bytes", "uint256"],
    [proxyCreationCode, singleton]
  );

  const salt = ethers.solidityPackedKeccak256(
    ["bytes32", "uint256"],
    [ethers.keccak256(inititalizer), nonce]
  );

  return ethers.getCreate2Address(
    await factory.getAddress(),
    salt,
    ethers.keccak256(deploymentCode)
  );
};

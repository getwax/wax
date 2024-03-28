import { ethers } from "ethers";
import { UserOperation } from "./userOpUtils";

export const getGasEstimates = async (
  provider: ethers.JsonRpcProvider,
  bundlerProvider: ethers.JsonRpcProvider,
  partialUserOperation: Partial<UserOperation>,
  entryPointAddress: string,
) => {
  const gasEstimate = (await bundlerProvider.send(
    "eth_estimateUserOperationGas",
    [partialUserOperation, entryPointAddress],
  )) as {
    verificationGasLimit: string;
    preVerificationGas: string;
    callGasLimit: string;
  };

  const safeVerificationGasLimit =
    BigInt(gasEstimate.verificationGasLimit) +
    BigInt(gasEstimate.verificationGasLimit); // + 100% TODO: (merge-ok) why do we have to increase the limit so much for all tests to pass?

  const safePreVerificationGas =
    BigInt(gasEstimate.preVerificationGas) +
    BigInt(gasEstimate.preVerificationGas) / 10n; // + 10%

  const { maxFeePerGas, maxPriorityFeePerGas } = await getFeeData(provider);

  return {
    callGasLimit: gasEstimate.callGasLimit,
    verificationGasLimit: ethers.toBeHex(safeVerificationGasLimit),
    preVerificationGas: ethers.toBeHex(safePreVerificationGas),
    maxFeePerGas,
    maxPriorityFeePerGas,
  };
};

async function getFeeData(provider: ethers.Provider) {
  const feeData = await provider.getFeeData();
  if (!feeData.maxFeePerGas || !feeData.maxPriorityFeePerGas) {
    throw new Error(
      "maxFeePerGas or maxPriorityFeePerGas is null or undefined",
    );
  }

  const maxFeePerGas = "0x" + feeData.maxFeePerGas.toString();
  const maxPriorityFeePerGas = "0x" + feeData.maxPriorityFeePerGas.toString();

  return { maxFeePerGas, maxPriorityFeePerGas };
}

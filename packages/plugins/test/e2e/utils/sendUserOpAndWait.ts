import { UserOperationStruct } from "@account-abstraction/contracts";
import { ethers } from "ethers";
import sleep from "./sleep";

export default async function sendUserOpAndWait(
  userOp: UserOperationStruct,
  entryPoint: string,
  bundlerProvider: ethers.JsonRpcProvider,
  pollingDelay = 100,
  maxAttempts = 200,
) {
  const userOpHash = (await bundlerProvider.send("eth_sendUserOperation", [
    userOp,
    entryPoint,
  ])) as string;

  let receipt: { success: boolean } | null = null;

  let attempts = 0;

  while (attempts < maxAttempts && receipt === null) {
    await sleep(pollingDelay);

    receipt = (await bundlerProvider.send("eth_getUserOperationReceipt", [
      userOpHash,
    ])) as { success: boolean } | null;

    attempts++;
  }

  if (receipt === null) {
    throw new Error(`Could not get receipt after ${maxAttempts} attempts`);
  }

  return receipt;
}

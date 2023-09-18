import { ethers } from "ethers";

export default async function receiptOf(
  txResponseOrPromise:
    | ethers.TransactionResponse
    | Promise<ethers.TransactionResponse>,
) {
  const txResponse = await txResponseOrPromise;
  return await txResponse.wait();
}

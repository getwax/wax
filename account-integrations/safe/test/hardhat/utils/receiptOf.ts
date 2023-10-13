import { ethers } from "ethers";
import assert from "./assert";

export default async function receiptOf(
  txResponseOrPromise:
    | ethers.TransactionResponse
    | Promise<ethers.TransactionResponse>,
) {
  const txResponse = await txResponseOrPromise;
  const receipt = await txResponse.wait();
  assert(receipt !== null);
  assert(receipt.status === 1);

  return receipt;
}

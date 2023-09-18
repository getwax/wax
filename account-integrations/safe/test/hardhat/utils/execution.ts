// Note: most of this code is copied from https://github.com/safe-global/safe-contracts with 
// small modifications to work with Hardhat ethers.

import { Contract, Wallet, BigNumberish, Signer } from "ethers";
import { BigNumber } from "ethers-v5";
import { TypedDataSigner } from "@ethersproject/abstract-signer";
import { AddressZero } from "@ethersproject/constants";
import { Safe } from "../../../typechain-types";

export const executeContractCallWithSigners = async (
  safe: Safe,
  contract: Safe,
  method: string,
  params: any[],
  signers: Wallet[],
  delegateCall?: boolean,
  overrides?: Partial<SafeTransaction>,
) => {
  const tx = await buildContractCall(contract, method, params, Number(await safe.nonce()), delegateCall, overrides);
  return executeTxWithSigners(safe, tx, signers);
};


export const buildContractCall = async (
  contract: Safe,
  method: string,
  params: any[],
  nonce: number,
  delegateCall?: boolean,
  overrides?: Partial<SafeTransaction>,
): Promise<SafeTransaction> => {
  // @ts-ignore
  const data = contract.interface.encodeFunctionData(method, params);
  return buildSafeTransaction(
      Object.assign(
          {
              to: await contract.getAddress(),
              data,
              operation: delegateCall ? 1 : 0,
              nonce,
          },
          overrides,
      ),
  );
};

export const buildSafeTransaction = (template: {
  to: string;
  value?: BigNumber | number | string;
  data?: string;
  operation?: number;
  safeTxGas?: number | string;
  baseGas?: number | string;
  gasPrice?: number | string;
  gasToken?: string;
  refundReceiver?: string;
  nonce: number;
}): SafeTransaction => {
  return {
      to: template.to,
      value: template.value || 0,
      data: template.data || "0x",
      operation: template.operation || 0,
      safeTxGas: template.safeTxGas || 0,
      baseGas: template.baseGas || 0,
      gasPrice: template.gasPrice || 0,
      gasToken: template.gasToken || AddressZero,
      refundReceiver: template.refundReceiver || AddressZero,
      nonce: template.nonce,
  };
};


export const executeTxWithSigners = async (safe: Safe, tx: SafeTransaction, signers: Wallet[], overrides?: any) => {
  // @ts-ignore
  const sigs = await Promise.all(signers.map((signer) => safeSignTypedData(signer, safe, tx)));
  return executeTx(safe, tx, sigs, overrides);
};

export const executeTx = async (safe: Safe, safeTx: SafeTransaction, signatures: SafeSignature[], overrides?: any): Promise<any> => {
  const signatureBytes = buildSignatureBytes(signatures);
  return safe.execTransaction(
    // @ts-ignore
      safeTx.to,
      safeTx.value,
      safeTx.data,
      safeTx.operation,
      safeTx.safeTxGas,
      safeTx.baseGas,
      safeTx.gasPrice,
      safeTx.gasToken,
      safeTx.refundReceiver,
      signatureBytes,
      overrides || {},
  );
};

export const buildSignatureBytes = (signatures: SafeSignature[]): string => {
  const SIGNATURE_LENGTH_BYTES = 65;
  signatures.sort((left, right) => left.signer.toLowerCase().localeCompare(right.signer.toLowerCase()));

  let signatureBytes = "0x";
  let dynamicBytes = "";
  for (const sig of signatures) {
      if (sig.dynamic) {
          /* 
              A contract signature has a static part of 65 bytes and the dynamic part that needs to be appended at the end of 
              end signature bytes.
              The signature format is
              Signature type == 0
              Constant part: 65 bytes
              {32-bytes signature verifier}{32-bytes dynamic data position}{1-byte signature type}
              Dynamic part (solidity bytes): 32 bytes + signature data length
              {32-bytes signature length}{bytes signature data}
          */
          const dynamicPartPosition = (signatures.length * SIGNATURE_LENGTH_BYTES + dynamicBytes.length / 2)
              .toString(16)
              .padStart(64, "0");
          const dynamicPartLength = (sig.data.slice(2).length / 2).toString(16).padStart(64, "0");
          const staticSignature = `${sig.signer.slice(2).padStart(64, "0")}${dynamicPartPosition}00`;
          const dynamicPartWithLength = `${dynamicPartLength}${sig.data.slice(2)}`;

          signatureBytes += staticSignature;
          dynamicBytes += dynamicPartWithLength;
      } else {
          signatureBytes += sig.data.slice(2);
      }
  }

  return signatureBytes + dynamicBytes;
};

export const safeSignTypedData = async (
  signer: Signer & TypedDataSigner,
  safe: Contract,
  safeTx: SafeTransaction,
  chainId?: BigNumberish,
): Promise<SafeSignature> => {
  if (!chainId && !signer.provider) throw Error("Provider required to retrieve chainId");
  const cid = chainId || (await signer.provider!.getNetwork()).chainId;
  const signerAddress = await signer.getAddress();
  return {
      signer: signerAddress,
      data: await signer.signTypedData({ verifyingContract: await safe.getAddress(), chainId: cid }, EIP712_SAFE_TX_TYPE, safeTx),
  };
};

export const EIP712_SAFE_TX_TYPE = {
  // "SafeTx(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address refundReceiver,uint256 nonce)"
  SafeTx: [
      { type: "address", name: "to" },
      { type: "uint256", name: "value" },
      { type: "bytes", name: "data" },
      { type: "uint8", name: "operation" },
      { type: "uint256", name: "safeTxGas" },
      { type: "uint256", name: "baseGas" },
      { type: "uint256", name: "gasPrice" },
      { type: "address", name: "gasToken" },
      { type: "address", name: "refundReceiver" },
      { type: "uint256", name: "nonce" },
  ],
};

export interface SafeTransaction extends MetaTransaction {
  safeTxGas: string | number;
  baseGas: string | number;
  gasPrice: string | number;
  gasToken: string;
  refundReceiver: string;
  nonce: string | number;
}

export interface MetaTransaction {
  to: string;
  value: string | number | BigNumber; 
  data: string;
  operation: number;
}

export interface SafeSignature {
  signer: string;
  data: string;
  // a flag to indicate if the signature is a contract signature and the data has to be appended to the dynamic part of signature bytes
  dynamic?: true;
}
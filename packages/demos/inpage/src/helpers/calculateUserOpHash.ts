import { ethers } from 'ethers';

import EthereumRpc from '../EthereumRpc';

export default function calculateUserOpHash(
  userOp: EthereumRpc.UserOperation,
  entryPoint: string,
  chainId: number,
) {
  return ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ['bytes32', 'address', 'uint256'],
      [simpleHash(userOp), entryPoint, chainId],
    ),
  );
}

function simpleHash(userOp: EthereumRpc.UserOperation) {
  return ethers.keccak256(encode(userOp));
}

function encode(userOp: EthereumRpc.UserOperation) {
  return ethers.AbiCoder.defaultAbiCoder().encode(
    [
      'address',
      'uint256',
      'bytes32',
      'bytes32',
      'uint256',
      'uint256',
      'uint256',
      'uint256',
      'uint256',
      'bytes32',
    ],
    [
      userOp.sender,
      userOp.nonce,
      ethers.keccak256(userOp.initCode),
      ethers.keccak256(userOp.callData),
      userOp.callGasLimit,
      userOp.verificationGasLimit,
      userOp.preVerificationGas,
      userOp.maxFeePerGas,
      userOp.maxPriorityFeePerGas,
      ethers.keccak256(userOp.paymasterAndData),
    ],
  );
}

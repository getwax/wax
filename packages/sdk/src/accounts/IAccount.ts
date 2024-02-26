import EthereumRpc from '../EthereumRpc';
import AccountData from './AccountData';
import { ethers } from 'ethers';

type IAccount = {
  type: string;
  address: string;
  toData(): AccountData;
  estimateVerificationGas(userOp: EthereumRpc.UserOperation): Promise<bigint>;
  makeInitCode(): Promise<string>;
  encodeActions(actions: EthereumRpc.Action[]): Promise<string>;
  getNonce(): Promise<bigint>;
  sign(userOp: EthereumRpc.UserOperation, userOpHash: string): Promise<string>;
};

export default IAccount;

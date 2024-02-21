import EthereumRpc from '../EthereumRpc';
import ethereumRequest from '../ethereumRequest';
import IBundler from './IBundler';

export default class NetworkBundler implements IBundler {
  #rpcUrl: string;

  constructor(rpcUrl: string) {
    this.#rpcUrl = rpcUrl;
  }

  async eth_sendUserOperation(
    userOp: EthereumRpc.UserOperation,
    entryPoint: string,
  ): Promise<string> {
    return await ethereumRequest({
      url: this.#rpcUrl,
      method: 'eth_sendUserOperation',
      params: [userOp, entryPoint],
    });
  }

  async eth_estimateUserOperationGas(
    userOp: EthereumRpc.UserOperation,
    entryPoint: string,
  ): Promise<EthereumRpc.UserOperationGasEstimate> {
    return await ethereumRequest({
      url: this.#rpcUrl,
      method: 'eth_estimateUserOperationGas',
      params: [userOp, entryPoint],
    });
  }

  async eth_getUserOperationReceipt(
    userOpHash: string,
  ): Promise<EthereumRpc.UserOperationReceipt | null> {
    return await ethereumRequest({
      url: this.#rpcUrl,
      method: 'eth_getUserOperationReceipt',
      params: [userOpHash],
    });
  }

  async eth_supportedEntryPoints(): Promise<string[]> {
    return await ethereumRequest({
      url: this.#rpcUrl,
      method: 'eth_supportedEntryPoints',
    });
  }
}

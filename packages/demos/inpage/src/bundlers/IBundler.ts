import EthereumRpc from '../EthereumRpc';

type IBundler = Pick<
  EthereumRpc.Handlers,
  | 'eth_sendUserOperation'
  | 'eth_estimateUserOperationGas'
  | 'eth_getUserOperationReceipt'
  | 'eth_supportedEntryPoints'
>;

export default IBundler;

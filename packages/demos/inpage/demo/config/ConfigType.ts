type ConfigType = {
  logRequests?: boolean;
  logBytes?: boolean;
  rpcUrl: string;
  bundlerRpcUrl?: string;
  pollingInterval?: number;
  addFundsEthAmount?: string;
  deployerSeedPhrase: string;
  requirePermission?: boolean;
  externalContracts?: {
    entryPoint: string;
    blsSignatureAggregator: string;
    addressRegistry: string;
  };
};

export default ConfigType;

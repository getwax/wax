type ConfigType = {
  logRequests?: boolean;
  logBytes?: boolean;
  rpcUrl: string;
  bundlerRpcUrl?: string;
  pollingInterval?: number;
  addFundsEthAmount?: string;
  deployerSeedPhrase: string;
  requirePermission?: boolean;
  entryPointAddress?: string;
  aggregatorAddress?: string;
};

export default ConfigType;

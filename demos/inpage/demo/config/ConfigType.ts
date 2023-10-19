type ConfigType = {
  logRequests?: boolean;
  logBytes?: boolean;
  rpcUrl: string;
  bundlerRpcUrl?: string;
  pollingInterval?: number;
  addFundsEthAmount?: string;
  deployerSeedPhrase: string;
};

export default ConfigType;

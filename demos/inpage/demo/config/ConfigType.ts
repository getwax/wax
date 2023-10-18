type ConfigType = {
  logRequests?: boolean;
  rpcUrl: string;
  bundlerRpcUrl?: string;
  pollingInterval?: number;
  addFundsEthAmount?: string;
  deployerSeedPhrase: string;
};

export default ConfigType;

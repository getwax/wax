// config.template.ts is tracked in git
// config.ts is not tracked in git
//
// This allows us to track the starting recommendations for the config without
// getting mixed up with local preferences.
//
// If config.ts doesn't yet exist, it will be created as a copy of the template
// during `yarn setup`.

import ConfigType from './ConfigType';

const config: ConfigType = {
  logRequests: true,
  rpcUrl:
    (import.meta.env.VITE_RPC_URL as string) ??
    'https://sepolia-rollup.arbitrum.io/rpc',

  // If a default seed phrase is not provided, a user must provide their own.
  deployerSeedPhrase: (import.meta.env.VITE_DEPLOYER_SEED_PHRASE as string) ?? '',

  // Uncomment this with the url of a bundler to enable using an external
  // bundler (sometimes this is the same as rpcUrl). Otherwise, a bundler will
  // be simulated inside the library.
  // bundlerRpcUrl: '',
};

export default config;

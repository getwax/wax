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
  logBytes: true,
  rpcUrl: 'http://127.0.0.1:8545',
  deployerSeedPhrase:
    'test test test test test test test test test test test junk',

  // Uncomment this with the url of a bundler to enable using an external
  // bundler (sometimes this is the same as rpcUrl). Otherwise, a bundler will
  // be simulated inside the library.
  // bundlerRpcUrl: '',

  requirePermission: false,

  // These contracts will be deployed deterministically by default. However,
  // if you need to interop with a specific existing deployment, you'll need
  // to specify the contracts here:
  // externalContracts: {
  //   entryPoint: '0x...',
  //   blsSignatureAggregator: '0x...',
  //   addressRegistry: '0x...',
  // }
  // (Other contracts will still be deterministically deployed, but they
  // shouldn't be required for interop purposes.)
};

export default config;

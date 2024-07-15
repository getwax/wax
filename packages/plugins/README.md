TODO link to other module bootstrapping repos, mention this is mainly safe

maybe ideas in here for cool new plugins to build?

one pager in hackmd  or somewher else
- AA libs
- module bootstrapping

# Plugins

Please note, these plugins are in a pre-alpha state and are not ready for production use. In their current state, the plugins are meant for testing and experimentation.

# Getting Started

1. `cd packages/plugins`
2. Run `yarn submodules` to initialize git submodules
3. Run `yarn` to install hardhat dependencies
4. Run `forge install` to install foundry dependencies
5. Run `cp .env.example .env` to create an `.env` file with the values from `.env.example`

## Build & generate Typechain definitions

```bash
yarn build
```

## Forge tests

```bash
forge test --no-match-path test/unit/safe/SafeZkEmailRecoveryPlugin.t.sol -vvv
```

## Hardhat tests

To run the hardhat tests, you'll need to run a node and a bundler as some of them are integration tests:

1. Start a geth node, fund accounts, deploy Safe contracts, and start a bundler:

```bash
# Note: This uses geth. There is also start-hardhat.sh for using hardhat. See
# docs inside each script for more information.
./script/start.sh
```

2. Run the plugin tests:

```bash
yarn hardhat test
```

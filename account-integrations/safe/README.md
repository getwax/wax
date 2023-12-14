# Safe plugins

Please note, these plugins are in a pre-alpha state and are not ready for production use. In their current state, the plugins are meant for testing and experimentation.

# Getting Started

1. `cd account-integrations/safe`
2. Run `yarn` to install hardhat dependencies
3. Run `forge install` to install foundry dependencies

## (optional) ZKP Plugins

Link `zkp` directory for ZKP based plugins. Make sure you have [circom installed](../zkp/README.md).
```bash
cd ../zkp
yarn
yarn link
cd ../safe
yarn link '@getwax/circuits'
```

## Build & generate Typechain definitions

```bash
yarn build
```

## Forge tests

```bash
forge test
```

## Hardhat tests

To run the hardhat tests, you'll need to run a node and a bundler as some of them are integration tests:

1. Create an `.env` file with the values from `.env.example`:

```bash
cp .env.example .env
```

2. Start a geth node, fund accounts, deploy Safe contracts, and start a bundler:

```bash
# Note: This uses geth. There is also start-hardhat.sh for using hardhat. See
# docs inside each script for more information.
./script/start.sh
```

3. Run the plugin tests:

```bash
yarn hardhat test
```

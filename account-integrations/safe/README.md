# Safe plugins

# Getting Started

1. `cd account-integrations/safe`
2. Run `yarn` to install hardhat dependencies
3. Run `forge install` to install foundry dependencies

## Forge tests

```bash
forge test
```

## Hardhat tests

To run the hardhat tests, you'll need to run a node and a bundler as some of them are integration tests:

1. Start a geth node, fund accounts and deploy Safe contracts:

```bash
./script/start.sh
```

2. Create an `.env` file with the values from `.env.example`:

```bash
cp .env.example .env
```

3. Setup and run an external bundler (make sure the values in `.env` match up with the bundler and node you're running).

```bash
# If using the eth-infinitism bundler, checkout to this commmit. The latest version of the bundler has started breaking the integration tests. This is a previous commit where the integration tests still pass
git checkout 1b154c9
```

```bash
# If using the eth-infinitism bundler
yarn run bundler
```

4. Run the plugin tests:

```bash
yarn hardhat test
```

# Webauthn plugin

# Getting Started

1. `cd webauthn`
2. Run `yarn` to install dependencies
3. Run `forge install` to install foundry dependencies

## Integration test

To run the integration tests:

1. Start a geth node, fund accounts and deploy Safe contracts:

```bash
./script/start.sh
```

2. Create an `.env` file with the values from `.env.example`:

```bash
cp .env.example .env
```

3. Start an external bundler (make sure the values in `.env` match up with the bundler and node you're running).

```bash
# If using the eth-infinitism bundler
yarn run bundler
```

4. Run the plugin tests:

```bash
yarn hardhat test
```

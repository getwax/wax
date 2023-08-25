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

2. Create a `.env` file and update the Safe address values. For `ERC4337_TEST_SINGLETON_ADDRESS`, use the address outputted as `Safe` in the terminal after running `start.sh`. For `ERC4337_TEST_SAFE_FACTORY_ADDRESS`, use the address outputted as `SafeProxyFactory` in the terminal after running `start.sh`.

3. Start an external bundler (make sure the values in `.env` match up with the bundler and node you're running).

```bash
# If using the eth-infinitism bundler
yarn run bundler
```

4. Run the plugin tests:

```bash
yarn hardhat test
```

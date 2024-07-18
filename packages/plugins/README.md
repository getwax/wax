# Plugins

Experimental plugins, modules, components for use with [ERC-4337](https://eips.ethereum.org/EIPS/eip-4337) (`v0.7.0`) compatible smart contract accounts. Most are currently built on top of Safe.
These plugins are in a pre-alpha state and are not ready for production use. They are intended for experimentation.

This package is a hybrid Foundry & Hardhat project. Foundry is used for unit & integration testing, with Hardhat for end-to-end testing & examples of using a plugin in JavaScript/TypeScript runtime.

## When you should use this package

- If you are building a ERC-4337 plugin, module, or component and want end-to-end tooling & testing harnesses to make sure your it is compatible within the ERC-4337/Ethereum AA ecosystem. These can include but are not limited to:
  - Validation
  - Account Recovery
  - Paymasters
- If you are building a module for an ERC-4437 Safe.
- If you are interested in experimenting with calldata compression. See also [the compression package](../compression/).
- If you have an interesting idea to integrate a novel cryptographic primitive or zero knowledge proof into the Ethereum AA ecosystem and want a place to start.

## When you shouldn't use this package

If you are developing a plugin/module for use with an ERC-4337 module spec, such as:
- ERC-7579, use https://docs.rhinestone.wtf/modulekit as a base instead.
- ERC-6900, use https://www.erc6900.io/build-a-plugin as a base instead.

## Getting Started

1. `cd packages/plugins`
2. Run `yarn submodules` to initialize git submodules
3. Run `yarn` to install hardhat dependencies
4. Run `forge install` to install foundry dependencies
5. Run `cp .env.example .env` to create an `.env` file with the values from `.env.example`

### Build & generate Typechain definitions

```bash
yarn build
```

### Forge tests

```bash
forge test --no-match-path test/unit/safe/SafeZkEmailRecoveryPlugin.t.sol -vvv
```

### Hardhat tests

To run the hardhat tests, you'll need to run a geth node & bundler as some of them are integration tests:

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

### Things to keep in mind

- When writing Hardhat tests in the [e2e directory](./test/e2e/), DO NOT USE the `hre` ([Hardhat Runtime Environment](https://hardhat.org/hardhat-runner/docs/advanced/hardhat-runtime-environment)) when deploying contracts & interacting on chain. We do not use the normal internal Hardhat runtime as we need to run against a local geth instance & bundler to fully simulate the ERC-4337 flow end-to-end.
- Be mindful of the [opcode & storage limitations imposed by ERC-4337](https://eips.ethereum.org/EIPS/eip-7562).

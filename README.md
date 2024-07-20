# Wallet Account eXperiments (WAX)

![WAX Logo](./waxGreenLogo.png)

Primary monorepo for the Wallet Account eXperiments (WAX) project, which focuses on integrating novel & useful cryptographic technologies into the Ethereum Account Abstraction (AA) ecosytem to improve the experience of using accounts. We build on top of [ERC-4337](https://eips.ethereum.org/EIPS/eip-4337) & related specs.

# Using this monorepo
Are you looking to build a plugin/module for the AA/ERC-4337 ecosystem and want examples & tooling? Check out [the plugins package](./packages/plugins/).

Are you interested in compressing ERC-4337 data? Start with [the compression package](./packages/compression/)

## Compression
[packages/compression](./packages//compression/)

Contracts implementing compression for ERC-4337 accounts to reduce data being posted from rollups.

## Demos
[packages/demos](./packages/demos/)

Demos showcasing WAX components.

## Deterministic Deployer
[packages/deterministic-deployer](./packages/deterministic-deployer/)

Deploys contracts to deterministic addresses.

## Plugins
[packages/plugins](./packages/plugins/)

Plugins/modules for smart contracts accounts, including test scaffolding.

## SDK
[packages/sdk](./packages/sdk/)

SDK code to help with ERC-4337 interactions.

## Archive
[archive](./archive/)

Work & projects that are no longer actively used but could be useful as references.

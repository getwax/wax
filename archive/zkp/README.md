# WAX ZKP Circuits & Utils

Based on https://github.com/privacy-scaling-explorations/zkp-app-boilerplate/tree/main/circuits

Includes a protoype [TypeScript ZKEmail relayer](./relayer/).

WARNING: These circuits are unsafe and are currently not recommended for production use.

## Required

- NodeJS >= 18
- Yarn

## Setup

Install circom following [these instructions](https://docs.circom.io/getting-started/installation/)

The last working version was `v2.1.8`, [commit](https://github.com/iden3/circom/commit/f0deda416abe91e5dd906c55507c737cd9986ab5)

**Step 2**: Install NodeJS dependencies.

```sh
yarn
```

## Build

Compiles circuits & exports zk artifacts
```sh
yarn build
```

## Test

```sh
yarn test
```

## Other Commands

See [package.json](./package.json)

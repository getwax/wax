# WAX ZKP Circuits & Utils

Based on https://github.com/privacy-scaling-explorations/zkp-app-boilerplate/tree/main/circuits

## Required

- NodeJS >= 18
- Yarn

## Setup

1. Build & install circom from `./lib/circom` using [these instructions](https://docs.circom.io/getting-started/installation/)
2. `yarn` to install NodeJS dependencies

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
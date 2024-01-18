# WAX ZKP Circuits & Utils

Based on https://github.com/privacy-scaling-explorations/zkp-app-boilerplate/tree/main/circuits

WARNING: These circuits are unsafe and are currently not recommended for production use.

## Required

- NodeJS >= 18
- Yarn

## Setup

**Step 1**: Download git submodules.

```sh
git submodule update --init
```

**Step 2**: Install circom.

Follow [these instructions](https://docs.circom.io/getting-started/installation/) replacing the git clone with `cd lib/circom`.

**Step 3**: Install NodeJS dependencies.

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
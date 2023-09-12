# WAX In-Page Wallet

This is an in-page wallet for demonstrating WAX modules.

- `src` defines a TypeScript library for the in-page wallet itself
  - implements `window.ethereum`
  - backed by a smart account with WAX features
- `demo` defines a website that uses the library

## See the Demo

(TBA: Public URL.)

```sh
yarn setup
yarn dev
```

The dev server will run a hardhat-based testnet for you by default. If you'd
like to use an external network, configure your `rpcUrl` in `demo/config.ts` and
the dev server will skip running a local node.

### Use the Demo with an External Bundler

In `demo/config.ts`, set `bundlerRpcUrl` to your bundler's rpc url.

If you don't have access to an existing external bundler, one option for running
your own is
[`eth-infinitism/bundler`](https://github.com/eth-infinitism/bundler).

1. Set `bundlerRpcUrl` above to `http://127.0.0.1:3000`
2. Clone [`eth-infinitism/bundler`](https://github.com/eth-infinitism/bundler)
3. Run `yarn && yarn preprocess`
4. Set `packages/bundler/localconfig/mnemonic.txt` to:

```
test test test test test test test test test test test absent
```

5. Set `beneficiary` in `packages/bundler/localconfig/bundler.config.json` to:

```
0xe8250207B79D7396631bb3aE38a7b457261ae0B6
```

Send some ETH to this address.

6. Get the entry point address using these commands in the dev console of the
   demo:

```ts
let contracts = await waxInPage.getContracts();
await contracts.entryPoint.getAddress();
```

7. Set `entryPoint` in `packages/bundler/localconfig/bundler.config.json` to
   that address.

8. Run `yarn run bundler --unsafe`.

## Use the Library (as an Npm Module)

```sh
# In this repo
yarn setup
yarn build

# In your repo
yarn add path/to/wax/inpage/build/getwax-inpage-0.1.0.tgz
```

(Note: This should just be `npm install @getwax/inpage`, but it's not published
yet.)

Then:

```ts
import WaxInPage from "@getwax/inpage";

const wax = new WaxInPage({
  rpcUrl: "<your rpc url>", // eg for hardhat use http://127.0.0.1:8545
});

console.log(
  await wax.ethereum.request({
    method: "eth_requestAccounts",
  }),
);

// Alternatively...

WaxInPage.global({
  rpcUrl: "<your rpc url>", // eg for hardhat use http://127.0.0.1:8545
});

console.log(
  await ethereum.request({
    method: "eth_requestAccounts",
  }),
);
```

## Use the Libary (as a Script)

In this repo:

```sh
yarn setup
yarn build

# Now waxInPage.iife.js is in build/globalScript
```

Copy `waxInPage.iife.js` to your `public/ext` directory.

Add these scripts to your html:

```html
<script>
window.waxInPageConfig = {
  rpcUrl: '<your rpc url>', // eg for hardhat use http://127.0.0.1:8545
};
</script>
<script src="/ext/waxInPage.iife.js"></script>
```

(Note: This should just be `https://getwax.org/lib/inpage@0.1.0`, but it's not
published yet.)

Now you can use `window.ethereum` and `window.waxInPage`, eg:

```ts
(async () => {
  console.log(
    await ethereum.request({
      method: "eth_requestAccounts",
    }),
  );
})();
```

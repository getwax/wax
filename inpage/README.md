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
import WaxInPage from '@getwax/wax';

const wax = new WaxInPage();

console.log(await wax.ethereum.request({
  method: 'eth_requestAccounts',
}));

// Alternatively...

WaxInPage.global();

console.log(await ethereum.request({
  method: 'eth_requestAccounts',
}));
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

  console.log(await ethereum.request({
    method: 'eth_requestAccounts',
  }));

})();
```

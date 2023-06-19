# Compression for 4337

Contracts implementing compression for 4337 wallets.

## Performance

Using these contracts, the marginal calldata cost of an ERC20 transfer is 28
bytes.

The size of ETH transfers and other ERC20 operations is similar. Calls to other
contracts need to add the size of their `tx.data` field, but still benefit from
compression of `tx.to` and `tx.value` and a compact representation of `tx.data`
(avoid 32 bytes to represent length and 15.5 bytes for zero padding).

The full calldata cost is expected to include a share of the approximately 173
bytes of overhead the bundle needs to pay for. This includes the aggregated BLS
signature (64 bytes) and the non-data fields of the top-level ECDSA transaction
(approx. 109 bytes).

Assuming this cost is divided equally, an ERC20 transfer would then need to
cover the following numbers of bytes:

| Bundle Size | Bytes |
|-------------|-------|
|           1 |   201 |
|           2 |   115 |
|           5 |    63 |
|          20 |    37 |
|         100 |    30 |

## Requirements

- The bundler needs to use [`EntryPointCaller`](./src/EntryPointCaller.sol)
  (or something better) (including the off-chain compression needed to call it
  correctly)
- The account (aka SCW) needs to decompress its `userOp.calldata` field similar
  to [`DemoWallet`](./src/DemoWallet.sol) (see `fallback`)
- Your 4337 wallet (end-user software) needs to correctly compress
  `userOp.calldata` off-chain (otherwise use `eth_sendUserOperation` normally)
- Addresses used should be registered in the
  [`AddressRegistry`](./src/AddressRegistry.sol). Otherwise you'll need to
  include the full 20 bytes of each address. Registration is a one-time cost.

Bundlers set the actual fees for 4337 wallets. You can see how much a bundler
requires using `eth_estimateUserOperationGas`.

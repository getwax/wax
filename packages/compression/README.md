# Compression for 4337

Contracts implementing compression for 4337 wallets.

## Performance

**Marginal Calldata for an ERC20 Transfer**

| Strategy        | Zeros | Non-Zeros | Bytes | L1 Gas |
|-----------------|-------|-----------|-------|--------|
| Vanilla 4337    |   421 |       155 |   576 |   4164 |
| Compressed 4337 |     0 |        27 |    27 |    432 |

Note that L1 Gas is calculated as `4*zeros + 16*nonZeros`. The exact value
depends on your L2 of choice. This may involve an additional compression layer,
but today this generally does *not* take compressibility into account, so the
savings ratio should still be approximately correct.

The size of ETH transfers and other ERC20 operations is similar. Calls to other
contracts need to add the size of their `tx.data` field, but still benefit from
compression of `tx.to` and `tx.value` and a compact representation of `tx.data`
(avoid 32 bytes to represent length and 15.5 bytes for zero padding).

The full calldata cost is expected to include a share of the approximately 174
bytes of overhead the bundle needs to pay for. This includes the aggregated BLS
signature (64 bytes) and the non-data fields of the top-level ECDSA transaction
(approx. 109 bytes).

Assuming this cost is divided equally, an ERC20 transfer would then need to
cover the following numbers of bytes:

| Bundle Size | Bytes |
|-------------|-------|
|           1 |   201 |
|           2 |   114 |
|           5 |    62 |
|          20 |    36 |
|         100 |    29 |

The L2 gas overhead for doing the decompression to make this possible is about
57,000. This means compression should break even on chains where L2 gas is
about 15x cheaper than L1 gas, and provide savings thereafter. (TODO: Do this
paragraph more thoroughly and document it.)

## Requirements

- The bundler needs to use [`HandleAggregatedOpsCaller`](./src/HandleAggregatedOpsCaller.sol)
  (or something better) (including the off-chain compression needed to call it
  correctly)
- The account (aka SCW) needs to decompress its `userOp.calldata` field similar
  to [`DemoAccount`](./src/DemoAccount.sol) (see `fallback`)
- Your 4337 wallet (end-user software) needs to correctly compress
  `userOp.calldata` off-chain
- Your 4337 wallet should round up these `userOp` fields to 3 significant
  figures: `callGasLimit`, `verificationGasLimit`, `preVerificationGas`,
  `maxFeePerGas`, `maxPriorityFeePerGas` (additional significant figures are
  supported but require extra bytes)
- Addresses used should be registered in the
  [`AddressRegistry`](./src/AddressRegistry.sol). Unregistered addresses cost
  20 bytes instead of just 3. Registration is a one-time cost.

Bundlers set the actual fees for 4337 wallets. You can see how much a bundler
requires using `eth_estimateUserOperationGas`.

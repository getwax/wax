# Fee Measurer

This tool facilitates direct measurement of L2 fees.

Every L2 needs to extend Ethereum's system of charging fees to account for their
L1 costs. The method tends to be different for each L2, which creates a lot of
confusion and makes it difficult to compare L2s to each other.

This tool helps unify L2 fees by approximating them with this model:

```
l1GasUsed = fixedL1Gas + l1GasPerEffectiveDataByte * dataBytes
l2GasUsed = (ordinary gas defined by protocol / same on L1 and local dev)

fee = l1GasUsed * l1GasPrice + l2GasUsed * l2GasPrice
```

To start using this model for an L2, we need to find the values of `fixedL1Gas`
and `l1GasPerEffectiveDataByte` for the L2. Once these are measured, the same
values should continue to accurately predict fees (<5% error) as L1 and L2 gas
prices change. Reassessment should only be needed periodically to stay up to
date with network upgrades.

## How to Measure the Model Parameters

```sh
yarn
```

The main script is `scripts/measure.ts`. You can try this out in the test
environment with:

```sh
yarn hardhat run scripts/measure.ts
```

However, because the test environment is not an L2, it should measure the L2's
extra fees as zero. Gas prices can also fluctuate dramatically in the test
environment, which throws off the calculations.

For a real measurement, you'll need:
1. Choose the network you want to measure, and find its network name (or add it)
   in `hardhat.config.ts`
1. Set up an account with about 0.002 ETH and have a mnemonic phrase for it (the
   exact amount spent should be closer to 0.001 ETH but you'll want a buffer to
   avoid needing to re-run the test from running out of funds)

Optionally, you can also consider changing this hardcoded number:

```ts
const maxPriorityFeePerGas = 100_000n; // 0.0001 gwei
```

then:

```sh
# Tip: Include a leading space to reduce the chance the command is written to
# history somewhere.
 MNEMONIC="(your mnemonic)" yarn hardhat \
    --network "(network name)" \
    run scripts/measure.ts
```

This generates significant output, but the key values of interest are
`baselineExtraWei` and `extraWeiPerByte`. Also of interest are the
`weiUsedRelErrors` results (there are 2 sets). These should be as close to zero
as possible, ideally below 0.05 (5% error). If they are higher, it could be due
to significant gas price movements during the test, or because the L2's pricing
model is too far outside the assumptions of this model. You'll need to see
errors that you consider acceptable for future estimation to proceed, which
might be resolved by re-running the test at a later time. (Gas changes are only
an issue during the test - you can still use the resulting model to do
estimations when gas prices change later.)

Once you're happy with your numbers, you need to find the applicable L1 gas
price. You can get a ballpark number by just independently looking at what L1
recently charged for gas, but for best results you need to use a method specific
to your L2. For example:
- Arbitrum: There are precompiles available ([more info](
  https://hackmd.io/@voltrevo/H15SBijOa#Calculating-the-Actual-L1-Gas))
- Optimism: The applicable L1 gas price is provided on [optimism's block
  explorer](https://optimistic.etherscan.io/)

With the L1 gas price value (in wei (if you have gwei, multiply by 10^9 to get
the wei value)), you can calculate:

```
fixedL1Gas = baselineExtraWei / l1GasPrice
l1GasPerEffectiveDataByte = extraWeiPerByte / l1GasPrice
```

Example results (measured Jan 2024):

|                             | Arbitrum One | Optimism |
| --------------------------- | ------------ | -------- |
| `fixedL1Gas`                | 1816         | 1302     |
| `l1GasPerEffectiveDataByte` | 16.2         | 11.0     |

## How to Apply the Model

**Step 1: Measure L2 gas**

Use a test environment like hardhat to measure the amount of ordinary gas (ie
the L2's gas when run on the L2) for the transaction you're interested in.
Depending on the complexity of your transaction, some care might be needed to
set up the right kind of state so that your transaction follows the
relevant/'normal' code path. This value is often higher for the first instance
of the transaction, because it writes to new storage. It's up to you to figure
out whether this first-time cost or ongoing cost is the number you need (or you
might be interested in both).

You can also get this value by running transactions directly on the target
chain, but be careful to interpret L2 gas correctly. This can be tricky because
L2s can report gas in unexpected ways, [for example on Arbitrum](
https://hackmd.io/@voltrevo/H15SBijOa).

**Step 2: Measure Effective Data Bytes**

This is about the number of bytes in your transaction's `data` field and how
they are treated by your specific L2. If your transaction data is a custom and
efficient format that is mostly random and incompressible, then you can use the
actual length of the data field as its effective length.

If you have a large data field based on the solidity ABI, the effective length
is probably about 40% of the actual length (based on Jan 2024 experiments).

Otherwise, you'll need to do some investigation for your transaction and L2 to
find the right value. For example:
- Arbitrum: Uses a complex system based on brotli, and appears to charge for
  small data fields (eg ERC20 transfer) as though they were incompressible. The
  most practical way to measure effective bytes is probably to send your actual
  bytes to the chain and find the length that generates the correct fee when you
  plug it into the model.
- Optimism: Ultimately uses gzip to post L1 data, but for fee calculation
  purposes it uses the number of non-zero bytes plus 1/4 * the number of
  zero-bytes.

**Step 3: Final Calculation**

From previous steps, you should have `l1Gas` and `l2Gas` values for your
transaction, as well as the `fixedL1Gas` and `l1GasPerEffectiveDataByte` that
are built into the model.

With those values, you can calculate:

```
l1GasUsed = fixedL1Gas + l1GasPerEffectiveDataByte * dataBytes
l2GasUsed = (ordinary gas defined by protocol / same on L1 and local dev)

fee = l1GasUsed * l1GasPrice + l2GasUsed * l2GasPrice
```

This gives a number in wei, which you can divide by 10^18 for a value in ETH,
and multiply by the price of ETH to get a value in your preferred currency.

## Median Gas Price

To give an objective estimate that isn't tied exactly to the current gas price
conditions, the median gas price can be used.

This script will measure the median basefee:

```
yarn hardhat run --network "(your network)" scripts/estimateMedianBasefee.ts
```

Add a modest/applicable priority fee to get an overall gas price (eg 0.0001
gwei). This depends on the L2 (eg Arbitrum doesn't take a priority fee even if
you offer it).

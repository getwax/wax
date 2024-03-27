import z from 'zod';

import { EntryPoint } from '../../hardhat/typechain-types';
import EthereumRpc from '../EthereumRpc';

export default async function simulateValidation(
  entryPoint: EntryPoint,
  userOp: EthereumRpc.UserOperation,
): Promise<ValidationResult | ValidationResultWithAggregation> {
  let revert: TxRevertError['revert'];

  try {
    await entryPoint.simulateValidation.staticCall(userOp);
    throw new Error('Expected simulateValidation to revert');
  } catch (e) {
    const parseResult = TxRevertError.safeParse(e);

    if (!parseResult.success) {
      throw e;
    }

    revert = parseResult.data.revert;
  }

  if (revert.name === 'ValidationResult') {
    return parseValidationResult(revert.args);
  }

  if (revert.name === 'ValidationResultWithAggregation') {
    return parseValidationResultWithAggregation(revert.args);
  }

  throw new Error(`Unexpected revert name: ${revert.name}`);
}

// Ethers has these hybrid object things that are technically arrays but also
// include named fields. Unfortunately some tedious manipulation is needed below
// to make that work with zod to add type information.

function parseValidationResult(value: unknown) {
  const valueAny = value as ExplicitAny;

  return ValidationResult.parse({
    returnInfo: parseReturnInfo(valueAny.returnInfo),
    senderInfo: parseStakeInfo(valueAny.senderInfo),
    factoryInfo: parseStakeInfo(valueAny.factoryInfo),
    paymasterInfo: parseStakeInfo(valueAny.paymasterInfo),
  });
}

function parseValidationResultWithAggregation(value: unknown) {
  const valueAny = value as ExplicitAny;

  return ValidationResultWithAggregation.parse({
    returnInfo: parseReturnInfo(valueAny.returnInfo),
    senderInfo: parseStakeInfo(valueAny.senderInfo),
    factoryInfo: parseStakeInfo(valueAny.factoryInfo),
    paymasterInfo: parseStakeInfo(valueAny.paymasterInfo),
    aggregatorInfo: AggregatorStakeInfo.parse({
      aggregator: valueAny.aggregatorInfo.aggregator,
      stakeInfo: parseStakeInfo(valueAny.aggregatorInfo.stakeInfo),
    }),
  });
}

function parseReturnInfo(value: unknown) {
  const valueAny = value as ExplicitAny;

  return ReturnInfo.parse({
    preOpGas: valueAny.preOpGas,
    prefund: valueAny.prefund,
    sigFailed: valueAny.sigFailed,
    validAfter: valueAny.validAfter,
    validUntil: valueAny.validUntil,
    paymasterContext: valueAny.paymasterContext,
  });
}

function parseStakeInfo(value: unknown) {
  const valueAny = value as ExplicitAny;

  return StakeInfo.parse({
    stake: valueAny.stake,
    unstakeDelaySec: valueAny.unstakeDelaySec,
  });
}

const TxRevertError = z.object({
  revert: z.object({
    name: z.string(),
    args: z.unknown(),
  }),
});

type TxRevertError = z.infer<typeof TxRevertError>;

const ReturnInfo = z.object({
  preOpGas: z.bigint(),
  prefund: z.bigint(),
  sigFailed: z.boolean(),
  validAfter: z.bigint(),
  validUntil: z.bigint(),
  paymasterContext: z.string(),
});

type ReturnInfo = z.infer<typeof ReturnInfo>;

const StakeInfo = z.object({
  stake: z.bigint(),
  unstakeDelaySec: z.bigint(),
});

type StakeInfo = z.infer<typeof StakeInfo>;

const ValidationResult = z.object({
  returnInfo: ReturnInfo,
  senderInfo: StakeInfo,
  factoryInfo: StakeInfo,
  paymasterInfo: StakeInfo,
});

type ValidationResult = z.infer<typeof ValidationResult>;

const AggregatorStakeInfo = z.object({
  aggregator: z.string(),
  stakeInfo: StakeInfo,
});

type AggregatorStakeInfo = z.infer<typeof AggregatorStakeInfo>;

const ValidationResultWithAggregation = z.object({
  returnInfo: ReturnInfo,
  senderInfo: StakeInfo,
  factoryInfo: StakeInfo,
  paymasterInfo: StakeInfo,
  aggregatorInfo: AggregatorStakeInfo,
});

type ValidationResultWithAggregation = z.infer<
  typeof ValidationResultWithAggregation
>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ExplicitAny = any;

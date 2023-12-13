import { expect } from 'chai';

import {
  hexJoin,
  hexLen,
  remove0x,
  encodeVLQ,
  encodePseudoFloat,
  encodeRegIndex,
  encodeBitStack,
  encodeBytes,
  roundUpPseudoFloat,
} from '../../src/helpers/encodeUtils';

describe('hexJoin', () => {
  it('Standard Usage', () => {
    expect(hexJoin(['0x1234', '0x5678'])).to.eq('0x12345678');
  });

  it('Uneven values', () => {
    // Eg 0x1 is implicitly 0x01
    expect(hexJoin(['0x123', '0x456'])).to.eq('0x01230456');
  });

  it('Empty Array', () => {
    expect(hexJoin([])).to.eq('0x');
  });
});

describe('hexLen', () => {
  it('0x123456 -> 3', () => {
    expect(hexLen('0x123456')).to.eq(3);
  });

  it('0x -> 0', () => {
    expect(hexLen('0x')).to.eq(0);
  });
});

describe('remove0x', () => {
  it('0x123456 -> 123456', () => {
    expect(remove0x('0x123456')).to.eq('123456');
  });

  it('No 0x Prefix', () => {
    expect(() => remove0x('123456')).to.throw();
  });
});

describe('encodeVLQ', () => {
  it('49,157 -> 0x838005', () => {
    //
    // 49,157 in base 128 is 3,0,5 (3 * 128^2 + 0 * 128^1 + 5 * 128^0)
    //
    // 0x838005
    //   ^-^-^
    //   | | |
    //   | | <8 means stop (the leading bit is 0)
    //   8+ means keep going (the leading bit is 1)
    //
    // 0x838005
    //    ^-^-^
    //    | | |
    //    | | 5 (0x05)
    //    | 0   (0x00)
    //    3     (0x00)
    //
    expect(encodeVLQ(49_157n)).to.eq('0x838005');
  });
});

describe('encodePseudoFloat', () => {
  it('0 -> 0x00', () => {
    expect(encodePseudoFloat(0n)).to.eq('0x00');
  });

  it('0.0123 * 10^18 -> 0x7b0f', () => {
    // See PseudoFloat.sol for detailed explanation.
    expect(encodePseudoFloat(12_300_000_000_000_000n)).to.eq('0x7b0f');
  });
});

describe('encodeRegIndex', () => {
  it('123 -> 0x00007b', () => {
    expect(encodeRegIndex(123n)).to.eq('0x00007b');
  });
});

describe('encodeBitStack', () => {
  it('TFT -> 0x37', () => {
    // 0x37 = 0b(1)10111
    // Read the 'last' bit first (because we use &1 or %2)
    // The 1 in the most significant bit indicates the end of the stack
    expect(encodeBitStack([true, true, true, false, true])).to.eq('0x37');
  });
});

describe('encodeBytes', () => {
  it('0x123456 -> 0x03123456', () => {
    // Length (as VLQ) followed by data
    expect(encodeBytes('0x123456')).to.eq('0x03123456');
  });
});

describe('roundUpPseudoFloat', () => {
  it('0 -> 0', () => {
    expect(roundUpPseudoFloat(0n)).to.eq(0n);
  });

  it('100_001 -> 101_000', () => {
    expect(roundUpPseudoFloat(100_001n)).to.eq(101_000n);
  });

  it('12_345_678 -> 12_400_000', () => {
    expect(roundUpPseudoFloat(12_345_678n)).to.eq(12_400_000n);
  });

  it('9_999 -> 10_000', () => {
    expect(roundUpPseudoFloat(9_999n)).to.eq(10_000n);
  });
});

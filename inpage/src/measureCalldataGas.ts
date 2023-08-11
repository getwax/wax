import assert from './helpers/assert';

export default function measureCalldataGas(calldata: string) {
  assert(/^0x([0-9a-f][0-9a-f])*$/i.test(calldata));

  let gas = 0n;

  for (let i = 2; i < calldata.length; i += 2) {
    if (calldata.slice(i, i + 2) === '00') {
      gas += 4n;
    } else {
      gas += 16n;
    }
  }

  return gas;
}

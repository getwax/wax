import { ethers } from 'ethers';
import { z } from 'zod';
import SimpleAccountWrapper, {
  SimpleAccountData,
} from './SimpleAccountWrapper';
import never from '../helpers/never';
import IAccount from './IAccount';
import SafeECDSAAccountWrapper, {
  SafeECDSAAccountData,
} from './SafeECDSAAccontWrapper';
import SafeCompressionAccountWrapper, {
  SafeCompressionAccountData,
} from './SafeCompressionAccountWrapper';

const AccountData = z.union([
  SimpleAccountData,
  SafeECDSAAccountData,
  SafeCompressionAccountData,
]);

type AccountData = z.infer<typeof AccountData>;

export default AccountData;

// eslint-disable-next-line @typescript-eslint/require-await
export async function makeAccountWrapper(
  data: AccountData,
  provider: ethers.BrowserProvider,
): Promise<IAccount> {
  if (data.type === 'SimpleAccount') {
    return SimpleAccountWrapper.fromData(data, provider);
  }

  if (data.type === 'SafeECDSAAccount') {
    return SafeECDSAAccountWrapper.fromData(data, provider);
  }

  if (data.type === 'SafeCompressionAccount') {
    return SafeCompressionAccountWrapper.fromData(data, provider);
  }

  return never(data);
}

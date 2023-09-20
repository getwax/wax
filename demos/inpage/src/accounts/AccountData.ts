import { z } from 'zod';
import SimpleAccountWrapper, {
  SimpleAccountData,
} from './SimpleAccountWrapper';
import WaxInPage from '..';
import never from '../helpers/never';
import IAccount from './IAccount';
import SafeECDSAPluginAccount, {
  SafeECDSAAccountData,
} from './SafeECDSAAccountWrapper';

const AccountData = z.union([SimpleAccountData, SafeECDSAAccountData]);

type AccountData = z.infer<typeof AccountData>;

export default AccountData;

// eslint-disable-next-line @typescript-eslint/require-await
export async function makeAccountWrapper(
  data: AccountData,
  waxInPage: WaxInPage,
): Promise<IAccount> {
  if (data.type === 'SimpleAccount') {
    return SimpleAccountWrapper.fromData(data, waxInPage);
  }

  if (data.type === 'SafeECDSAAccount') {
    return SafeECDSAPluginAccount.fromData(data, waxInPage);
  }

  return never(data);
}

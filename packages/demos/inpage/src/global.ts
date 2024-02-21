import './compatibility';
import { z } from 'zod';
import WaxInPage from '.';

const globalRecord = globalThis as Record<string, unknown>;

const parsedConfig = z
  .object({
    rpcUrl: z.string(),
  })
  .safeParse(globalRecord.waxInPageConfig);

if (!parsedConfig.success) {
  throw new Error(parsedConfig.error.toString());
}

WaxInPage.global({
  rpcUrl: parsedConfig.data.rpcUrl,
});

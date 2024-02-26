import { z } from 'zod';

export default function ZodNotUndefined() {
  return z.custom<Exclude<unknown, undefined>>((x) => x !== undefined);
}

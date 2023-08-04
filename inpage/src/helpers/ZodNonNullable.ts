import { z } from 'zod';

export default function ZodNonNullable() {
  return z.custom<NonNullable<unknown>>((x) => x !== null && x !== undefined);
}

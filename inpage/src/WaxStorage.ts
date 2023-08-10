/* eslint-disable @typescript-eslint/require-await */
import { mapValues } from '@s-libs/micro-dash';
import z from 'zod';

const defaultField = <T>(type: z.ZodType<T>, default_: T) => ({
  type,
  default_,
});

const optionalField = <T>(type: z.ZodType<T>) => ({
  type: z.union([z.undefined(), type]),
  default_: undefined,
});

const schema = {
  connectedAccounts: defaultField(z.array(z.string()), []),
  account: optionalField(
    z.object({
      privateKey: z.string(),
      ownerAddress: z.string(),
      address: z.string(),
    }),
  ),
};

type Field<T> = {
  get(): Promise<T>;
  set(value: T): Promise<void>;
  clear(): Promise<void>;
};

export type WaxStorage = {
  [K in keyof typeof schema]: Field<z.infer<(typeof schema)[K]['type']>>;
} & {
  clear(): Promise<void>;
};

export default function makeLocalWaxStorage() {
  const fields = mapValues(schema, ({ type, default_ }, key) => ({
    async get() {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      const raw = localStorage.getItem(`wax-${key}`);

      if (raw === null) {
        return structuredClone(default_);
      }

      return type.parse(JSON.parse(raw));
    },

    async set(value: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      localStorage.setItem(`wax-${key}`, JSON.stringify(type.parse(value)));
    },

    async clear() {
      localStorage.removeItem(`wax-${key}`);
    },
  }));

  return {
    ...fields,

    async clear() {
      for (const key of Object.keys(schema)) {
        localStorage.removeItem(`wax-${key}`);
      }
    },
  } as WaxStorage;
}

export default function never(value: never): never {
  throw new Error(`Expected ${JSON.stringify(value)} to not be possible`);
}

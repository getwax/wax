export default function assert(
  condition: boolean,
  msg = 'Assertion failed',
): asserts condition {
  if (!condition) {
    throw new Error(msg);
  }
}

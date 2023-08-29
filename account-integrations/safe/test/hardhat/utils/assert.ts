export default function assert(
  condition: unknown,
  msg = "Assertion failed"
): asserts condition {
  if (!condition) {
    throw new AssertionError(msg);
  }
}

class AssertionError extends Error {
  name = "AssertionError";
}

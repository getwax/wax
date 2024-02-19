export default function assert(
    condition: unknown,
    msg = 'Assertion failed',
): asserts condition {
    if (!condition) {
        // eslint-disable-next-line no-debugger
        debugger;
        throw new AssertionError(msg);
    }
}

class AssertionError extends Error {
    name = 'AssertionError';
}
  
/**
 * Slightly nicer alternative to an async iife:
 *
 *     (async () => {
 *       // Do async things
 *     })()
 *
 * Also a way to satisfy typescript eslint's no-floating-promises rule.
 */
export default function runAsync(fn: () => Promise<unknown>) {
  fn().catch((e) => {
    // eslint-disable-next-line no-console
    console.error('Uncaught exception in runAsync fn:', e);
  });
}

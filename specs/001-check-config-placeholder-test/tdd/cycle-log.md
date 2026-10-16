# Cycle Log: Preflight test supplies its own placeholder KV namespace id

Append only. Newest last. Every entry's `red` block is the evidence that the test existed and failed before the implementation.

## Baseline

- suite: `npm test` -> 34 tests, 33 passed, 1 failed (exit 1), after `npm ci` from the committed lock file
- commit: `b2c21b7`
- the one failure is `configuration preflight distinguishes local checks from deployment placeholders` at `tests/check-config.test.js:23`: `AssertionError: Expected values to be strictly equal: 0 !== 1`
- cause: commit `232f3ff` replaced the placeholder SYNC KV namespace id in `wrangler.jsonc` with a real 32-character id, so the deploy-mode preflight on the committed file now passes
- deviation from the loop's green-baseline rule: the baseline is red, but the only red is the test this feature repairs, and every other test is green.
  Any red produced during the loop is therefore attributable to this change, which is the reason the rule exists.
  Firstmate's brief directs the repair explicitly, so the loop proceeds instead of stopping at the escape hatch.

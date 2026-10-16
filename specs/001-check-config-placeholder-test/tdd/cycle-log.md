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

## Cycle 1: A1 deploy-mode preflight refuses a placeholder SYNC KV id

- test: `tests/check-config.test.js::configuration preflight distinguishes local checks from deployment placeholders` (existing name kept, body changed so the deploy-mode run goes through a placeholder configuration root, with a stub `placeholderRoot()` that returned the repository root)
- red: `node --test-name-pattern "configuration preflight distinguishes" tests/check-config.test.js`
  -> `ℹ tests 1`, `✖ configuration preflight distinguishes local checks from deployment placeholders`, `AssertionError: Expected values to be strictly equal: 0 !== 1` at `tests/check-config.test.js:28` (the deploy-mode status assertion)
- green: replaced the stub with `withPlaceholderRoot(run)`, which creates a temporary directory, copies `scripts/check-config.mjs`, `worker/version.js`, `package.json` and `public/sw.js`, writes `wrangler.jsonc` with the SYNC namespace id replaced by `REPLACE_WITH_YOUR_KV_NAMESPACE_ID`, runs the callback and removes the directory in `finally`.
  Single test -> `ℹ tests 1`, `ℹ pass 1`.
  Suite `npm test` -> 34 passed, 0 failed.
  Temporary directories matching `/tmp/core-break-preflight-*` before and after the suite: 0 and 0.
- refactor: none needed, the helper is the smallest shape that keeps cleanup in a `finally`
- commit: `9549753`

## Cycle 2: A2 local-mode preflight permits the placeholder configuration (characterization)

- test: same test, new assertions that `--local` on the placeholder root exits 0 and prints `Configuration preflight passed`
- red: not available by construction, the preflight already behaves this way, so the new assertions passed on first run (`ℹ tests 1`, `ℹ pass 1`).
  Deliberate mutant M1 applied to `scripts/check-config.mjs`: `if (!local && syncNamespace?.id === placeholderNamespaceId)` changed to `if (syncNamespace?.id === placeholderNamespaceId)`.
  `node --test-name-pattern "configuration preflight distinguishes" tests/check-config.test.js` -> `ℹ fail 1`, `AssertionError ... 1 !== 0`, so the assertion bites.
  `git checkout -- scripts/check-config.mjs` restored the file exactly (`git status` showed only the test file), and the same command passed again.
- green: no source change
- suite: `npm test` -> 34 passed, 0 failed
- refactor: none needed
- commit: `f26ab7d`

## Cycle 3: U1 a placeholder replacement that does not apply fails with a clear message

- test: guard `assert.match(wrangler, SYNC_NAMESPACE_ID, 'wrangler.jsonc has no SYNC KV namespace id to replace with the placeholder')` before the replacement in `withPlaceholderRoot`
- red: deliberate mutant M3 applied to the test's own pattern (`"SYNC"` changed to `"SYNX"`) against the test without the guard.
  `node --test-name-pattern "configuration preflight distinguishes" tests/check-config.test.js` -> `ℹ fail 1`, `0 !== 1`.
  The failure is real but says nothing about the fixture, which is the gap this behavior closes.
- green: the guard was added and the pattern lifted into a named constant `SYNC_NAMESPACE_ID`.
  With M3 re-applied the failure now reads `AssertionError: wrangler.jsonc has no SYNC KV namespace id to replace with the placeholder`.
  M3 was then reverted by the exact inverse edit, `git diff --stat` showed only the intended 3 insertions and 1 deletion, and the single test passed.
  Suite `npm test` -> 34 passed, 0 failed.
- refactor: none needed
- commit: `a4f4772`

## Notes and deviations

- The baseline was red, and the only red was this feature's own test.
  See the Baseline entry for why the loop proceeded.
- Cycle 1 used the stub-then-implement shape from the playbook: the red run used a stub that returned the repository root, so the red is the same `0 !== 1` a real placeholder-free run produces, for the right reason.
  The red state was never committed.
- Cycles 2 and 3 are mutant-first rather than test-first by nature: A2 characterizes behavior the preflight already has, and U1 is a guard inside test code that cannot be tested without exporting the helper, which would add production-shaped surface for no benefit.
- Task ticks: T001 to T006 are covered by the completed behaviors A1, A2, A3 and U1.

## Remediation 1: verification finding 1, label the preflight assertions

- change: each of the six assertions in the test gained a message naming the root (committed or placeholder) and mode (local or deploy).
  Structural diagnostics change on green, no behavior change, so no new red; the proof is the mutant rerun below.
- green before and after: single test `ℹ tests 1`, `ℹ pass 1`; suite `npm test` -> 34 passed, 0 failed; `npm run check` passed; `npm run build` succeeded.
- mutant rerun: M1 (`!local &&` removed) now fails with `placeholder configuration, local mode: exit status`; M5 (`{32}` to `{33}`) now fails with `committed configuration, local mode: exit status`.
  Both were restored with `git checkout`, and `git diff` showed only the intended test change.
- refactor: none needed
- commit: `9526c5c`

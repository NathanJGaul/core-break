# Tasks: Preflight test supplies its own placeholder KV namespace id

**Input**: `specs/001-check-config-placeholder-test/spec.md` and `plan.md`

**Tests**: Required.
The deliverable is itself a test, so the test tasks are the behavior work and no production code changes (FR-007).

## Test-first behavior tasks (mandatory and first)

- [ ] T001 [A1] In `tests/check-config.test.js`, make the deploy-mode assertion run against a placeholder configuration root through a stubbed `placeholderRoot()` and record the red (`0 !== 1`) in `tdd/cycle-log.md`.
- [ ] T002 [A2] In `tests/check-config.test.js`, assert that local mode passes on the placeholder configuration root, and prove it bites with a deliberate mutant of the preflight.
- [ ] T003 [A3] Keep the existing assertion that local mode passes on the committed repository configuration, and prove it still runs by naming it in the cycle log.
- [ ] T004 [U1] In `tests/check-config.test.js`, fail with a clear message when the placeholder replacement did not apply, and prove it with a deliberate mutant of the replacement pattern.

## Implementation tasks

- [ ] T005 [A1] Implement `placeholderRoot()` in `tests/check-config.test.js`: create a temporary directory, copy `scripts/check-config.mjs`, `worker/version.js`, `package.json` and `public/sw.js`, write `wrangler.jsonc` with the SYNC namespace id replaced by the placeholder, and return the directory.
- [ ] T006 [A1] Change `runCheck` in `tests/check-config.test.js` to take the root directory to run in, and remove the temporary directory in a `finally` block.
- [ ] T007 Leave `scripts/check-config.mjs`, `wrangler.jsonc` and every other tracked file untouched, and confirm with `git diff --stat`.

## Remediation and verification

- [ ] T008 [A4] Run `npm test`, `npm run check` and `npm run build` and record the counts.
- [ ] T009 Run the deliberate mutants against the preflight and the test input, restore each exactly, and record the results in `tdd/verification.md`.
- [ ] T010 Run the checklist, analyze and converge steps and record the findings in `checklist.md`, `analyze.md` and `converge.md`.

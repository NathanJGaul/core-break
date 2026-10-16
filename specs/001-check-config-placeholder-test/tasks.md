# Tasks: Preflight test supplies its own placeholder KV namespace id

**Input**: `specs/001-check-config-placeholder-test/spec.md` and `plan.md`

**Tests**: Required.
The deliverable is itself a test, so the test tasks are the behavior work and no production code changes (FR-007).

## Test-first behavior tasks (mandatory and first)

- [x] T001 [A1] In `tests/check-config.test.js`, make the deploy-mode assertion run against a placeholder configuration root through a stubbed `placeholderRoot()` and record the red (`0 !== 1`) in `tdd/cycle-log.md`.
- [x] T002 [A2] In `tests/check-config.test.js`, assert that local mode passes on the placeholder configuration root, and prove it bites with a deliberate mutant of the preflight.
- [x] T003 [A3] Keep the existing assertion that local mode passes on the committed repository configuration, and prove it still runs by naming it in the cycle log.
- [x] T004 [U1] In `tests/check-config.test.js`, fail with a clear message when the placeholder replacement did not apply, and prove it with a deliberate mutant of the replacement pattern.

## Implementation tasks

- [x] T005 [A1] Implement `withPlaceholderRoot(run)` in `tests/check-config.test.js` in place of the stub: create a temporary directory, copy `scripts/check-config.mjs`, `worker/version.js`, `package.json` and `public/sw.js`, write `wrangler.jsonc` with the SYNC namespace id replaced by the placeholder, run the callback against the directory and remove it in a `finally` block.
- [x] T006 [A1] Change `runCheck` in `tests/check-config.test.js` to take the root directory to run in.
- [ ] T007 Leave `scripts/check-config.mjs`, `wrangler.jsonc` and every other tracked file untouched, and confirm with `git diff --stat`.

## Remediation and verification

- [ ] T008 [A4] Run `npm test`, `npm run check` and `npm run build` and record the counts.
- [ ] T009 Run the deliberate mutants against the preflight and the test input, restore each exactly, and record the results in `tdd/verification.md`.
- [ ] T010 Run the checklist, analyze and converge steps and record the findings in `checklist.md`, `analyze.md` and `converge.md`.

## Phase 4: TDD remediation

- [ ] T011 Finding 1 (MED, `tests/check-config.test.js:45-55`): add a message to each of the six assertions naming the root (committed or placeholder) and mode (local or deploy), so two failures such as mutants M1 and M5 no longer print the same `1 !== 0`.
  Done when `node --test-name-pattern "configuration preflight distinguishes" tests/check-config.test.js` passes and re-running mutant M1 (`!local &&` removed in `scripts/check-config.mjs`) fails with a message that names the placeholder local-mode assertion.

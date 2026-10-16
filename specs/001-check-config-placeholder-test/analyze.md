# Implementation analysis: Preflight test supplies its own placeholder KV namespace id

## Alignment

- AC-1 and FR-001 map to the deploy-mode run on the placeholder root in `tests/check-config.test.js`.
- AC-2 and FR-002 map to the local-mode run on the same placeholder root.
- AC-3 and FR-003 map to the local-mode run on the repository root, which is the original assertion kept as is.
- AC-4 and SC-001 map to the full `npm test` run, 34 passed and 0 failed.
- FR-004 maps to `withPlaceholderRoot`, which writes only inside a `mkdtemp` directory and reads the repository files.
- FR-005 maps to the `assert.match` guard on the replacement pattern.
- FR-006 and FR-007 map to the unchanged test name and the unchanged `scripts/check-config.mjs`.
- SC-002 maps to mutants M1, M2, M4 and M5 on the preflight, all caught.
- SC-003 maps to `git diff --stat b2c21b7 -- . ':!specs'`, which lists only the test file.
- SC-004 maps to `npm run check` and `npm run build`, both green.
- Plan decisions hold in the code: the real script is copied, no preflight override was added, and the placeholder constant is declared in the test.

## Findings

- Spec-plan-tasks are consistent.
  The only drift found was task wording that named a `placeholderRoot()` helper while the code uses `withPlaceholderRoot(run)`; the task text was corrected before the loop closed.
- Verification finding 1 (assertion roulette) is resolved by T011.
- Verification findings 2 and 3 are accepted with reasons recorded in `tdd/verification.md`.
- No duplicated, ambiguous or underspecified requirement remains, and no requirement lacks a task or a test.

## Observations outside this change

- `README.md:17` still tells operators to replace the placeholder in `wrangler.jsonc`, which describes the repository before commit `232f3ff`.
  It is operator guidance for a fresh fork rather than a statement about the committed file, and documentation is out of this task's scope, so it is left alone.
- `specs/core-break-improvement/converge.md` says the deployment-mode preflight is intentionally blocked by the placeholder.
  That has been false since `232f3ff`; the earlier feature's artifacts are history and are not edited here.
- The constitution is the unfilled template, so no constitution findings could be produced.

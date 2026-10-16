# Quality gates checklist: Preflight test supplies its own placeholder KV namespace id

**Purpose**: Record the quality gates for the completed implementation.
**Created**: 2026-10-16
**Feature**: [spec.md](./spec.md)

## Behavior

- [x] CHK001 Deploy mode on a placeholder SYNC KV id exits 1 with `placeholder KV namespace ID is not deployable` (AC-1, A1, cycle 1).
- [x] CHK002 Local mode on the same placeholder configuration exits 0 with `Configuration preflight passed` (AC-2, A2, cycle 2).
- [x] CHK003 Local mode on the committed configuration exits 0 with `Configuration preflight passed` (AC-3, A3, baseline).
- [x] CHK004 A replacement that cannot apply fails with a message naming the problem instead of passing vacuously (FR-005, U1, cycle 3).
- [x] CHK005 The test keeps its name `configuration preflight distinguishes local checks from deployment placeholders` (FR-006).

## Scope

- [x] CHK006 `git diff --stat b2c21b7 -- . ':!specs'` lists only `tests/check-config.test.js` (FR-004, FR-007).
- [x] CHK007 `wrangler.jsonc` still holds the real namespace id and `scripts/check-config.mjs` is unchanged.
- [x] CHK008 No test was deleted, skipped, filtered or loosened, and no dependency was added.

## Verification

- [x] CHK009 `npm test` reports 34 tests, 34 passed, 0 failed (AC-4, SC-001).
- [x] CHK010 `npm run check` passes and `npm run build` succeeds (SC-004).
- [x] CHK011 Five deliberate mutants were caught and restored exactly (SC-002), recorded in `tdd/verification.md`.
- [x] CHK012 The test passes whether the committed id is the placeholder or another real id (spec edge cases, probes E1 and E2).
- [x] CHK013 No temporary directory is left behind after a passing or failing run (probe E3).

## Process

- [x] CHK014 The test list, cycle log, verification report and task ticks agree with each other.
- [ ] CHK015 The constitution carries an approved TDD principle: open, the constitution is still the unfilled template and its wording needs captain approval, which is outside this task.

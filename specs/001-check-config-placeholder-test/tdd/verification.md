---
feature: 001-check-config-placeholder-test
verdict: PASS_WITH_GAPS
standard: .specify/extensions/tdd/templates/tdd-test-quality-rubric.md # rubric graded against
verified_at: 2933bdc # short SHA audited
behaviors: 5
proven: 2
likely: 1
test_after: 0
no_test: 0
not_applicable: 2 # A2 and A3, characterization baselines
high_smells: 0
criteria_total: 4
criteria_covered: 4
mutation_score: n/a # no mutation tool in the profile; 5 deliberate mutants, 5 caught, scope: scripts/check-config.mjs (4) and the test's own replacement pattern (1)
mutants_survived: 0
suite: 34 passed, 0 failed, 2.7s
---

# TDD Verification: Preflight test supplies its own placeholder KV namespace id

**Verdict: PASS_WITH_GAPS.** Every acceptance criterion is covered through the real script and every deliberate mutant was caught, but there is no mutation tool, one behavior (U1) has only mutant-based evidence, and one MED finding on failure specificity is open.

This audit was run by the worker that wrote the change, not from a cold context, because no separate reviewer was available inside the task.
Independent review is left to the no-mistakes pipeline that follows.

## Test-first evidence

| Behavior | Class | Evidence |
| --- | --- | --- |
| A1 | PROVEN | cycle 1 records the red (`0 !== 1` at `tests/check-config.test.js:28`) from a stubbed placeholder root before the helper existed; `9549753` adds the helper and the changed test together, and the red state was never committed |
| A2 | NOT_APPLICABLE | characterization, green on first run by definition; mutant M1 (repeated in this audit) turns it red with `1 !== 0` |
| A3 | NOT_APPLICABLE | characterization baseline, the assertion existed and passed before the change; mutant M5 turns it red with `1 !== 0` |
| A4 | PROVEN | baseline entry records `npm test` at 33 passed, 1 failed; after cycle 3 it is 34 passed, 0 failed, re-run in this audit |
| U1 | LIKELY | cycle 3 records a mutant-first red (`0 !== 1`, no message naming the fixture) and the guarded failure message; the guard is test code, so there is no earlier failing test to corroborate in history, and `a4f4772` adds guard and constant together |

Existing tests: one test existed and still exists under the same name, so nothing was renamed, skipped, filtered or excluded.
No assertion was removed or loosened.
The deploy-mode assertion keeps the same expectations (`status` 1 and the same message pattern) and changed only its input, from the committed `wrangler.jsonc`, which no longer holds a placeholder after `232f3ff`, to a derived placeholder configuration.
The local-mode assertion on the committed configuration is unchanged.
Two assertions were added (placeholder local mode, replacement guard).
No coverage or mutation threshold exists to lower.

Task ticks: T001 to T006 are ticked and their behaviors (A1, A2, A3, U1) are `DONE` or `BASELINE` on the list, so there is no completion claim without evidence and no unticked behavior task with a finished behavior.

## Findings

| # | Severity | Finding | Evidence |
| --- | --- | --- | --- |
| 1 | MED | Assertion roulette: six unlabelled assertions in one test, so a failure does not say which run broke. Mutants M1 and M5 fail at different assertions yet print the same `1 !== 0` | `tests/check-config.test.js:45-55`; remediation T011 |
| 2 | MED | Eager test: one test exercises A1, A2 and A3. Accepted: FR-006 and the captain's direction keep the original test name, and the original test already combined local and deploy runs. Labelled assertions (finding 1) recover the specificity | `tests/check-config.test.js:43`; no task |
| 3 | LOW | `PREFLIGHT_INPUTS` couples the test to the files the preflight reads. If the preflight starts reading another file, the copied script fails with a missing-file error in the child, which fails the test loudly rather than passing vacuously | `tests/check-config.test.js:9`; accepted, no task |
| 4 | INFO | Coverage attribution moved: the failure-report block of `scripts/check-config.mjs` (lines 115-118) no longer appears covered, because the placeholder run executes a temporary copy of the script, a different file path. The refusal behavior itself is pinned by mutants M2 and M4 | coverage run, corroboration only |

No HIGH smells.
Smell catalogue items checked without a finding: assertion free, tautological assertion, re-implemented expectation, doubled subject, over-mocked collaborators, vacuous assertion, conditional logic in the test (the only `try`/`finally` is cleanup, not a branch over assertions), empty or skipped test, implementation coupled (the asserted exit code and message are the observable output of the script), magic values (placeholder and input list are named constants), mystery guest (inputs are read visibly from the repository), non-deterministic (unique `mkdtemp` directory, no clock, no network), sleepy test, redundant test, foreign style (same `node:test`, `assert/strict` and `process.execPath` spawn shape as the exemplar it extends), bypassed test utility (the profile's helpers cover Worker, UI and storage fakes, none applies), framework under test, duplicated setup, unclear name.
Suite properties: isolated (own temporary directory, nothing tracked is written), deterministic, fast (the test runs in about 0.1 s), insensitive to the real id (E1 and E2 below).

## Mutation results

No mutation tool is in the profile, so these are deliberate mutants, one at a time, each restored with `git checkout` and confirmed with a clean `git diff`.
Sampled behaviors: A1, A2, A3 and U1, the ones the acceptance criteria depend on.
This sample is not exhaustive: it covers the changed test's behaviors, not the whole preflight.

| Mutant | File | Behavior | Survived | Judgment |
| --- | --- | --- | --- | --- |
| M1 local mode also refuses the placeholder (`!local &&` removed) | `scripts/check-config.mjs` | A2 | No | caught, `1 !== 0` |
| M2 deploy-mode placeholder refusal line removed | `scripts/check-config.mjs` | A1 | No | caught, `0 !== 1` |
| M4 refusal message changed | `scripts/check-config.mjs` | A1 | No | caught, regex did not match |
| M5 real id format no longer accepted (`{32}` to `{33}`) | `scripts/check-config.mjs` | A3 | No | caught, `1 !== 0` on the committed configuration |
| M3 replacement pattern cannot match (`"SYNC"` to `"SYNX"`) | `tests/check-config.test.js` | U1 | No | caught, with the message `wrangler.jsonc has no SYNC KV namespace id to replace with the placeholder` |

Probes of the spec's edge cases, each restored and confirmed clean:

| Probe | Result |
| --- | --- |
| E1 committed id replaced by the placeholder | test passes |
| E2 committed id replaced by a different real 32-character id | test passes |
| E3 temporary directories left under `/tmp` after each failing mutant run | 0 every time |

Coverage was run as corroboration only: `scripts/check-config.mjs` 89.08% line, 59.09% branch, 100% function; all files 81.06% line, unchanged from the profile's baseline.

## Traceability

| Criterion | Tests | End to end |
| --- | --- | --- |
| AC-1 deploy mode refuses the placeholder | A1 | Yes, spawns the real script copy as a process |
| AC-2 local mode permits the placeholder | A2 | Yes |
| AC-3 local mode passes on the committed configuration | A3 | Yes, spawns `scripts/check-config.mjs` in the repository |
| AC-4 suite passes | A4 | Yes, `npm test` |

Requirements: FR-001, FR-002 and FR-003 by A1, A2 and A3; FR-004 by `git diff --stat b2c21b7 -- . ':!specs'`, which lists only `tests/check-config.test.js`; FR-005 by U1; FR-006 by the unchanged test name; FR-007 by the same diff showing no change to `scripts/check-config.mjs`.
Untested criteria: none.
Tests tracing to nothing: none.

## What was not audited

- Mutation was limited to five deliberate mutants, not a tool run, and not the rest of the preflight's checks (version, binding and migration checks), which are outside this change.
- The suite was run on Node 24.22.0 only, not on Node 22, which CI uses.
- Windows path handling of the temporary copy was not exercised; the test uses `node:path` and `node:os` throughout.
- `npm run check` and `npm run build` are recorded in the implement step, not here.
- The audit was not run from a cold context.

## Remediation tasks

Recorded in `tasks.md` as T011.
T011 was completed after this audit in commit `9526c5c`, and mutants M1 and M5 were re-run against the labelled assertions and now name the assertion that broke.
The verdict is unchanged because the remaining gaps are the missing mutation tool and the mutant-based evidence for U1.

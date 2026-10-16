---
feature: 001-check-config-placeholder-test
loop: outside-in
profile: .specify/memory/tdd-profile.md
spec_criteria: 4
planned_at: b2c21b7
updated_at: a4f4772
suite_baseline: red
---

# Test List: Preflight test supplies its own placeholder KV namespace id

The only red in the baseline suite is the test this feature repairs, so any red produced during the loop is attributable to this change.
No production code changes, so every behavior is exercised by the existing test `configuration preflight distinguishes local checks from deployment placeholders` in `tests/check-config.test.js`.

## Outer loop: acceptance behaviors

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| A1 | Deploy-mode preflight on a configuration holding the placeholder SYNC KV id exits 1 and reports `placeholder KV namespace ID is not deployable` | AC-1, FR-001, FR-004 | example | DONE | `tests/check-config.test.js::configuration preflight distinguishes local checks from deployment placeholders` |
| A2 | Local-mode preflight on the same placeholder configuration exits 0 and reports `Configuration preflight passed` | AC-2, FR-002 | characterization | BASELINE | same test (green on first run, bites under mutant M1, cycle 2) |
| A3 | Local-mode preflight on the committed repository configuration exits 0 and reports `Configuration preflight passed` | AC-3, FR-003 | characterization | BASELINE | same test (assertion already present and green at baseline) |
| A4 | The full suite passes | AC-4, SC-001 | example | DONE | `npm test` |

## Inner loop: unit behaviors

### `tests/check-config.test.js` placeholder configuration builder

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1 | A placeholder replacement that did not apply fails the test with a message naming the problem instead of passing or failing downstream | FR-005 | example | DONE | guard assertion inside the builder, proven by a mutant of the replacement pattern |

## Invariants and edge cases still to place

- The temporary directory is removed after the run, including when an assertion fails: checked by counting `core-break-preflight-*` entries in the OS temp directory before and after, recorded in the cycle log.
- `wrangler.jsonc` and `scripts/check-config.mjs` are unchanged: checked with `git diff --stat` against the base commit, recorded in the verification report.

## Out of scope

- A deploy-mode run against the committed configuration: it would tie the test to whatever id the file currently holds, which is the cause of this failure.
- Changes to the preflight, an override flag, or exporting the placeholder constant: the brief forbids preflight changes unless the test cannot be fixed without them.
- `test/core.test.js`, the duplicate `package.json` scripts, and `scripts/check.js`: separate legacy issues listed in the TDD profile.
- Mutation and property tools: none in `package-lock.json`, so deliberate mutants stand in.

## Verification commands

Copied verbatim from `.specify/memory/tdd-profile.md`:

- Single test: `node --test-name-pattern "{name}" {file}` (direct file run, never `node --test`; a run counts only when the output shows `ℹ tests 1` and the expected name)
- Full suite: `npm test`
- Coverage: `node --test --experimental-test-coverage tests/*.test.js`
- Mutation: none, deliberate mutants only

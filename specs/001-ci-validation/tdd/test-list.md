---
feature: 001-ci-validation
loop: outside-in
profile: .specify/memory/tdd-profile.md
spec_criteria: 3
planned_at: b773ed6
updated_at: b773ed6
suite_baseline: red
---

# Test List: CI Validation Workflow

## Outer loop: acceptance behaviors

The feature has a repository-level workflow entry point but no configured acceptance runner. Behaviors remain listed so the missing test capability is explicit rather than silently omitted.

| id  | behavior | traces | kind | state | test |
| --- | --------- | ------ | ---- | ----- | ---- |
| A1 | A pull request selects a Node.js 22 validation job that runs `npm ci`, `npm test`, `npm run check`, and `npm run build` as separate required steps | FR-001, FR-003, FR-004, FR-005, AC-001 | example | BLOCKED — no test runner or acceptance runner exists | |
| A2 | A failing required command causes the validation workflow to fail without masking the command failure | FR-005, AC-002 | example | BLOCKED — no test runner or acceptance runner exists | |
| A3 | A push to `master` selects the same validation job without selecting deployment automation | FR-002, FR-006, AC-003 | example | BLOCKED — no test runner or acceptance runner exists | |

## Inner loop: unit behaviors

No inner-loop unit behaviors apply. The requested change is a single workflow configuration file, not an application component, and the repository has no test runner with which to test configuration behavior.

## Invariants and edge cases still to place

- The workflow must contain exactly one validation workflow under `.github/workflows/` for this feature.
- The four requested command invocations must remain separate steps in the stated order.
- No deployment or release command may appear in the validation workflow.

These invariants are recorded for manual review because no executable test capability is available.

## Out of scope

- Adding a JavaScript test framework, test files, or `test`/`check` package scripts.
- Modifying application source, lockfile, or deployment configuration.
- Deploying from CI or adding release automation.

## Verification commands

Copied from `.specify/memory/tdd-profile.md` at planning time:

- Single test: null (no test runner)
- File test: null (no test runner)
- Full suite: null (`npm test` is undefined)
- Coverage: null (no coverage tool)
- Mutation: null (no mutation tool)
- Acceptance: null (no acceptance runner)

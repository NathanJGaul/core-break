# Feature Specification: Preflight test supplies its own placeholder KV namespace id

**Feature Branch**: `fm/core-break-check-config-test` (spec directory `001-check-config-placeholder-test`)

**Created**: 2026-10-16

**Status**: Approved (scope fixed by the captain's intent and the Firstmate spec in the launch brief; no further approval gate is available to this worker)

**Input**: User description: "Fix the failing test `configuration preflight distinguishes local checks from deployment placeholders` in `tests/check-config.test.js` so CI on master is green again.
Commit 232f3ff replaced the placeholder KV namespace id in `wrangler.jsonc` with the real id.
The test expects the deploy preflight to refuse the placeholder id, but now gets exit 0 instead of 1 because the config no longer holds a placeholder.
Keep the test's intent and give it its own placeholder input, and do not delete it."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Release maintainer trusts the placeholder guard (Priority: P1)

A release maintainer relies on the configuration preflight to refuse a deploy while the KV namespace id is still the placeholder.
The automated test for that guard must prove the refusal on its own input, regardless of what id the committed `wrangler.jsonc` currently holds.

**Why this priority**: The guard is the only protection against deploying with an unprovisioned KV namespace.
Its test is currently red on master, so CI cannot gate any change and the guard is effectively unverified.

**Independent Test**: Run `node --test-name-pattern "configuration preflight" tests/check-config.test.js` and see the test pass with the real id in `wrangler.jsonc`.
Replace the id in `wrangler.jsonc` with the placeholder or with another real id and see the same test result.

**Acceptance Scenarios**:

- **AC-1**: **Given** a configuration whose SYNC KV namespace id is the placeholder `REPLACE_WITH_YOUR_KV_NAMESPACE_ID`, **When** the preflight runs in deploy mode, **Then** it exits 1 and reports `placeholder KV namespace ID is not deployable`.
- **AC-2**: **Given** the same placeholder configuration, **When** the preflight runs in local mode (`--local`), **Then** it exits 0 and reports `Configuration preflight passed`.
- **AC-3**: **Given** the committed repository configuration holding a real namespace id, **When** the preflight runs in local mode, **Then** it exits 0 and reports `Configuration preflight passed`.

---

### User Story 2 - Contributor gets a green CI signal on master (Priority: P1)

A contributor pushing to master needs `npm test` to pass so the CI sequence (`npm ci`, `npm test`, `npm run check`, `npm run build`) can reach its later steps.

**Why this priority**: The red test blocks every other change from a trustworthy CI result.

**Independent Test**: Run `npm test` and see zero failing tests.

**Acceptance Scenarios**:

- **AC-4**: **Given** the committed repository state, **When** `npm test` runs, **Then** every test passes and the exit code is 0.

---

### Edge Cases

- The real id in `wrangler.jsonc` changes later to another real id: the test result does not change, because the placeholder input is derived inside the test.
- The real id in `wrangler.jsonc` is ever reverted to the placeholder: the test still passes, because the test forces the placeholder rather than depending on the file's current value.
- The placeholder input cannot be built, for example because the SYNC namespace entry is missing from `wrangler.jsonc`: the test fails loudly instead of silently passing without proving the refusal.
- The test must not read or write anything outside the repository and a temporary directory, and must remove the temporary directory afterwards.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The test MUST exercise the real `scripts/check-config.mjs` against a configuration whose SYNC KV namespace id is the placeholder, and assert exit 1 with `placeholder KV namespace ID is not deployable` in deploy mode.
- **FR-002**: The test MUST assert that the same placeholder configuration passes in local mode with exit 0 and `Configuration preflight passed`.
- **FR-003**: The test MUST keep asserting that the committed repository configuration passes in local mode.
- **FR-004**: The placeholder input MUST be created by the test itself, in a temporary location, without modifying `wrangler.jsonc` or any other tracked file.
- **FR-005**: The test MUST fail, not pass vacuously, if the placeholder input could not be produced.
- **FR-006**: The test MUST keep its current name, `configuration preflight distinguishes local checks from deployment placeholders`.
- **FR-007**: The preflight script `scripts/check-config.mjs` MUST NOT change behavior.

### Key Entities

- **Placeholder configuration**: a temporary copy of the repository files the preflight reads, identical to the committed files except that the SYNC KV namespace id is the placeholder.
- **Preflight run**: one spawn of the real script in either deploy mode or local mode, observed through its exit status and output.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `npm test` reports 0 failing tests and exits 0.
- **SC-002**: With the preflight's placeholder refusal removed (a deliberate mutant), the target test fails.
- **SC-003**: With `wrangler.jsonc` unchanged, `git diff` for the delivered change touches only the test file and this feature's `specs/` artifacts.
- **SC-004**: `npm run check` and `npm run build` still exit 0.

## Assumptions

- The captain chose to keep the test's intent and give it its own placeholder input.
- The preflight reads its inputs through paths relative to its own location and offers no override, so the placeholder input is a temporary copy of the files the preflight reads, with the real script copied alongside.
- The preflight is not changed unless the test cannot be fixed without it; if so, work stops and is reported.
- Out of scope: the Spec-Kit setup, any other test or config, `test/core.test.js`, the duplicate `package.json` scripts, and deploys.
- The project constitution is still the unfilled template, so the constitution gate cannot be checked; the TDD practice in `.specify/memory/tdd-profile.md` is followed instead.

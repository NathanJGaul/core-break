---

description: "Task list for the CI validation workflow"
---

# Tasks: CI Validation Workflow

**Input**: Design documents from `/specs/001-ci-validation/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Acceptance behaviors are listed in `tdd/test-list.md`. The repository has no test runner or `test`/`check` scripts, so the TDD loop records the baseline blocker instead of inventing a test harness.

**Organization**: Tasks are grouped by user story and remain limited to the single workflow requested by the feature.

## Phase 1: Setup

- [X] T001 Confirm the CI workflow path and trigger contract in `specs/001-ci-validation/spec.md` and `specs/001-ci-validation/plan.md`

---

## Phase 2: Foundational

- [X] T002 Confirm `package-lock.json` is the dependency source and preserve the existing package scripts in `package.json`

---

## Phase 3: User Story 1 - Validate pull requests (Priority: P1)

**Goal**: Run all requested validation commands on every pull request using Node.js 22.

**Independent Test**: The workflow definition contains a pull-request trigger and a single validation job with separate `npm ci`, `npm test`, `npm run check`, and `npm run build` steps; no runnable test framework exists in this repository, as recorded in `tdd/test-list.md`.

### Implementation

- [X] T003 [US1] Add `.github/workflows/ci.yml` with a `pull_request` trigger, `ubuntu-latest` validation job, and Node.js 22 setup
- [X] T004 [US1] Add separate fail-fast install and validation steps in `.github/workflows/ci.yml` for `npm ci`, `npm test`, `npm run check`, and `npm run build`

**Checkpoint**: Pull requests select the validation workflow and expose each required command as a distinct check step.

---

## Phase 4: User Story 2 - Validate default-branch updates (Priority: P2)

**Goal**: Run the same validation job after pushes to the repository default branch.

**Independent Test**: The workflow trigger includes `push.branches: [master]` and reuses the same validation job as pull requests.

### Implementation

- [X] T005 [US2] Add the `push` trigger for `master` to `.github/workflows/ci.yml` without adding other branch or deployment triggers

**Checkpoint**: Pushes to `master` and pull requests both use the same validation job.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [X] T006 Update `specs/001-ci-validation/quickstart.md` with the final workflow path and validation command order
- [X] T007 Review `.github/workflows/ci.yml` for deployment commands, release actions, new dependencies, and masked failures; record the result in `specs/001-ci-validation/checklist.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup and preserves the current package contract.
- **User Story 1 (Phase 3)**: Depends on Foundational and creates the workflow.
- **User Story 2 (Phase 4)**: Depends on User Story 1 because it adds the second trigger to the same workflow file.
- **Polish (Phase 5)**: Depends on both user stories.

### Parallel Opportunities

- No implementation tasks are parallelizable because all workflow tasks edit the same file or validate its final state.

### Implementation Strategy

1. Confirm the scope and package baseline.
2. Add one workflow with Node.js 22 and the four required command steps.
3. Add the default-branch push trigger.
4. Run repository checks that are available (`npm run build`); report the existing missing `test` and `check` scripts without adding unrelated behavior.
5. Complete the lifecycle artifacts and commit the workflow plus artifacts together.

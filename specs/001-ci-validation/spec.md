# Feature Specification: CI Validation Workflow

**Feature Branch**: `fm/core-break-ci-workflow`

**Created**: 2026-10-06

**Status**: Approved for implementation

**Input**: User description: "Add CI checks to Core Break. The current pull request has no registered checks because the repository has no GitHub Actions workflow; add the checks needed to validate the submitted Core Break improvements."

## User Scenarios & Testing

### User Story 1 - Validate pull requests (Priority: P1)

As a contributor, I want every pull request to run the repository validation checks automatically so that regressions are reported before review or merge.

**Why this priority**: Pull-request validation is the primary reason for the workflow and directly supplies the missing registered checks.

**Independent Test**: Inspect the workflow definition and run its declared commands in a clean Node 22 environment; each required validation step is present and the workflow fails when any command fails.

**Acceptance Scenarios**:

1. **AC-001** Given a pull request targets the repository, **When** GitHub Actions starts the validation workflow, **Then** it runs on a Node 22 environment, installs dependencies with `npm ci`, and runs `npm test`, `npm run check`, and `npm run build` as separate required steps.
2. **AC-002** Given any required validation command exits unsuccessfully, **When** the workflow runs, **Then** the workflow reports failure and does not report a successful validation result.

---

### User Story 2 - Validate default-branch updates (Priority: P2)

As a maintainer, I want updates pushed to the default branch to run the same validation checks so that the branch remains continuously validated after merges.

**Why this priority**: Default-branch validation protects the shared integration point while reusing the same checks as pull requests.

**Independent Test**: Inspect the workflow trigger definition and confirm a push to the repository's default branch selects the same validation job.

**Acceptance Scenarios**:

1. **AC-003** Given a commit is pushed to the repository's default branch, **When** GitHub Actions evaluates workflow triggers, **Then** the validation workflow starts and runs the same Node 22, install, test, check, and build steps.

---

### Edge Cases

- A pull request event and a default-branch push must each select the validation workflow without requiring a deployment credential or release event.
- The workflow must fail at the command that fails rather than masking errors with a compound command.
- Deployment must not run as part of validation.

## Requirements

### Functional Requirements

- **FR-001**: The repository MUST contain one tracked GitHub Actions workflow under `.github/workflows/` for validation.
- **FR-002**: The workflow MUST run for pull request events and for pushes to the repository's default branch (`master`).
- **FR-003**: The workflow MUST use Node.js 22 for its job environment.
- **FR-004**: The workflow MUST install dependencies with `npm ci` before validation commands run.
- **FR-005**: The workflow MUST run `npm test`, `npm run check`, and `npm run build` as distinct CI steps whose failures fail the job.
- **FR-006**: The workflow MUST NOT run deployment or release automation.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Every pull request and every push to `master` produces a GitHub Actions validation check with the four required command steps in order: `npm ci`, `npm test`, `npm run check`, and `npm run build`.
- **SC-002**: A failure in any required command produces a failed workflow run rather than a successful check.
- **SC-003**: The workflow contains no deployment or release step.
- **SC-004**: The workflow is defined in one tracked file under `.github/workflows/` and requires no new application dependency.

## Assumptions

- The repository's default branch is `master`, as indicated by `origin/HEAD`.
- GitHub-hosted Ubuntu runners provide the operating system needed by the existing npm scripts.
- The package scripts named by the requested validation contract remain the source of truth; this feature does not add or modify application scripts.
- Deployment remains a separate maintainer-invoked operation and is intentionally outside CI validation.

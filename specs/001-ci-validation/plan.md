# Implementation Plan: CI Validation Workflow

**Branch**: `fm/core-break-ci-workflow` | **Date**: 2026-10-06 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-ci-validation/spec.md`

## Summary

Add one GitHub Actions validation workflow that runs for pull requests and pushes to `master`. The workflow uses Node.js 22, installs the locked dependency tree with `npm ci`, then runs `npm test`, `npm run check`, and `npm run build` as separate required steps. Deployment remains outside the workflow.

## Technical Context

**Language/Version**: YAML workflow configuration; Node.js 22 for CI execution

**Primary Dependencies**: GitHub Actions `actions/checkout@v4` and `actions/setup-node@v4`; existing npm package scripts

**Storage**: N/A

**Testing**: Existing repository contract requires `npm test`, `npm run check`, and `npm run build`; baseline observation confirms only `npm run build` is currently defined and passes after `npm ci`. No test runner is installed.

**Target Platform**: GitHub-hosted Ubuntu runner

**Project Type**: Web application with a static frontend and Cloudflare Worker

**Performance Goals**: Workflow performs one dependency installation followed by the three required validation commands; no additional jobs or deployment work.

**Constraints**: One tracked workflow under `.github/workflows/`; Node 22; `npm ci` before validation; separate fail-fast commands; no deployment; no new dependencies or application changes.

**Scale/Scope**: One workflow file and lifecycle documentation for this feature.

## Constitution Check

The generated `.specify/memory/constitution.md` is an unfilled Spec-Kit template and contains no ratified principles to evaluate. No constitution violation is introduced by this configuration-only workflow.

## Phase 0: Research Summary

- Confirmed `origin/HEAD` points to `origin/master`; the push trigger targets `master`.
- Confirmed `package-lock.json` exists, so `npm ci` is the reproducible install command.
- Confirmed `npm run build` passes after `npm ci`; `npm test` and `npm run check` are currently missing scripts. The workflow still invokes the captain-specified commands rather than adding unrelated scripts or dependencies.
- Confirmed deployment is represented by the existing `deploy` script and is excluded from the workflow.

## Phase 1: Design

### Workflow design

- File: `.github/workflows/ci.yml`.
- Trigger: `pull_request` and `push.branches: [master]`.
- Job: one `validate` job on `ubuntu-latest`.
- Setup: checkout repository, configure Node.js 22 with npm caching, then run `npm ci`.
- Validation: four separate `run` steps in order: `npm ci`, `npm test`, `npm run check`, `npm run build`. Each step uses the shell's default failure behavior; no error suppression or compound command masks failures.
- Exclusions: no `npm run deploy`, Wrangler invocation, credentials, release action, or deployment trigger.

## Project Structure

### Documentation (this feature)

```text
specs/001-ci-validation/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/requirements.md
├── tdd/
│   ├── test-list.md
│   ├── cycle-log.md
│   └── verification.md
├── tasks.md
├── checklist.md
├── analyze.md
└── converge.md
```

### Source Code (repository root)

```text
.github/
└── workflows/
    └── ci.yml
```

**Structure Decision**: This is a single repository-level GitHub Actions workflow. No application source, package manifest, lockfile, or deployment configuration changes are in scope.

## Constitution Check — Post-Design

The constitution remains an unfilled template. The design satisfies the requested scope and introduces no conflicting project principle.

## Complexity Tracking

No constitution violations or additional complexity require justification.

# CI Validation Implementation Checklist

**Purpose**: Record the final scope and safety review for the validation workflow.
**Created**: 2026-10-06
**Feature**: [spec.md](spec.md)

## Workflow contract

- [x] One workflow exists at `.github/workflows/ci.yml`.
- [x] Pull requests trigger the validation job.
- [x] Pushes to `master` trigger the same validation job.
- [x] The job uses `ubuntu-latest` and Node.js 22.
- [x] Dependencies are installed with `npm ci` before validation.
- [x] `npm test`, `npm run check`, and `npm run build` are separate fail-fast steps in that order.

## Scope and failure behavior

- [x] No deployment command, Wrangler deployment, release action, or deployment credential is present.
- [x] No application source, package manifest, lockfile, or dependency was changed.
- [x] Commands are not combined or error-suppressed, so a failing command fails the job.
- [x] The existing missing `test` and `check` scripts are documented in the quickstart and TDD profile rather than hidden or replaced.

## Validation evidence

- `npm ci`: passed.
- `npm test`: failed with npm `Missing script: "test"` (pre-existing repository baseline).
- `npm run check`: failed with npm `Missing script: "check"` (pre-existing repository baseline).
- `npm run build`: passed.

# Quickstart: CI Validation Workflow

## Prerequisites

- A checkout of this repository.
- Node.js 22 for reproducing the command sequence locally.
- GitHub Actions enabled for the repository to observe the hosted workflow.

The workflow is defined at `.github/workflows/ci.yml`.

## Local command sequence

From the repository root, run the same validation commands in order:

```sh
npm ci
npm test
npm run check
npm run build
```

Expected workflow contract:

1. Dependencies install from `package-lock.json`.
2. The test command runs as its own step.
3. The check command runs as its own step.
4. The production build runs as its own step.
5. Any non-zero command exits the validation job with failure.

Current baseline note: the repository currently has no `test` or `check` script, so those commands fail with npm's missing-script error. `npm run build` passes after `npm ci`. The workflow intentionally preserves the requested command contract and does not add scripts or dependencies.

## Trigger scenarios

- Open or update a pull request: the workflow runs on the `pull_request` event.
- Push to `master`: the workflow runs on the `push` event for the default branch.
- Push to another branch: no push-triggered run is required by this feature.

## Deployment boundary

No validation scenario invokes `npm run deploy`, Wrangler deployment, release automation, or deployment credentials.

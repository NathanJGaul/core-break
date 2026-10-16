# Core Break Constitution

## Core Principles

### Test-Driven Development (NON-NEGOTIABLE)

Every behavior change is driven by a test that failed first.

- A test exists and has been observed failing, for the right reason, before the
  code that makes it pass. The failure output is recorded in
  `specs/<feature>/tdd/cycle-log.md`.
- Test tasks are not optional. `tasks.md` places each behavior's test task before
  its implementation task, and the implementation task is not started until the
  test is red.
- Tests are never weakened, skipped, deleted, or filtered out to reach green. When
  a test and the code disagree, `spec.md` decides which is wrong.
- Every acceptance criterion in `spec.md` has at least one acceptance test that
  exercises the real entry point.
- Refactoring happens only on a green suite, and never changes a test in the same
  commit as a behavior change.
- Test strength is verified, not assumed: mutation testing on the changed files
  where a mutation tool exists, and a deliberate-mutant spot check where it does
  not.

## Technology and Runtime Constraints

Core Break is a Svelte 5 single-page app styled with daisyUI 5 on Tailwind 4 and built with Vite.
Its sync API is a Cloudflare Worker (`worker/index.js`) that serializes each sync code through a per-code Durable Object (`SyncCoordinator`).
Workers KV is a legacy import and backup source during migration, not a live merge path.

- Node.js 22 or newer is required (`engines.node` in `package.json`), and CI runs on Node 22.
- Local development and tests MUST NOT use production data.
- This repository does not provision or deploy production resources as part of normal development.
  Production deployment is an operator-only task described in `README.md`.

## Development Workflow and Quality Gates

Features are specified under `specs/<feature>/` (for example `specs/core-break-improvement/`) with `spec.md`, `plan.md`, `tasks.md`, and a `tdd/` directory.
The Test-Driven Development principle refers to the files in that layout.

Tests live in `tests/*.test.js`, use Node's built-in `node:test` runner, and are run by `npm test`.
The verified test commands for this repository are recorded in `.specify/memory/tdd-profile.md`.

The CI workflow (`.github/workflows/ci.yml`) runs these gates, in order, on Node 22 for every pull request and every push to `master`:

1. `npm ci`
2. `npm test`
3. `npm run check`
4. `npm run build`

## Governance

This constitution supersedes other development practices for Core Break.
Amendments are made by editing `.specify/memory/constitution.md` in a pull request that states the reason for the change, is approved by the repository owner, and updates the version and the Last Amended date below.
An amendment that changes how existing work must comply includes a migration note for that work.

The version follows semantic versioning:

- MAJOR: a principle is removed or redefined in a backward incompatible way.
- MINOR: a principle or section is added, or guidance is materially expanded.
- PATCH: clarifications, wording, and typo fixes.

Every pull request and review MUST verify compliance with the Test-Driven Development principle.
Use `README.md` for runtime development guidance.

**Version**: 1.0.0 | **Ratified**: 2026-10-16 | **Last Amended**: 2026-10-16

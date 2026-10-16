# Implementation Plan: Preflight test supplies its own placeholder KV namespace id

**Branch**: `fm/core-break-check-config-test` | **Date**: 2026-10-16 | **Spec**: [spec.md](./spec.md)

## Summary

The preflight test reads the committed `wrangler.jsonc` to prove the deploy-mode placeholder refusal, so it went red when commit 232f3ff replaced the placeholder with the real id.
The test will build its own placeholder input: a temporary directory holding the real `scripts/check-config.mjs` and the files it reads, with the SYNC KV namespace id forced to the placeholder.
The preflight and `wrangler.jsonc` do not change.

## Technical Context

**Language/Version**: JavaScript (ESM), Node 22 in CI (Node 24 locally)

**Primary Dependencies**: none beyond Node built-ins (`node:test`, `node:assert/strict`, `node:child_process`, `node:fs/promises`, `node:os`, `node:path`)

**Storage**: a temporary directory created with `mkdtemp` under the OS temp dir and removed in a `finally` block

**Testing**: `node:test` via `npm test` (`node --test tests/*.test.js`)

**Target Platform**: Linux and macOS developer machines and GitHub Actions

**Project Type**: single project, CLI process test

**Constraints**: no change to `scripts/check-config.mjs`, `wrangler.jsonc`, or any other tracked file besides `tests/check-config.test.js` and this feature's `specs/` artifacts

## Constitution Check

The constitution at `.specify/memory/constitution.md` is the unfilled template, so there are no ratified gates to evaluate.
The TDD practice from `.specify/memory/tdd-profile.md` applies: a failing test first, no weakened tests, deliberate mutants where no mutation tool exists.
This is recorded as a baseline limitation; the constitution is not edited here because its wording needs captain approval and the Spec-Kit setup is out of scope.

## Research and design decisions

There are no open unknowns, so no separate research, data-model, contracts or quickstart artifacts are produced.

- **Why a temporary copy.**
  `scripts/check-config.mjs` resolves `../wrangler.jsonc`, `../package.json`, `../public/sw.js` and `../worker/version.js` relative to its own URL and offers no override.
  Adding one would change the preflight, which the brief forbids unless the test cannot be fixed without it.
  Copying the real script next to a modified `wrangler.jsonc` needs no preflight change and still runs the real code under test.
- **Why not symlinks.**
  Node resolves the main module through its real path, so a symlinked script would read the real repository files again.
- **What is copied.**
  `scripts/check-config.mjs`, `worker/version.js`, `package.json` and `public/sw.js` are copied unmodified.
  `wrangler.jsonc` is read from the repository, its SYNC namespace `id` value is replaced by the placeholder `REPLACE_WITH_YOUR_KV_NAMESPACE_ID`, and the result is written into the temporary directory.
  The test asserts the written text contains the placeholder, so a layout change that defeats the replacement fails loudly (FR-005).
- **Why derive from the committed file.**
  The copy stays in step with the real binding, Durable Object and migration entries, so the only difference from the committed configuration is the id.
  A hand-written fixture could drift from what the preflight requires.
- **Placeholder constant.**
  The test declares the placeholder id as a named constant, matching the constant in the script, instead of importing it, because the script does not export it.
- **Test shape.**
  One test keeps its current name.
  `runCheck` takes the directory to run in, so the same helper serves the repository (local mode, AC-3) and the temporary copy (local mode AC-2, deploy mode AC-1).

## Project Structure

### Documentation (this feature)

```text
specs/001-check-config-placeholder-test/
├── spec.md
├── plan.md
├── tasks.md
├── checklists/requirements.md
├── checklist.md
├── analyze.md
├── converge.md
└── tdd/
    ├── test-list.md
    ├── cycle-log.md
    └── verification.md
```

### Source Code (repository root)

```text
tests/check-config.test.js   # the only tracked file whose behavior changes
```

**Structure Decision**: single project; the whole change is confined to the existing CLI process test.

## Verification

- `node --test-name-pattern "configuration preflight" tests/check-config.test.js` shows `ℹ tests 1`, the test name, and passes.
- `npm test`, `npm run check` and `npm run build` pass.
- Deliberate mutants against the preflight (remove the placeholder refusal, make local mode refuse placeholders, break the replacement) each turn the test red, then are restored exactly.

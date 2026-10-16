---
detected_at: 232f3ff # short SHA the profile was detected against
ecosystems: [javascript] # one entry per detected stack
default: javascript # which one the loop uses when a path is ambiguous
stacks:
  javascript:
    cwd: . # repository root; every command below runs here
    runner: node:test # Node's built-in runner (node v24.22.0 here, CI uses Node 22), ESM, no test framework dependency
    single: 'node --test-name-pattern "{name}" {file}' # direct run, NOT `node --test`; see "Single-test command" below
    file: node --test {file}
    suite: npm test # = node --test tests/*.test.js, the command CI runs
    watch: node --test --watch {file}
    coverage: node --test --experimental-test-coverage tests/*.test.js # built-in V8 coverage, no dependency
    mutation: null # no mutation tool in package-lock.json
    acceptance: 'node --test-name-pattern "{name}" {file}' # same runner; Worker fetch entry point and CLI process tests, see body
    property: null # no property-based library in package-lock.json
    approval: null # no snapshot or approval tool
    contract: null
    test_glob: "tests/*.test.js"
    exemplar: # one per test kind the stack can run, never one file for all of them
      unit: tests/merge.test.js
      acceptance: tests/worker.test.js
      component: tests/ui.test.js
      cli: tests/check-config.test.js
    helpers: # test utilities a new test reuses instead of hand-rolling
      - tests/worker.test.js # MemoryKV, DurableObjectNamespace, env(), call(), record(), stateWith(), protocol2()
      - tests/ui.test.js # installDom(), component(), mounted(), button(), input(), flush()
      - tests/service-worker.test.js # serviceWorkerHarness()
      - tests/store.test.js # FakeStorage, reset()
verified: [single, file, suite, watch, coverage, acceptance] # each was run successfully; suite ran to completion but is RED (see below)
suite_baseline: red # green | red, at detection time
suite_seconds: 3 # observed wall time of the full suite (2.8 s)
---

# TDD Stack Profile

## Blocking facts

- **The baseline suite is RED.**
  `npm test` reports 34 tests, 33 pass, 1 fail, exit code 1.
  The failing test is `configuration preflight distinguishes local checks from deployment placeholders` in `tests/check-config.test.js:17`.
  The loop cannot start on top of a red baseline until this is resolved.
  This setup deliberately did not touch it.
- **Cause (diagnosis only, nothing changed).**
  The test runs `scripts/check-config.mjs` without `--local` and expects exit 1 with `placeholder KV namespace ID is not deployable`.
  Commit `232f3ff` ("Wrangler KV key add") replaced the placeholder SYNC KV namespace ID in `wrangler.jsonc` with a real 32-character hex ID.
  The deploy-mode check now passes (exit 0), so the assertion at `tests/check-config.test.js:23` fails with `0 !== 1`.
  GitHub Actions CI on `master` has been red since that commit (run 37621740266).
  Whether the test or the placeholder expectation is the thing to change is a product decision, not a setup decision.
- **The CI-style single-test invocation is a false-green trap.**
  `node --test --test-name-pattern "<name>" <file>` with a name that matches nothing exits 0 and prints `tests 1`, `pass 1`, counting the file itself as the one passing test.
  It was run and confirmed.
  The `single` command above therefore runs the file directly, without `--test`.

## Single-test command

`single` is `node --test-name-pattern "{name}" {file}`, a direct run of the one file.

Verified both ways:

- A known existing name (`local storage helper round-trips JSON` in `tests/storage.test.js`) prints `✔ <that test name>` and `ℹ tests 1`, exit 0.
- A name that matches nothing prints `ℹ tests 0` and `ℹ pass 0`, with no test line.
  **The exit code is still 0.**
  Exit code alone does not prove a test ran.
- A known-red test (`configuration preflight distinguishes…`) prints `✖ <name>`, `ℹ fail 1` and the `AssertionError`, exit 1.

Rules for the loop:

- A run counts only if the output shows `ℹ tests 1` (or the expected count) and the expected test name.
  `ℹ tests 0` is a mistyped name or pattern, never a green and never a red.
- `{name}` is a regular expression.
  Escape regex metacharacters (`( ) [ ] . + ? * | \`) in the test title, or match a unique plain-text substring of it.
- Run from the repository root, with a path such as `tests/storage.test.js`, never a bare file name.
- The same form works for every file under `tests/`.
  It was run against `tests/storage.test.js`, `tests/worker.test.js` and `tests/ui.test.js`.

## Conventions to match

- Tests live in `tests/*.test.js` (flat), named after the module or surface they cover.
  The `test_glob` above is exactly what `npm test` runs.
- Runner and assertions: `import test from 'node:test'` and `import assert from 'node:assert/strict'`.
  Tests are top-level `test('<sentence-style behavior name>', ...)` calls.
  There are no `describe` blocks, so single-test names are the full title.
- There is no mocking library and no shared test-helper module.
  Doubles are hand-written fakes defined at the top of the file that needs them, and each kind below already has a canonical one.
  Reuse by imitation, and check these before writing a new fake:
  - `tests/worker.test.js`: `MemoryKV` (Workers KV fake), `MemoryStorage` and `DurableObjectStub` / `DurableObjectNamespace` (the `SyncCoordinator` Durable Object), `env()` (a full Worker environment), `call(path, options, runtime)` (sends a real `Request` through `worker.fetch`), `record()`, `stateWith()`, `nearLimitState()`, `protocol2()`.
  - `tests/ui.test.js`: `installDom()` (hand-built minimal DOM), `component(name, path)` (compiles a real `.svelte` file with the Svelte compiler and imports it), `mounted()`, `button()`, `input()`, `inputValue()`, `textOf()`, `flush()`.
  - `tests/store.test.js` and `tests/storage.test.js`: `FakeStorage` (a `localStorage` fake with a `fail` switch) plus `globalThis.localStorage`, `navigator` and `$state` shims, and `reset()`.
  - `tests/service-worker.test.js`: `serviceWorkerHarness()` loads the real `public/sw.js` into a `node:vm` context with fake `caches` and `Response` plumbing.
- State fixtures are built from `emptyState()` in `src/lib/merge.js`, never from hand-written literals of the whole state shape.
- Exemplars to imitate, one per kind:
  - Unit, pure functions: `tests/merge.test.js`.
  - Acceptance, HTTP entry point: `tests/worker.test.js`.
    Each test sends a real `Request` through the Worker's exported `fetch` with in-memory KV and Durable Object fakes.
  - Component: `tests/ui.test.js`, which mounts real compiled Svelte components in the fake DOM and drives them through buttons and inputs.
  - CLI process: `tests/check-config.test.js`, which spawns the real script with `process.execPath`.
- `tests/ui.test.js` writes compiled components into a temporary `tests/.ui-generated-*` directory and removes it in an `after` hook.
  That directory must never be committed.

## Acceptance layer

- There is **no browser or end-to-end runner** (no Playwright, Cypress or WebdriverIO, and no jsdom or happy-dom).
  The Svelte UI is exercised only through the hand-built fake DOM in `tests/ui.test.js`, so real-browser rendering, layout and service-worker behavior in a live page are not covered by any automated test.
- The real entry points that are testable here are the Worker's exported `fetch` (`worker/index.js`, covered by `tests/worker.test.js`) and the `scripts/check-config.mjs` process (`tests/check-config.test.js`).
  Acceptance tests for sync-API behavior use the first form.
  The `acceptance` command above is the same direct-run command on those files, and it was run against `tests/worker.test.js` and `tests/ui.test.js`.
- A user-visible UI acceptance criterion cannot reach a real-browser entry point without adding a browser runner, which is a separate decision and was not added.

## Missing capabilities

- **Mutation testing: `null`.**
  No mutation tool is in `package-lock.json`.
  The ecosystem default is StrykerJS (`@stryker-mutator/core` with its `node:test`-compatible command runner).
  Not added.
  Until a decision is made, `/speckit.tdd.verify` falls back to deliberate mutants on the highest-risk behaviors.
- **Property-based testing: `null`.**
  No library in the lock file.
  The ecosystem default is `fast-check`.
  Not added.
  Invariants are sampled with example tests at the boundaries.
- **Snapshot or approval tool, contract tool: `null`.**
  None present or needed so far.
- **Coverage is built in but experimental.**
  `--experimental-test-coverage` prints a table with no dependency and no config file.
  It was verified on the full suite (all files: 81.06% line, 70.07% branch, 73.44% function, with the baseline failure included) and on a green file (`tests/merge.test.js`: `src/lib/merge.js` 82.62% line).
  The flag is still named experimental in Node 24, so its output format can change between Node versions.
  No warning was printed on Node 24.22.0.

## Notes and constraints

- The suite takes about 3 seconds, so per-cycle full runs are fine.
  Single files take well under a second.
- The suite is hermetic.
  It uses in-memory fakes and writes only to the self-cleaning `tests/.ui-generated-*` temp directory.
  It does not call Cloudflare, a live KV or any network service.
  It spawns one child process (`scripts/check-config.mjs`).
- Setup ran `npm ci` from the committed `package-lock.json` to make the runner available.
  No dependency was added, removed or upgraded.
  npm warned that `esbuild` and `workerd` have unapproved install scripts (`npm install-scripts ls`), which did not affect the test run.
- CI (`.github/workflows/ci.yml`) runs, in order: `npm ci`, `npm test`, `npm run check`, `npm run build`, on Node 22.
  This profile used Node 24.22.0 locally.
  `npm run check` (`node scripts/check-config.mjs --local`) passes locally, and `npm run build` succeeds (output goes to the gitignored `dist/`).
  So the only red step in the CI sequence is `npm test`.
- **Legacy and orphaned tests, not run by `npm test`.**
  - `test/core.test.js` (singular `test/` directory) is outside the `tests/*.test.js` glob, so CI never runs it.
    It currently fails (`mergeStates keeps the newest record from either device`, `Error: invalid_state`, 4 of 5 pass).
    It is not part of the baseline and was not touched.
  - `scripts/check.js` is a stray script that prints `Core Break checks passed.` and exits 0.
    No npm script runs it.
  - `package.json` declares `test` and `check` twice in `scripts`.
    The later entries win when parsed (`tests/*.test.js` and `check-config.mjs --local`), which is why `npm test` runs the right files.
    The earlier duplicates point at the orphaned `test/core.test.js` and `scripts/check.js`.
- Not checked: the suite on Node 22 specifically (CI's version), the Cloudflare Worker runtime (`wrangler dev`), and any real-browser behavior.

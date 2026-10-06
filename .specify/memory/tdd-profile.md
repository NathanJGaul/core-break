---
detected_at: b773ed6
ecosystems: [javascript]
default: javascript
stacks:
  javascript:
    cwd: .
    runner: null
    single: null
    file: null
    suite: null
    watch: null
    coverage: null
    mutation: null
    acceptance: null
    property: null
    approval: null
    contract: null
    test_glob: null
    exemplar:
      unit: null
      acceptance: null
    helpers: []
verified: []
suite_baseline: red
suite_seconds: 0.58
---

# TDD Stack Profile

## Conventions to match

- The repository is a JavaScript/Vite/Svelte application rooted at `.` and uses npm with `package-lock.json`.
- No test runner, test files, acceptance runner, assertion convention, test doubles, or shared test utilities were detected.
- No exemplar test file exists because the repository has no test layout.

## Verification evidence

- `npm ci` completed successfully from the repository root and installed the locked dependencies.
- `npm test` was executed from the repository root and failed with npm's `Missing script: "test"` error.
- `npm run check` was executed from the repository root and failed with npm's `Missing script: "check"` error.
- `npm run build` completed successfully from the repository root with Vite 8.3.2.
- No test command was recorded as verified because no test runner or test script exists.

## Missing capabilities and constraints

- **Run one test by name:** null. There are no tests or runner; TDD cannot prove an isolated red phase.
- **Run the whole suite:** null. `npm test` is not defined, so the baseline is red.
- **Useful failure output:** null for tests because no runner exists.
- **Coverage:** null. No coverage tool is installed.
- **Mutation testing:** null. No mutation tool is installed; deliberate mutants cannot be run against absent tests.
- **Property-based testing:** null. No property-testing library is installed.
- **Acceptance/end-to-end testing:** null. No acceptance runner is configured.
- **Watch mode, contract testing, and snapshot/approval testing:** null because no test stack exists.

A characterization-test feature is required before any behavior change can receive a valid TDD cycle. This CI workflow is configuration-only and has no application behavior to exercise. Adding a test runner or test/check scripts is outside this feature's scope and was not performed.

## Constitution outcome

The generated constitution remains the Spec-Kit template. The TDD principle was not applied because this non-interactive worker had no explicit approval to amend the project constitution.

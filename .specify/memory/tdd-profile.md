---
detected_at: b773ed6
ecosystems: [javascript]
default: javascript
stacks:
  javascript:
    cwd: .
    runner: node:test
    single: null
    file: 'node --test {file}'
    suite: 'npm test'
    watch: null
    coverage: null
    mutation: null
    acceptance: null
    property: null
    approval: null
    contract: null
    test_glob: 'tests/*.test.js'
    exemplar:
      unit: tests/merge.test.js
      acceptance: tests/worker.test.js
    helpers:
      - src/lib/storage.js
verified: [file, suite]
suite_baseline: green
suite_seconds: 0.2
---

# TDD Stack Profile

## Conventions to match

- Tests are ECMAScript modules under `tests/*.test.js` and use `node:test` with `node:assert/strict`.
- The current unit exemplar is `tests/merge.test.js`; the API/acceptance exemplar is `tests/worker.test.js`. Both assert consumer-visible invariants without mock forwarding assertions.
- `src/lib/storage.js` is the shared local-storage helper; reuse it for storage failure behavior rather than hand-rolling try/catch fixtures.
- API behavior tests call the exported Worker fetch entry point with an in-memory binding harness. Browser behavior remains a manual smoke surface because no browser runner is installed.

## Notes and constraints

- `npm test` and `node --test tests/merge.test.js` were run successfully after adding the first real behavior suite.
- Node's name-pattern invocation exits successfully while reporting no matching test, so a trustworthy single-test command is unavailable; TDD cycles run one focused test file and record the exact test name in the cycle log.
- Coverage, mutation, property-based, contract, snapshot, watch, and browser acceptance runners are not installed. Verification must use traceability plus deliberate mutants for high-risk merge/protocol/tombstone behavior.
- The original repository had no test runner or tests; this is the baseline limitation recorded before feature implementation.

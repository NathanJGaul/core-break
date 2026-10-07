# TDD cycle log

Each cycle records a real failing behavior test before the smallest implementation change, then green verification and any refactor. The initial baseline has no test runner; the Node built-in runner is introduced without external dependencies before the first cycle.

| Cycle | Test/red evidence | Green evidence | Refactor |
|---|---|---|---|
| 1 | `node --test tests/merge.test.js` failed with missing schema exports; 3 tests then passed after shared schema/merge implementation | `npm test`: 3 passed, 0 failed | Comparator and migration helpers consolidated; suite green |
| 2 | `node --test tests/worker.test.js` failed because the coordinator module did not exist; 4 API/concurrency/lifecycle tests then passed | Worker suite: 4 passed, 0 failed | Worker boundary and coordinator queue kept separate |
| 3 | Legacy import test first failed because the harness did not pass KV into the DO; 6 tests then passed with real import/quarantine fixture | Worker suite: 6 passed, 0 failed | Shared in-memory DO harness retained one coordinator instance |
| 4 | Tombstone prune test first returned 200 before server-assigned deletion revisions; 9-suite run then passed after conservative ack gating | `npm test`: 9 passed, 0 failed; `npm run check`; `npm run build` green | Prune requires minimum acknowledgement across known devices; no automatic GC |
| 5 | `node --test tests/storage.test.js` failed with a missing shared storage module; the helper then passed round-trip and quota-failure behavior | `node --test tests/storage.test.js`: 1 passed, 0 failed; build green | Store now uses the helper and retains visible storage failure state |
| 6 | With the rate gate disabled, the repeated-sync behavior test failed 401 !== 429; restored gate passed the same test | Worker suite: 7 passed, 0 failed | Added bounded per-isolate bucket and redacted metrics fields |

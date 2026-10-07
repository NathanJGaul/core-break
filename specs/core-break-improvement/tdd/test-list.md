# TDD test list

Tests are ordered before implementation tasks and use Node's built-in `node:test` runner.

| ID | Behavior | Entry point | Acceptance criterion |
|---|---|---|---|
| T001 | v1 migrates to schema 2 and strict nested validation rejects malformed/unknown/future/bounded input | `src/lib/merge.js` exports | AC1 |
| T002 | equal timestamps choose stable writer/op/canonical tie independent of argument order | `mergeStates` | AC2 |
| T003 | concurrent DO PUTs preserve both records and revision advances serially | Worker fetch + `SyncCoordinator` | AC3 |
| T004 | protocol 1 compatibility and protocol 2 revision/device handling | Worker fetch | AC4 |
| T005 | body limits, malformed auth/state, stable errors, headers, health, redacted logs | Worker fetch | AC5/AC11 |
| T006 | rotation/revocation/delete lifecycle and no recreation | Worker fetch | AC6 |
| T007 | tombstone metadata/ack retention and bounds | coordinator/merge | AC7 |
| T008 | local write failure remains visible and sync errors/retry/last-successful status are exposed | store actions | AC8 |
| T009 | Settings lifecycle controls and privacy/recovery wording | rendered UI behavior | AC9 |
| T010 | preserve five-minute duration copy, config preflight, service-worker cache/update behavior | source entry points/scripts | AC10/AC11 |
| T011 | full API and build smoke | `npm test`, `npm run check`, `npm run build` | AC12 |

No coverage, mutation, or property-testing dependency exists. Deliberate mutant checks in verification target tie comparator, tombstone retention, and protocol rejection.

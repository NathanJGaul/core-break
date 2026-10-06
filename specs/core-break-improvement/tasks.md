# Tasks: Core Break sync and release safety

## Test-first behavior tasks (mandatory and first)
- [x] T001 Add shared merge migration/validation/limits/tie behavior tests.
- [x] T002 Add Worker API behavior tests for auth, protocol, body limits, headers, health, and stable errors.
- [x] T003 Add Durable Object behavior tests for serialized distinct updates, deterministic ties, legacy import, rotation, revoke, delete, and tombstone retention.
- [x] T004 Add client storage/sync action behavior tests and timing/service-worker/config checks.

## Implementation tasks
- [x] T005 Implement schema 2 migration, strict validator, bounded state helpers, deterministic merge.
- [x] T006 Implement SyncCoordinator Durable Object and legacy import/revision/device acknowledgement storage.
- [x] T007 Implement Worker routing, body parser, protocol compatibility, lifecycle endpoints, health, headers, and redacted logs.
- [x] T008 Implement client protocol state, visible storage/sync failures, retry, rotation/revoke/delete calls.
- [x] T009 Update Settings/Onboarding/manifest copy and controls; preserve measured timer behavior.
- [x] T010 Version service-worker cache, cleanup old caches, and notify app updates.
- [x] T011 Add config preflight, Node engine/test/check scripts, and documentation of plaintext sync, recovery, and limits.

## Remediation and verification
- [x] T012 Run checklist and fix acceptance gaps.
- [x] T013 Analyze spec/plan/tasks against implementation and record findings.
- [x] T014 Converge with risk, rollback-safe storage notes, and remaining work.

# Core Break Constitution

## Core Principles

### I. Local-first and rollback-safe data
Local commits happen before network synchronization. Sync failures never discard local data. Forward storage migrations preserve validated legacy data and retain a documented recovery path.

### II. Accountless capability boundaries
The product uses bearer sync codes, not accounts. A code is the only access credential; rotation, revocation, and remote deletion are explicit lifecycle operations. Code values, QR links, state records, and backups never enter logs.

### III. Test-Driven Development (NON-NEGOTIABLE)
Every behavior change is driven by a test that failed first.

- A test exists and has been observed failing, for the right reason, before the code that makes it pass. The failure output is recorded in `specs/<feature>/tdd/cycle-log.md`.
- Test tasks are not optional. `tasks.md` places each behavior's test task before its implementation task, and implementation starts only after the test is red.
- Tests are never weakened, skipped, deleted, or filtered out to reach green.
- Every acceptance criterion has a real-entry-point acceptance test.
- Refactoring happens only on a green suite.
- Test strength is verified with mutation testing where available and deliberate-mutant checks where it is not.

### IV. Explicit contracts and observability
Shared schemas are versioned and strictly validated at every boundary. Errors use stable codes and actionable UI states. Health and redacted structured telemetry expose operational facts without secrets or user data.

### V. Boring bounded design
State size, record counts, request bytes, and tombstone retention are bounded explicitly. Prefer platform primitives and small pure modules over speculative abstractions. Product timing and privacy claims match observed behavior.

## Delivery constraints

- Synchronized KV data is plaintext to the service operator unless a separately approved encryption migration is implemented.
- The timer remains unchanged; user-facing wording accepts measured 4:30–5:00 sessions.
- No formal staging, canary, soak, or deployment-gate process is required for this personal project.
- Production deployment is an operator action outside this implementation.

## Governance
The constitution governs implementation and review. Changes require an updated specification and tests. Any unresolved product decision is recorded rather than silently inferred.

**Version**: 1.0.0 | **Ratified**: 2026-10-06 | **Last Amended**: 2026-10-06

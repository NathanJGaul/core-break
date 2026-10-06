# Core Break sync and release safety

## Goal
Make the accountless bearer-code sync path durable, bounded, observable, and recoverable while preserving local-first behavior and the existing program/timer behavior.

## Scope
- Schema 2 migration and strict shared validation for client and Worker.
- Serialized per-code Durable Object coordination with legacy KV import.
- Protocol 2 compatibility while accepting safe v1 requests.
- Deterministic merge ties and bounded state.
- Bearer-code rotation, revocation, remote deletion, and safe tombstone retention.
- Visible local-write and sync failures with retry and backup recovery.
- Health, request IDs, redacted logs, security headers, service-worker updates, runtime/preflight checks, and documentation.
- Plaintext synchronized KV posture is explicit; no client-side encryption is added in this release.

## Non-goals
- Accounts, email recovery, or a new authentication system.
- Client-side encryption.
- Timer redesign; copy remains compatible with measured 4:30–5:00 sessions.
- Formal staging, canary, soak, or deployment-gate process.
- Production deployment.

## Acceptance criteria
1. Existing schema 1 state migrates to schema 2 without fabricating records; malformed nested records, unknown schema versions, invalid enums/dates/timestamps, count overflow, and byte overflow are rejected with stable error codes.
2. Equal-timestamp records resolve by stable writer/operation identity and then canonical record key, independent of merge argument order.
3. `PUT /api/sync` routes through a per-code Durable Object whose serialized merge and revision update preserve two simultaneous distinct-device updates; KV remains only a validated legacy import source.
4. Protocol 2 requests include device identity and last server revision. Valid v1 `{state}` requests remain accepted, while unknown future protocols receive an upgrade response without state leakage.
5. GET/PUT responses include canonical state and revision, no-store/security headers, request IDs, and bounded payloads. Health exposes version/environment/binding readiness/storage mode without user data.
6. Rotation copies state before revoking the old code, is retry-safe, returns the replacement once, and old codes receive 410 and cannot recreate state. Remote DELETE removes live state and leaves revocation protection.
7. Tombstones carry deletion metadata and are retained until device acknowledgements are sufficient; no unsafe automatic compaction occurs. Limits are visible and recoverable through export/prune wording.
8. Local storage failures are retained in memory and surfaced persistently with backup guidance. Sync failures expose stable codes, retry, and last-successful-sync state without rendering bearer codes.
9. Settings distinguishes local disable, rotation, and remote deletion with confirmation and code-loss/no-recovery warnings. Sync data is documented as plaintext to the service operator.
10. Timing copy says about 4:30–5:00 or block-specific duration everywhere while timer logic remains unchanged.
11. Security headers, coarse bounded sync rate limiting, redacted structured observability, placeholder/binding preflight, Node runtime floor, npm test/check scripts, service-worker cache versioning and update notification are implemented and behavior tested.
12. Real unit/API/concurrency behavior tests cover the changed entry points and pass with `npm test`; build and check pass.

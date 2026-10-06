# Core Break implementation checklist

- [x] Schema 1 migrates to strict schema 2 without fabricating records.
- [x] Nested session/test/program/settings fields, enums, dates, timestamps, map keys, count limits, tombstone limits, and state bytes validate before adoption/merge.
- [x] Equal timestamps resolve deterministically by writer ID, operation ID, then canonical record key.
- [x] All live merge/write requests route to a per-hashed-code Durable Object; legacy KV import is serialized and idempotent.
- [x] Protocol 2 carries device ID/revision; v1 request shape is accepted; future protocols return upgrade-required.
- [x] Response/body limits use actual request bytes and stable error codes; errors do not include code/state.
- [x] Health, request IDs, no-store/security headers, redacted structured logs, and bounded rate limiting are present.
- [x] Rotation prepares replacement idempotently, copies state before revocation, and old code returns 410.
- [x] Remote deletion removes state and leaves a revocation marker; local disable remains separate.
- [x] Tombstones include deletion metadata/revision and prune requires minimum acknowledgement across known devices; no automatic GC.
- [x] Local storage failures remain visible with backup guidance; sync errors expose retry/status without bearer codes.
- [x] Settings has local disable, rotate, remote delete, backup, and code-loss/plaintext warnings.
- [x] Timer logic and existing five-minute product wording remain unchanged; measured 4:30–5:00 sessions are accepted.
- [x] Service-worker cache is versioned/cleaned and app update notice is wired; API requests remain uncached.
- [x] Node >=22, `npm test`, local `npm run check`, deploy placeholder guard, Wrangler DO binding/migration, README, and test artifacts are present.
- [x] `npm test` (11 passing), `npm run check`, `npm run build`, and local Worker health/auth smoke passed.

## Explicit limits

No encryption migration, account system, timer redesign, production deployment, or formal staging/canary/soak/deployment-gate process was added. Synchronized KV values remain documented as plaintext to the service operator.

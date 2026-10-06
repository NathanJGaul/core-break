# Implementation plan: Core Break sync and release safety

## Decisions
- Keep accountless 32-character base32 bearer codes. Rotation is the lifecycle boundary; no accounts or automatic expiry.
- Use schema 2 with strict allow-listed nested records and `deletedAt`, `writerId`, and `opId` metadata. Migrate v1 only when records validate.
- Use Durable Objects as the sole live merge/write authority. Normalize the DO name from the existing SHA-256 code hash. Legacy KV is imported once per object and retained only until rotation or remote deletion.
- Keep synchronized values plaintext and state this plainly in README and Settings. Do not claim hashed KV keys encrypt values.
- Retain tombstones by default. A prune endpoint is explicit and refuses unsafe deletion unless the caller supplies acknowledgements for all known devices.
- Use Node's built-in `node:test` runner without adding dependencies. Tests use real Worker fetch entry points and an in-memory Durable Object/KV harness.

## Data and protocol
- `src/lib/merge.js`: schema constants, limits, v1 migration, strict validation, canonical stable serialization/tie key, merge, and state-size helpers.
- Protocol 2 request: `{ protocol: 2, deviceId, lastRevision, state }`; v1 `{ state }` remains accepted with a generated compatibility device identity. Response: `{ state, revision, protocol: 2 }`.
- The DO stores one validated schema 2 snapshot under the bounded `state` key plus `meta` (revision, revocation, replacement, and per-device acknowledgements). The 1 MiB state limit prevents importing the legacy 10 MiB KV value as one unbounded DO value; malformed legacy values are marked and quarantined.
- Access metadata is stored under hashed code namespace. Rotation creates a new code, copies canonical state through a new coordinator, then records revocation on the old coordinator. Delete clears live records and writes a revoked marker.

## Worker boundary
- `worker/index.js` owns request parsing, body byte limits, bearer normalization, stable errors, request IDs, security headers, a bounded per-isolate failed/sync request bucket, health, and DO routing.
- `worker/sync-coordinator.js` exports the Durable Object class and pure testable helpers. Worker forwards API calls with normalized code and legacy KV binding context; it never independently merges or writes live data.
- Routes: GET/PUT/DELETE `/api/sync`, POST `/api/sync/rotate`, POST `/api/sync/prune`, and GET `/api/health`.
- All responses are `no-store`; logs contain request ID, route, method, status, duration, byte/count buckets, revision/migration placeholders when unavailable, and stable error code only.

## Client and UI
- `src/lib/store.svelte.js` migrates/validates local state, adds stable device ID and revision, preserves local-first commits, reports storage failures, retries sync, and exposes rotate/delete operations.
- Settings has separate local disable, rotate, remote delete, backup, and privacy/recovery copy. Error panel shows stable sync status, retry, and last success but never code values.
- Preserve the existing five-minute onboarding, manifest, and README wording while accepting the measured 4:30–5:00 runtime; document plaintext/operator access without changing duration copy. Keep QR/link behavior but never log links.
- Version service-worker cache, delete old caches during activation, keep API uncached, and notify the app when an update is available.

## Release safety
- Add `scripts/check-config.mjs` to reject placeholder IDs, missing required bindings/config, and inconsistent asset/API version metadata. Add `npm run check`, `npm test`, Node >=22 engines, and a CI-free local verification path.
- Keep wrangler config deployable locally with a documented placeholder check; do not provision or deploy resources.

## Verification
- Test pure migration/validation/merge limits and deterministic ties.
- Test Worker auth, protocol compatibility, malformed/oversized requests, health, headers, rotation/revocation/delete, and no secret leakage.
- Test two concurrent puts against one DO harness and legacy migration idempotence.
- Run `npm test`, `npm run check`, and `npm run build`.

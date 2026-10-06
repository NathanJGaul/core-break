# Implementation analysis

## Alignment

- Specification AC1–AC2 map to `src/lib/merge.js` and `tests/merge.test.js`.
- AC3–AC7 map to `worker/sync-coordinator.js`, `worker/index.js`, and `tests/worker.test.js`, including real concurrent requests, legacy import, lifecycle routes, tombstone acknowledgements, and rate limiting.
- AC8 maps to `src/lib/storage.js` and the client sync state in `src/lib/store.svelte.js`; `tests/storage.test.js` proves failure return behavior.
- AC9–AC10 map to Settings, Onboarding, manifest, README, and unchanged timer/program modules.
- AC11–AC12 map to service worker/App update wiring, headers/logging/preflight, package scripts, build, and the Node behavior suite.

## Findings resolved

- Legacy state without writer/op metadata receives deterministic canonical identity during migration.
- The coordinator serializes requests through one queue and assigns server deletion revisions before acknowledgement-gated pruning.
- Rotation stores its replacement before copying, so retries reuse the same replacement; revocation occurs only after import.
- The deploy check separates local placeholder validation from the deploy-only guard and aligns Worker/API/package version 2.0.0.
- Plaintext KV posture, code loss, backup sensitivity, and local-disable versus remote-delete semantics are explicit in UI and README.

## Known limits (intentional)

- The repository has no browser runner, coverage engine, or mutation dependency. Manual service-worker/browser smoke remains required for a future operator run; deliberate mutants cover comparator and tombstone invariants.
- The in-memory rate bucket is per Worker isolate; Cloudflare edge rate controls remain an operator configuration choice and no production deployment is claimed.
- Tombstones are never compacted automatically. Explicit prune only proceeds after every known device acknowledgement is at least each deletion revision; unknown/offline devices conservatively block cleanup until they acknowledge.
- Synchronized values remain plaintext by captain decision; no encryption migration is implied.

No unresolved specification/plan contradiction remains for the requested local implementation. Production bindings and live propagation remain unverified by design.

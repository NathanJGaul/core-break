# Core Break

Five-minute core sessions between pomodoro work blocks, with a 4-week progressive program and sync across your devices.

Built with Svelte 5, daisyUI 5 (Tailwind 4), a Cloudflare Worker, a per-code Durable Object coordinator, and legacy Workers KV migration storage.

## Deploy (operator-only)

You need Node.js 22 or newer and a free Cloudflare account. This repository does not provision or deploy production resources as part of normal development.

```sh
npm ci
npm run check                 # local source/config checks
npm run build
```

For an operator deployment, create a KV namespace and replace the placeholder in `wrangler.jsonc`. The `SYNC_COORDINATOR` Durable Object binding and migration must be present. Never use production data in local tests.

`npm run dev` serves the UI only and sync is unavailable. `npm run preview` runs the Worker with local bindings.

### Why not Cloudflare Drop?

Drop only hosts static files, so it can't store sync data. If you ever want a quick no-sync copy, run `npm run build` and drop the `dist` folder on https://www.cloudflare.com/drop/. Everything works except sync, which will show "Not synced".

## Connecting a second device

1. On the first device, open **Settings → Show code and QR**.
2. Scan the QR code with the second device's camera, or copy the connect link and open it there. You can also paste the code into the onboarding screen or Settings.
3. Tap **Connect**. Logs from both devices are merged; tombstones are retained so an offline device cannot resurrect a deletion. Use **Settings → Clean up deleted history** after every known device has synced; cleanup carries durable markers so later stale writes cannot resurrect those records.

Your sync code works like a bearer password: anyone who has it can read and change your logs. It is not an account or account-recovery credential. The server stores data under a SHA-256 hash of the code, never the code itself, but synchronized KV values are plaintext to the service operator (the hash is not encryption). Use **Settings → Rotate shared code** when a device should lose access, and **Settings → Delete synced data** for remote deletion. Turning sync off only removes this device's code; it does not delete server data.

Download a backup before rotation or deletion. Losing the code and backup loses access; there is no account recovery. Backups contain decrypted local data and should be treated as sensitive.

## Local development

```sh
npm run dev       # UI only with hot reload (sync will show "Not synced")
npm run preview   # Full app with the Worker and local bindings, at http://localhost:8787
npm test          # pure merge, migration, concurrency, and Worker API behavior tests
npm run check     # source/config checks; local placeholder is allowed
```

To run the same validation used by CI:

```sh
npm test       # core behavior tests
npm run check  # program and data invariants
npm run build  # production bundle
```

## The program

Each session is five one-minute intervals after a 10-second get-ready countdown. Sessions rotate through three templates so every movement pattern gets covered across the day:

| Template | Intervals |
|---|---|
| A | Hollow body, side plank (L), reverse crunch, side plank (R), hollow body |
| B | Dead bug, bicycle, side plank (L), side plank (R), dead bug |
| C | Reverse crunch, dead bug, hollow body, bicycle, reverse crunch |

Blocks last 4 weeks:

| Block | Work / rest | Versions |
|---|---|---|
| 1 Foundation | 20s / 40s | Easier: tucked hollow, heel-tap dead bug, knee side plank |
| 2 Standard | 30s / 30s | Full versions |
| 3 Volume | 40s / 20s | Full versions |
| 4 Tempo | 40s / 20s | 3-second lowering, 1-second pause |
| 5 Leverage | 45s / 15s | Arms overhead, straighter legs, raised top leg |
| 6+ | 45/15 and 50/10 | Alternates tempo and leverage |

At the end of each block you retest your max hollow body hold. The app recommends moving on when your hold improved, under 30% of sessions were rated shaky, and you logged at least 12 sessions. You always make the final call.

To change exercises, cues, templates or block timings, edit `src/lib/program.js`.

## Data and limits

- Everything is saved on the device first, so sessions work offline. Changes sync about 2 seconds after they happen, and whenever the app comes back into view.
- Sync state is schema-validated and bounded. Tombstones are not automatically garbage-collected while an offline device may still exist; **Settings → Clean up deleted history** is explicit, acknowledgement-gated, and preserves durable prune markers against stale writes.
- Durable Objects serialize the live merge per hashed sync code. Legacy KV is a validated import/backup source during migration, not a concurrent live merge path.
- **Settings → Download backup** saves all your data as JSON.

## Project layout

```
src/lib/program.js      exercises, versions, templates, blocks
src/lib/stats.js        streaks, weekly sets, block recommendations
src/lib/store.svelte.js local storage, sync, actions
src/lib/merge.js        conflict-free merge (shared with the Worker)
src/views/              Today, Session, HoldTest, Progress, Settings, Onboarding
worker/index.js         sync API boundary, health, lifecycle routes
worker/sync-coordinator.js Durable Object merge/revision lifecycle
tests/                  Node behavior and API tests
wrangler.jsonc          Worker/KV/Durable Object config
```

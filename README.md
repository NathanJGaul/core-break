# Core Break

Five-minute core sessions between pomodoro work blocks, with a 4-week progressive program and sync across your devices.

Built with Svelte 5, daisyUI 5 (Tailwind 4) and one Cloudflare Worker that serves the app and stores your sync data in Workers KV.

## Deploy (about 5 minutes, free tier)

You need Node.js 20 or newer and a free Cloudflare account.

```sh
cd core-break
npm install

# 1. Log in to Cloudflare (opens your browser)
npx wrangler login

# 2. Create the storage for your sync data
npx wrangler kv namespace create SYNC
```

Step 2 prints an `id`. If Wrangler offers to add it to your config, say yes. Otherwise open `wrangler.jsonc` and replace `REPLACE_WITH_YOUR_KV_NAMESPACE_ID` with that id.

```sh
# 3. Build and deploy
npm run deploy
```

Wrangler prints your live URL, something like `https://core-break.<your-subdomain>.workers.dev`. Open it on your phone and computer. On your phone, use "Add to Home Screen" so it opens full screen like an app.

Run `npm run deploy` again any time you change the code.

### Why not Cloudflare Drop?

Drop only hosts static files, so it can't store sync data. If you ever want a quick no-sync copy, run `npm run build` and drop the `dist` folder on https://www.cloudflare.com/drop/. Everything works except sync, which will show "Not synced".

## Connecting a second device

1. On the first device, open **Settings → Show code and QR**.
2. Scan the QR code with the second device's camera, or copy the connect link and open it there. You can also paste the code into the onboarding screen or Settings.
3. Tap **Connect**. Logs from both devices are merged; nothing is deleted.

Your sync code works like a password: anyone who has it can read and change your logs. The server stores data under a SHA-256 hash of the code, never the code itself.

## Local development

```sh
npm run dev       # UI only with hot reload (sync will show "Not synced")
npm run preview   # Full app with the Worker and a local KV, at http://localhost:8787
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
- Workers KV's free tier allows 1,000 writes a day. The app writes only when something changed, so normal use stays far below that.
- **Settings → Download backup** saves all your data as JSON.

## Project layout

```
src/lib/program.js      exercises, versions, templates, blocks
src/lib/stats.js        streaks, weekly sets, block recommendations
src/lib/store.svelte.js local storage, sync, actions
src/lib/merge.js        conflict-free merge (shared with the Worker)
src/views/              Today, Session, HoldTest, Progress, Settings, Onboarding
worker/index.js         sync API + static asset serving
wrangler.jsonc          Worker config
```

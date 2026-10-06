<script>
  import { app, deleteSession, deleteTest } from '../lib/store.svelte.js';
  import { PATTERNS, getBlock } from '../lib/program.js';
  import { activeSessions, activeTests, sessionsByDate, weeklyPatternSets, streak } from '../lib/stats.js';
  import { formatShort } from '../lib/dates.js';
  import Heatmap from '../components/Heatmap.svelte';
  import HoldChart from '../components/HoldChart.svelte';

  let { ontest } = $props();

  const tests = $derived(activeTests(app.data));
  const sessions = $derived(activeSessions(app.data));
  const counts = $derived(sessionsByDate(app.data));
  const sets = $derived(weeklyPatternSets(app.data));
  const best = $derived(tests.length ? Math.max(...tests.map((t) => t.seconds)) : 0);
  const first = $derived(tests[0] ?? null);
  const latest = $derived(tests.at(-1) ?? null);
  const recent = $derived([...sessions].reverse().slice(0, 15));
  const history = $derived([...(app.data.program.history ?? [])].reverse());

  const TARGET_MAX = 20;
  const formLabel = { clean: 'Clean', ok: 'Okay', shaky: 'Shaky' };
  const formClass = { clean: 'badge-success', ok: 'badge-neutral', shaky: 'badge-warning' };

  let confirmId = $state(null);

  function time(ts) {
    return new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }
</script>

<h1 class="font-display text-5xl font-black leading-none">Progress</h1>

<section class="mt-8">
  <div class="flex items-end justify-between gap-4">
    <div>
      <h2 class="font-semibold">Hollow hold</h2>
      {#if latest}
        <p class="numerals mt-1 text-6xl font-black">{latest.seconds.toFixed(1)}<span class="text-3xl">s</span></p>
        <p class="text-sm opacity-70">
          Latest test. Best {best.toFixed(1)}s{#if first && first !== latest}, started at {first.seconds.toFixed(1)}s{/if}.
        </p>
      {/if}
    </div>
    <button class="btn btn-outline btn-sm" onclick={ontest}>Test now</button>
  </div>
  <div class="mt-4">
    <HoldChart {tests} />
  </div>
</section>

<section class="mt-10">
  <h2 class="font-semibold">Sets this week</h2>
  <p class="text-sm opacity-60">Each completed interval is one set. Around 10–20 per pattern a week is a solid range.</p>
  <div class="mt-4 space-y-4">
    {#each Object.entries(PATTERNS) as [key, pattern] (key)}
      <div>
        <div class="flex items-baseline justify-between">
          <span>{pattern.name} <span class="text-sm opacity-60">{pattern.hint}</span></span>
          <span class="numerals text-2xl font-extrabold">{sets[key]}</span>
        </div>
        <div class="relative mt-1 h-2 overflow-hidden rounded-full bg-base-300">
          <div class="absolute inset-y-0 bg-primary/20" style="left: 50%; right: 0"></div>
          <div class="absolute inset-y-0 left-0 rounded-full bg-primary" style="width: {Math.min(100, (sets[key] / TARGET_MAX) * 100)}%"></div>
        </div>
      </div>
    {/each}
  </div>
</section>

<section class="mt-10">
  <div class="flex items-baseline justify-between">
    <h2 class="font-semibold">Sessions</h2>
    <span class="text-sm opacity-70">{sessions.length} total, {streak(app.data)}-day streak</span>
  </div>
  <div class="mt-4">
    <Heatmap {counts} />
  </div>
</section>

<section class="mt-10">
  <h2 class="font-semibold">Recent sessions</h2>
  {#if recent.length === 0}
    <p class="mt-2 opacity-60">Your sessions will appear here after your first break.</p>
  {:else}
    <ul class="mt-3 divide-y divide-base-300 border-y border-base-300">
      {#each recent as s (s.id)}
        <li class="flex items-center gap-3 py-3">
          <div class="min-w-0 flex-1">
            <p class="font-medium">{formatShort(s.date)}, {time(s.startedAt)}</p>
            <p class="text-sm opacity-60">
              Session {s.template}, {getBlock(s.block).name}, {s.intervals.filter((i) => i.done).length}/{s.intervals.length} intervals
            </p>
          </div>
          {#if s.form}<span class={['badge badge-sm', formClass[s.form]]}>{formLabel[s.form]}</span>{/if}
          {#if confirmId === s.id}
            <button class="btn btn-error btn-xs" onclick={() => { deleteSession(s.id); confirmId = null; }}>Delete</button>
            <button class="btn btn-ghost btn-xs" onclick={() => (confirmId = null)}>Keep</button>
          {:else}
            <button class="btn btn-ghost btn-xs opacity-60" aria-label="Delete session" onclick={() => (confirmId = s.id)}>✕</button>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</section>

{#if tests.length}
  <section class="mt-10">
    <h2 class="font-semibold">Test log</h2>
    <ul class="mt-3 divide-y divide-base-300 border-y border-base-300">
      {#each [...tests].reverse() as t (t.id)}
        <li class="flex items-center gap-3 py-2.5">
          <span class="flex-1">{formatShort(t.date)}
            <span class="text-sm opacity-60">{t.kind === 'baseline' ? 'Baseline' : t.kind === 'block-end' ? 'End of block' : 'Extra test'}</span>
          </span>
          <span class="numerals text-2xl font-extrabold">{t.seconds.toFixed(1)}s</span>
          {#if confirmId === t.id}
            <button class="btn btn-error btn-xs" onclick={() => { deleteTest(t.id); confirmId = null; }}>Delete</button>
            <button class="btn btn-ghost btn-xs" onclick={() => (confirmId = null)}>Keep</button>
          {:else}
            <button class="btn btn-ghost btn-xs opacity-60" aria-label="Delete test" onclick={() => (confirmId = t.id)}>✕</button>
          {/if}
        </li>
      {/each}
    </ul>
  </section>
{/if}

{#if history.length}
  <section class="mt-10 mb-6">
    <h2 class="font-semibold">Finished blocks</h2>
    <ul class="mt-3 divide-y divide-base-300 border-y border-base-300">
      {#each history as h, i (i)}
        <li class="flex justify-between py-2.5">
          <span>{getBlock(h.blockIndex).name} <span class="text-sm opacity-60">{formatShort(h.start)} to {formatShort(h.end)}</span></span>
          <span class="text-sm opacity-70">{h.decision === 'advance' ? 'Moved on' : 'Repeated'}</span>
        </li>
      {/each}
    </ul>
  </section>
{/if}

<script>
  import { app, decideBlock } from '../lib/store.svelte.js';
  import { buildIntervals, getBlock, BLOCK_DAYS } from '../lib/program.js';
  import { blockStatus, nextTemplateIndex, sessionsByDate, streak } from '../lib/stats.js';
  import { localDate } from '../lib/dates.js';
  import SyncBadge from '../components/SyncBadge.svelte';

  let { onstart, ontest } = $props();

  const status = $derived(blockStatus(app.data));
  const templateIndex = $derived(nextTemplateIndex(app.data));
  const intervals = $derived(buildIntervals(templateIndex, app.data.program.blockIndex));
  const todayCount = $derived(sessionsByDate(app.data).get(localDate()) ?? 0);
  const currentStreak = $derived(streak(app.data));
  const nextBlock = $derived(getBlock(app.data.program.blockIndex + 1));
  const progressDay = $derived(Math.min(status.day, BLOCK_DAYS));

  function sideLabel(side) {
    return side === 'left' ? ' (left)' : side === 'right' ? ' (right)' : '';
  }
</script>

<header class="flex items-start justify-between gap-4">
  <div>
    <p class="text-sm opacity-60">Block {status.block.index + 1}, week {status.week} of 4</p>
    <h1 class="font-display text-5xl font-black leading-none">{status.block.name}</h1>
  </div>
  <SyncBadge />
</header>

<progress
  class="progress progress-primary mt-4 h-1.5 w-full"
  value={progressDay}
  max={BLOCK_DAYS}
  aria-label="Day {progressDay} of {BLOCK_DAYS} in this block"
></progress>

{#if status.complete}
  <section class="mt-6 rounded-box border border-accent bg-accent/10 p-5">
    {#if !status.endTest}
      <h2 class="font-display text-3xl font-extrabold">Block finished</h2>
      <p class="mt-2 opacity-80">
        Retest your hollow body hold to see how far you've come. Then decide whether to move on to the next block.
      </p>
      <button class="btn btn-accent mt-4 w-full" onclick={() => ontest('block-end')}>Take end-of-block test</button>
    {:else}
      <h2 class="font-display text-3xl font-extrabold">
        {status.recommendation === 'advance' ? `Ready for ${nextBlock.name}` : `Repeat ${status.block.name}`}
      </h2>
      <ul class="mt-3 space-y-1.5 opacity-85">
        {#each status.reasons as reason}<li>{reason}</li>{/each}
      </ul>
      <p class="mt-3 text-sm opacity-70">
        Next block: {nextBlock.work}s work / {nextBlock.rest}s rest. {nextBlock.focus}
      </p>
      <div class="mt-4 grid grid-cols-2 gap-2">
        <button
          class={['btn', status.recommendation === 'repeat' ? 'btn-accent' : 'btn-outline']}
          onclick={() => decideBlock('repeat')}
        >
          Repeat block
        </button>
        <button
          class={['btn', status.recommendation === 'advance' ? 'btn-accent' : 'btn-outline']}
          onclick={() => decideBlock('advance')}
        >
          Start {nextBlock.name}
        </button>
      </div>
    {/if}
  </section>
{/if}

<section class="mt-8">
  <div class="flex items-baseline justify-between">
    <h2 class="font-display text-3xl font-extrabold">Next session</h2>
    <span class="text-sm opacity-60">{status.block.work}s work, {status.block.rest}s rest</span>
  </div>

  <ol class="mt-4 space-y-2">
    {#each intervals as it, i}
      <li class="flex items-center gap-4 rounded-field bg-base-200 px-4 py-3">
        <span class="numerals w-5 shrink-0 text-2xl font-extrabold opacity-40">{i + 1}</span>
        <span class="min-w-0">
          <span class="block font-semibold">{it.label}{sideLabel(it.side)}</span>
          <span class="block text-sm opacity-60">{it.name}</span>
        </span>
      </li>
    {/each}
  </ol>

  <button class="btn btn-primary btn-xl mt-6 h-16 w-full text-lg" onclick={() => onstart(templateIndex)}>
    Start session
  </button>
</section>

<section class="mt-8 flex gap-8 border-t border-base-300 pt-5">
  <div>
    <p class="numerals text-4xl font-extrabold">{todayCount}</p>
    <p class="text-sm opacity-60">{todayCount === 1 ? 'session' : 'sessions'} today</p>
  </div>
  <div>
    <p class="numerals text-4xl font-extrabold">{currentStreak}</p>
    <p class="text-sm opacity-60">day streak</p>
  </div>
  <div>
    <p class="numerals text-4xl font-extrabold">{status.sessionCount}</p>
    <p class="text-sm opacity-60">this block</p>
  </div>
</section>

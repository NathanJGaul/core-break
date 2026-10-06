<script>
  import { onMount, onDestroy, untrack } from 'svelte';
  import { app, logSession } from '../lib/store.svelte.js';
  import { buildIntervals, TEMPLATES, SESSION_GET_READY } from '../lib/program.js';
  import { localDate } from '../lib/dates.js';
  import { beep, vibrate, keepAwake } from '../lib/audio.js';

  let { templateIndex, onclose } = $props();

  // Snapshot the plan at the start so a sync mid-session can't change it.
  const blockIndex = app.data.program.blockIndex;
  const blockStart = app.data.program.blockStart;
  const intervals = untrack(() => buildIntervals(templateIndex, blockIndex));

  const phases = [{ type: 'prep', dur: SESSION_GET_READY, i: 0 }];
  intervals.forEach((it, i) => {
    phases.push({ type: 'work', dur: it.work, i });
    if (i < intervals.length - 1) phases.push({ type: 'rest', dur: it.rest, i: i + 1 });
  });

  let stage = $state('running'); // running | rate
  let phaseIdx = $state(0);
  let remainingMs = $state(SESSION_GET_READY * 1000);
  let paused = $state(false);
  let done = $state(intervals.map(() => false));

  const startedAt = Date.now();
  let endedAt = startedAt;
  let phaseEnd = 0;
  let pausedLeft = 0;
  let lastSecond = null;
  let timer = null;

  const phase = $derived(phases[Math.min(phaseIdx, phases.length - 1)]);
  const current = $derived(intervals[phase.i]);
  const seconds = $derived(Math.max(0, Math.ceil(remainingMs / 1000)));
  const completedCount = $derived(done.filter(Boolean).length);

  const sound = () => app.data.settings.sound !== false;
  const buzz = () => app.data.settings.vibrate !== false;

  function cue(type) {
    if (type === 'work') {
      if (sound()) beep(1175, 380, 0.35);
      if (buzz()) vibrate(250);
    } else if (type === 'rest') {
      if (sound()) beep(587, 300, 0.3);
      if (buzz()) vibrate([90, 70, 90]);
    } else if (type === 'finish') {
      if (sound()) {
        beep(784, 160);
        setTimeout(() => beep(988, 160), 180);
        setTimeout(() => beep(1319, 320), 360);
      }
      if (buzz()) vibrate([150, 80, 150, 80, 300]);
    }
  }

  function advance(markDone, now) {
    const ph = phases[phaseIdx];
    if (markDone && ph.type === 'work') done[ph.i] = true;
    if (phaseIdx >= phases.length - 1) {
      finish();
      return false;
    }
    phaseIdx += 1;
    phaseEnd = (now ?? phaseEnd) + phases[phaseIdx].dur * 1000;
    lastSecond = null;
    return true;
  }

  function tick() {
    if (paused || stage !== 'running') return;
    const now = performance.now();
    let changed = false;
    while (stage === 'running' && now >= phaseEnd) {
      if (!advance(true)) return;
      changed = true;
    }
    if (changed) cue(phases[phaseIdx].type);
    remainingMs = phaseEnd - now;
    const s = Math.ceil(remainingMs / 1000);
    if (s !== lastSecond) {
      lastSecond = s;
      if (s >= 1 && s <= 3 && sound()) beep(880, 90, 0.2);
    }
  }

  function finish() {
    clearInterval(timer);
    endedAt = Date.now();
    keepAwake(false);
    if (done.some(Boolean)) {
      cue('finish');
      stage = 'rate';
    } else {
      onclose();
    }
  }

  function togglePause() {
    if (paused) {
      phaseEnd = performance.now() + pausedLeft;
      paused = false;
      keepAwake(true);
    } else {
      pausedLeft = phaseEnd - performance.now();
      paused = true;
    }
  }

  function skip() {
    const now = performance.now();
    if (paused) paused = false;
    if (advance(false, now)) cue(phases[phaseIdx].type);
    remainingMs = phaseEnd - now;
  }

  function endEarly() {
    paused = false;
    finish();
  }

  function save(form) {
    logSession({
      startedAt,
      endedAt,
      date: localDate(new Date(startedAt)),
      block: blockIndex,
      blockStart,
      template: TEMPLATES[templateIndex].id,
      intervals: intervals.map((it, i) => ({ ex: it.ex, side: it.side, pattern: it.pattern, work: it.work, done: done[i] })),
      form
    });
    onclose();
  }

  onMount(() => {
    phaseEnd = performance.now() + SESSION_GET_READY * 1000;
    keepAwake(true);
    timer = setInterval(tick, 100);
  });

  onDestroy(() => {
    clearInterval(timer);
    keepAwake(false);
  });

  const ratings = [
    { form: 'clean', label: 'Clean', detail: 'Back stayed flat, controlled throughout', cls: 'btn-success' },
    { form: 'ok', label: 'Okay', detail: 'A few slips near the end', cls: 'btn-neutral' },
    { form: 'shaky', label: 'Shaky', detail: 'Form broke down often', cls: 'btn-warning' }
  ];

  function sideText(side) {
    return side ? `${side === 'left' ? 'Left' : 'Right'} side` : '';
  }
</script>

{#if stage === 'running'}
  <div
    class={[
      'flex min-h-dvh flex-col transition-colors duration-500',
      phase.type === 'work' && 'bg-primary text-primary-content',
      phase.type === 'rest' && 'bg-secondary text-secondary-content',
      phase.type === 'prep' && 'bg-base-200 text-base-content'
    ]}
  >
    <div class="mx-auto flex w-full max-w-lg flex-1 flex-col px-5 pt-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
      <div class="flex gap-1.5" aria-label="{completedCount} of {intervals.length} intervals done">
        {#each intervals as _, i}
          <span
            class={[
              'h-1.5 flex-1 rounded-full',
              done[i] ? 'bg-current' : i === phase.i && phase.type === 'work' ? 'bg-current opacity-60' : 'bg-current opacity-20'
            ]}
          ></span>
        {/each}
      </div>

      <div class="mt-6" aria-live="polite">
        <p class="text-lg font-medium opacity-80">
          {#if phase.type === 'prep'}Get ready{:else if phase.type === 'rest'}Rest. Next up{:else}Interval {phase.i + 1} of {intervals.length}{/if}
        </p>
        <h1 class="font-display text-5xl font-black leading-[0.95]">
          {current.label}
        </h1>
        {#if current.side}<p class="mt-1 text-2xl font-semibold">{sideText(current.side)}</p>{/if}
      </div>

      <div class="flex flex-1 items-center justify-center py-4">
        <span class="numerals text-[min(58vw,20rem)] font-black" role="timer" aria-label="{seconds} seconds left">
          {seconds}
        </span>
      </div>

      <ul class="space-y-1.5 text-base leading-snug opacity-90">
        {#each current.cues as c}<li>{c}</li>{/each}
      </ul>

      <div class="mt-6 grid grid-cols-3 gap-2">
        <button class="btn btn-lg border-current/30 bg-transparent text-current" onclick={endEarly}>End</button>
        <button class="btn btn-lg border-current/30 bg-current/15 text-current" onclick={togglePause}>
          {paused ? 'Resume' : 'Pause'}
        </button>
        <button class="btn btn-lg border-current/30 bg-transparent text-current" onclick={skip}>Skip</button>
      </div>
    </div>

    {#if paused}
      <div class="fixed inset-0 z-10 flex flex-col items-center justify-center gap-6 bg-base-100/95 px-6 text-base-content">
        <p class="font-display text-6xl font-black">Paused</p>
        <button class="btn btn-primary btn-xl w-full max-w-xs" onclick={togglePause}>Resume</button>
        <button class="btn btn-ghost" onclick={endEarly}>End session</button>
      </div>
    {/if}
  </div>
{:else}
  <div class="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-5 py-10">
    <h1 class="font-display text-6xl font-black leading-[0.9]">Session done</h1>
    <p class="mt-3 text-lg opacity-80">
      {completedCount} of {intervals.length} intervals completed. How did your form hold up?
    </p>
    <div class="mt-8 grid gap-3">
      {#each ratings as r (r.form)}
        <button class={['btn h-auto flex-col items-start gap-0.5 py-4 text-left', r.cls]} onclick={() => save(r.form)}>
          <span class="text-lg">{r.label}</span>
          <span class="font-normal opacity-80">{r.detail}</span>
        </button>
      {/each}
    </div>
    <button class="btn btn-ghost mt-6 self-center" onclick={onclose}>Discard session</button>
  </div>
{/if}

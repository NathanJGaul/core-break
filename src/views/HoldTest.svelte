<script>
  import { onDestroy } from 'svelte';
  import { app, startProgram, logTest } from '../lib/store.svelte.js';
  import { activeTests } from '../lib/stats.js';
  import { beep, vibrate, keepAwake } from '../lib/audio.js';

  let { kind, onclose } = $props();

  let stage = $state('intro'); // intro | countdown | holding | result
  let count = $state(3);
  let elapsed = $state(0);
  let timer = null;
  let t0 = 0;

  const previous = $derived(activeTests(app.data).at(-1) ?? null);
  const title = $derived(kind === 'baseline' ? 'Baseline test' : kind === 'block-end' ? 'End-of-block test' : 'Hollow hold test');

  const sound = () => app.data.settings.sound !== false;
  const buzz = () => app.data.settings.vibrate !== false;

  function begin() {
    stage = 'countdown';
    count = 3;
    keepAwake(true);
    if (sound()) beep(880, 90, 0.2);
    timer = setInterval(() => {
      count -= 1;
      if (count > 0) {
        if (sound()) beep(880, 90, 0.2);
      } else {
        clearInterval(timer);
        if (sound()) beep(1175, 380, 0.35);
        if (buzz()) vibrate(250);
        stage = 'holding';
        t0 = performance.now();
        timer = setInterval(() => (elapsed = (performance.now() - t0) / 1000), 50);
      }
    }, 1000);
  }

  function stop() {
    clearInterval(timer);
    elapsed = Math.round(((performance.now() - t0) / 1000) * 10) / 10;
    keepAwake(false);
    if (sound()) beep(587, 300, 0.3);
    stage = 'result';
  }

  function retry() {
    elapsed = 0;
    stage = 'intro';
  }

  function save() {
    if (kind === 'baseline') startProgram(elapsed);
    else logTest(elapsed, kind);
    onclose();
  }

  onDestroy(() => {
    clearInterval(timer);
    keepAwake(false);
  });
</script>

{#if stage === 'holding'}
  <button
    class="flex min-h-dvh w-full flex-col items-center justify-center bg-primary px-5 text-primary-content"
    onclick={stop}
  >
    <span class="text-lg font-medium opacity-80">Hold. Tap anywhere when your back lifts.</span>
    <span class="numerals mt-4 text-[min(40vw,16rem)] font-black" role="timer">{elapsed.toFixed(1)}</span>
    <span class="mt-6 rounded-full border border-current/40 px-6 py-3 text-lg font-semibold">Stop</span>
  </button>
{:else if stage === 'countdown'}
  <div class="flex min-h-dvh flex-col items-center justify-center bg-base-200 px-5">
    <p class="text-lg opacity-70">Get into position</p>
    <span class="numerals text-[min(58vw,20rem)] font-black" aria-live="assertive">{count}</span>
  </div>
{:else}
  <div class="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-5 py-8">
    <button class="btn btn-ghost btn-sm self-start px-0" onclick={onclose}>Cancel</button>

    {#if stage === 'intro'}
      <h1 class="mt-6 font-display text-6xl font-black leading-[0.9]">{title}</h1>
      <p class="mt-4 text-lg opacity-80">
        Hold a hollow body for as long as you can. Use the same version every time so results compare across blocks.
      </p>
      <ul class="mt-6 space-y-3 border-l-2 border-primary pl-4">
        <li>Lie on your back. Press your lower back flat into the mat.</li>
        <li>Lift your shoulders and straight legs a few inches off the floor, arms reaching toward your feet.</li>
        <li>Stop the moment your lower back lifts. A short honest hold beats a long arched one.</li>
        <li>Can't hold the full version yet? Bend your knees slightly, and do it the same way every test.</li>
      </ul>
      {#if previous}
        <p class="mt-6 text-sm opacity-70">Last result: {previous.seconds.toFixed(1)}s</p>
      {/if}
      <div class="mt-auto pt-10">
        <button class="btn btn-primary btn-xl h-16 w-full" onclick={begin}>Start 3-second countdown</button>
      </div>
    {:else}
      <h1 class="mt-6 font-display text-4xl font-black">Your hold</h1>
      <p class="numerals mt-2 text-[8rem] font-black">{elapsed.toFixed(1)}<span class="text-5xl">s</span></p>
      {#if previous}
        {@const diff = elapsed - previous.seconds}
        <p class="text-lg opacity-80">
          {diff > 0 ? `${diff.toFixed(1)}s longer than` : diff < 0 ? `${Math.abs(diff).toFixed(1)}s shorter than` : 'Same as'} your last test.
        </p>
      {/if}
      <div class="mt-auto grid gap-2 pt-10">
        <button class="btn btn-primary btn-xl h-16" onclick={save}>
          {kind === 'baseline' ? 'Save and start program' : 'Save result'}
        </button>
        <button class="btn btn-ghost" onclick={retry}>Try again</button>
      </div>
    {/if}
  </div>
{/if}

<script>
  import { EXERCISES, getBlock } from '../lib/program.js';
  import { sync, normalizeCode, setSyncCode } from '../lib/store.svelte.js';

  let { onbaseline } = $props();

  let codeInput = $state('');
  let codeError = $state('');
  let joining = $state(false);

  function join() {
    const code = normalizeCode(codeInput);
    if (!code) {
      codeError = 'A sync code is 32 letters and numbers. Check for typos.';
      return;
    }
    codeError = '';
    setSyncCode(code);
  }

  const blocks = [0, 1, 2, 3, 4].map(getBlock);
</script>

<section class="pt-4">
  <h1 class="font-display text-6xl font-black leading-[0.9] tracking-tight">
    Five minutes of core between work blocks.
  </h1>
  <p class="mt-5 max-w-prose text-lg leading-relaxed opacity-80">
    Each break is five one-minute intervals on the floor. The app rotates your moves through the day and makes them harder every four weeks.
  </p>

  <div class="mt-8">
    <h2 class="text-sm font-semibold opacity-60">Your five moves</h2>
    <ul class="mt-3 flex flex-wrap gap-2">
      {#each Object.values(EXERCISES) as ex (ex.name)}
        <li class="rounded-full border border-base-300 px-3 py-1.5 text-sm">{ex.name}</li>
      {/each}
    </ul>
  </div>

  <div class="mt-8">
    <h2 class="text-sm font-semibold opacity-60">How it gets harder</h2>
    <ol class="mt-3 divide-y divide-base-300 border-y border-base-300">
      {#each blocks as b (b.index)}
        <li class="flex items-baseline gap-4 py-3">
          <span class="numerals w-16 shrink-0 text-2xl font-extrabold">{b.work}/{b.rest}</span>
          <span>
            <span class="font-semibold">{b.name}.</span>
            <span class="opacity-75">{b.focus}</span>
          </span>
        </li>
      {/each}
    </ol>
    <p class="mt-2 text-sm opacity-60">Seconds of work / rest per minute. Each block lasts four weeks.</p>
  </div>

  <div class="mt-10 rounded-box bg-base-200 p-5">
    <h2 class="font-display text-3xl font-extrabold">Start with a baseline</h2>
    <p class="mt-2 opacity-80">
      Hold a hollow body hold for as long as you can with your lower back flat. You'll repeat this test at the end of every block to track progress.
    </p>
    <button class="btn btn-primary btn-lg mt-5 w-full" onclick={onbaseline}>Take baseline test</button>
    <p class="mt-3 text-sm opacity-60">Stop any exercise that causes pain beyond normal muscle effort.</p>
  </div>

  <div class="mt-8 mb-10">
    {#if !joining}
      <button class="btn btn-ghost btn-sm px-0 underline-offset-4 hover:underline" onclick={() => (joining = true)}>
        Already using Core Break on another device?
      </button>
    {:else}
      <label class="text-sm font-semibold" for="join-code">Sync code from your other device</label>
      <p class="text-sm opacity-60">Find it in Settings on that device.</p>
      <div class="join mt-2 w-full">
        <input
          id="join-code"
          class="input join-item w-full font-mono uppercase"
          placeholder="XXXX-XXXX-…"
          autocomplete="off"
          bind:value={codeInput}
        />
        <button class="btn btn-neutral join-item" onclick={join}>Connect</button>
      </div>
      {#if codeError}<p class="mt-2 text-sm text-error">{codeError}</p>{/if}
      {#if sync.code && sync.status === 'syncing'}<p class="mt-2 text-sm opacity-70">Connecting…</p>{/if}
      {#if sync.code && sync.status === 'ok'}
        <p class="mt-2 text-sm opacity-70">Connected. No program found on that code yet, so take the baseline test above.</p>
      {/if}
      {#if sync.status === 'error' || sync.status === 'offline'}<p class="mt-2 text-sm text-error">{sync.message}</p>{/if}
    {/if}
  </div>
</section>

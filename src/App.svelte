<script>
  import { onMount } from 'svelte';
  import { app, sync, initSync, normalizeCode, setSyncCode, formatCode } from './lib/store.svelte.js';
  import Today from './views/Today.svelte';
  import Progress from './views/Progress.svelte';
  import Settings from './views/Settings.svelte';
  import Onboarding from './views/Onboarding.svelte';
  import Session from './views/Session.svelte';
  import HoldTest from './views/HoldTest.svelte';
  import { unlockAudio } from './lib/audio.js';

  // Audio must be unlocked inside the tap that opens a session or test.
  function open(o) {
    unlockAudio();
    overlay = o;
    window.scrollTo(0, 0);
  }

  let view = $state('today');
  /** @type {null | {type: 'session', templateIndex: number} | {type: 'test', kind: string}} */
  let overlay = $state(null);
  let pendingCode = $state(null);

  onMount(() => {
    const match = location.hash.match(/sync=([A-Za-z2-7-]+)/);
    if (match) {
      const code = normalizeCode(match[1]);
      if (code && code !== sync.code) pendingCode = code;
      history.replaceState(null, '', location.pathname);
    }
    initSync();
  });

  function joinPending() {
    setSyncCode(pendingCode);
    pendingCode = null;
  }

  const tabs = [
    { id: 'today', label: 'Today', icon: 'M4 12h4l2-5 4 10 2-5h4' },
    { id: 'progress', label: 'Progress', icon: 'M5 19V11M12 19V5M19 19v-6' },
    { id: 'settings', label: 'Settings', icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 13a7.6 7.6 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7.4 7.4 0 0 0-1.7-1L15 3.5h-4l-.4 2.5a7.4 7.4 0 0 0-1.7 1l-2.4-1-2 3.4L6.6 11a7.6 7.6 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7.4 7.4 0 0 0 1.7 1l.4 2.5h4l.4-2.5a7.4 7.4 0 0 0 1.7-1l2.4 1 2-3.4Z' }
  ];
</script>

{#if overlay?.type === 'session'}
  <Session templateIndex={overlay.templateIndex} onclose={() => (overlay = null)} />
{:else if overlay?.type === 'test'}
  <HoldTest kind={overlay.kind} onclose={() => (overlay = null)} />
{:else}
  <div class="min-h-dvh pb-28">
    <main class="mx-auto w-full max-w-lg px-5 pt-6">
      {#if pendingCode}
        <div role="alert" class="alert alert-vertical sm:alert-horizontal mb-6 border-primary/30 bg-base-200">
          <div>
            <p class="font-semibold">Connect this device to your sync code?</p>
            <p class="text-sm opacity-70">
              Code {formatCode(pendingCode).slice(0, 9)}… Your logs on this device will be merged in, nothing is deleted.
            </p>
          </div>
          <div class="flex gap-2">
            <button class="btn btn-ghost btn-sm" onclick={() => (pendingCode = null)}>Not now</button>
            <button class="btn btn-primary btn-sm" onclick={joinPending}>Connect</button>
          </div>
        </div>
      {/if}

      {#if !app.data.program.started}
        <Onboarding onbaseline={() => open({ type: 'test', kind: 'baseline' })} />
      {:else if view === 'today'}
        <Today
          onstart={(templateIndex) => open({ type: 'session', templateIndex })}
          ontest={(kind) => open({ type: 'test', kind })}
        />
      {:else if view === 'progress'}
        <Progress ontest={() => open({ type: 'test', kind: 'extra' })} />
      {:else}
        <Settings />
      {/if}
    </main>

    {#if app.data.program.started}
      <nav class="dock dock-lg border-t border-base-300 bg-base-100/95 backdrop-blur" aria-label="Main">
        {#each tabs as tab (tab.id)}
          <button
            class={[view === tab.id && 'dock-active text-primary']}
            aria-current={view === tab.id ? 'page' : undefined}
            onclick={() => (view = tab.id)}
          >
            <svg class="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d={tab.icon} />
            </svg>
            <span class="dock-label">{tab.label}</span>
          </button>
        {/each}
      </nav>
    {/if}
  </div>
{/if}

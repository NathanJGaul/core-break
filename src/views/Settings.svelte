<script>
  import QRCode from 'qrcode';
  import {
    app, sync, syncNow, setSyncCode, normalizeCode, formatCode, generateCode,
    rotateSyncCode, deleteRemoteData, pruneTombstones, updateSettings, exportData, resetProgram
  } from '../lib/store.svelte.js';
  import { unlockAudio, beep } from '../lib/audio.js';

  let showCode = $state(false);
  let qr = $state('');
  let copied = $state(false);
  let joinInput = $state('');
  let joinError = $state('');
  let confirmReset = $state(false);
  let confirmOff = $state(false);
  let confirmRotate = $state(false);
  let confirmDelete = $state(false);

  const link = $derived(sync.code ? `${location.origin}/#sync=${sync.code}` : '');
  const lastSynced = $derived(
    sync.lastSynced ? new Date(sync.lastSynced).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'never'
  );

  $effect(() => {
    if (showCode && link) {
      QRCode.toDataURL(link, { margin: 1, width: 240 }).then((url) => (qr = url)).catch(() => (qr = ''));
    }
  });

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      copied = true;
      setTimeout(() => (copied = false), 2000);
    } catch {}
  }

  function join() {
    const code = normalizeCode(joinInput);
    if (!code) {
      joinError = 'A sync code is 32 letters and numbers. Check for typos.';
      return;
    }
    joinError = '';
    joinInput = '';
    setSyncCode(code);
  }

  function testSound() {
    unlockAudio();
    beep(1175, 380, 0.35);
  }

  async function rotate() {
    if (await rotateSyncCode()) {
      confirmRotate = false;
      showCode = false;
    }
  }

  async function removeRemote() {
    if (await deleteRemoteData()) {
      confirmDelete = false;
      showCode = false;
    }
  }
</script>

<h1 class="font-display text-5xl font-black leading-none">Settings</h1>

<section class="mt-8">
  <h2 class="font-semibold">Cues</h2>
  <div class="mt-3 divide-y divide-base-300 border-y border-base-300">
    <label class="flex cursor-pointer items-center justify-between py-3">
      <span>Beeps at the start and end of each interval</span>
      <input type="checkbox" class="toggle toggle-primary" checked={app.data.settings.sound !== false}
        onchange={(e) => updateSettings({ sound: e.currentTarget.checked })} />
    </label>
    <label class="flex cursor-pointer items-center justify-between py-3">
      <span>Vibration <span class="text-sm opacity-60">Android only</span></span>
      <input type="checkbox" class="toggle toggle-primary" checked={app.data.settings.vibrate !== false}
        onchange={(e) => updateSettings({ vibrate: e.currentTarget.checked })} />
    </label>
  </div>
  <button class="btn btn-ghost btn-sm mt-2 px-0" onclick={testSound}>Play test beep</button>
</section>

<section class="mt-10">
  <h2 class="font-semibold">Sync between devices</h2>
  {#if sync.code}
    <p class="mt-1 text-sm opacity-70">
      Last synced {lastSynced}.
      {#if sync.message || sync.storageError}
        <span class="text-error">{sync.message || 'Device storage is unavailable. Download a backup in Settings.'}</span>
      {/if}
    </p>
    <p class="mt-3 opacity-80">
      Anyone with your sync code can see and change your logs. It is a bearer password, not an account or recovery credential. Synchronized KV data is plaintext to the service operator; download a backup before rotating or deleting.
    </p>

    {#if showCode}
      <div class="mt-4 rounded-box bg-base-200 p-4">
        <p class="font-mono text-sm break-all">{formatCode(sync.code)}</p>
        {#if qr}
          <img src={qr} alt="QR code that opens Core Break with your sync code" class="mt-4 size-48 rounded-field bg-white p-2" />
          <p class="mt-2 text-sm opacity-70">Scan with your other device's camera to connect it.</p>
        {/if}
        <div class="mt-4 flex flex-wrap gap-2">
          <button class="btn btn-sm btn-neutral" onclick={copyLink}>{copied ? 'Link copied' : 'Copy connect link'}</button>
          <button class="btn btn-sm btn-ghost" onclick={() => (showCode = false)}>Hide code</button>
        </div>
      </div>
    {:else}
      <div class="mt-4 flex flex-wrap gap-2">
        <button class="btn btn-sm btn-outline" onclick={() => (showCode = true)}>Show code and QR</button>
        <button class="btn btn-sm btn-ghost" onclick={() => syncNow()} disabled={sync.status === 'syncing'}>
          {sync.status === 'syncing' ? 'Syncing…' : 'Sync now'}
        </button>
      </div>
    {/if}

    <div class="mt-6">
      <p class="text-sm font-semibold">Clean up deleted history</p>
      <p class="mt-1 text-sm opacity-60">Removes deleted records after every known device has acknowledged them. Devices that have not synced keep cleanup blocked.</p>
      <button class="btn btn-ghost btn-sm mt-2 px-0" onclick={() => pruneTombstones()} disabled={sync.status === 'syncing'}>Clean up deleted history</button>
    </div>

    <div class="mt-6">
      <label class="text-sm font-semibold" for="join">Use a code from another device instead</label>
      <p class="text-sm opacity-60">Logs on this device are merged in. Nothing is deleted.</p>
      <div class="join mt-2 w-full">
        <input id="join" class="input join-item w-full font-mono uppercase" placeholder="XXXX-XXXX-…" autocomplete="off" bind:value={joinInput} />
        <button class="btn btn-neutral join-item" onclick={join}>Connect</button>
      </div>
      {#if joinError}<p class="mt-2 text-sm text-error">{joinError}</p>{/if}
    </div>

    <div class="mt-6">
      {#if confirmOff}
        <p class="text-sm">Stop syncing on this device? Your data stays here and on the server.</p>
        <div class="mt-2 flex gap-2">
          <button class="btn btn-sm btn-error" onclick={() => { setSyncCode(null); confirmOff = false; showCode = false; }}>Turn off sync</button>
          <button class="btn btn-sm btn-ghost" onclick={() => (confirmOff = false)}>Cancel</button>
        </div>
      {:else}
        <button class="btn btn-ghost btn-sm px-0 text-error" onclick={() => (confirmOff = true)}>Turn off sync on this device</button>
      {/if}
    </div>

    <div class="mt-5 flex flex-wrap gap-3">
      {#if confirmRotate}
        <div class="w-full rounded-box bg-base-200 p-4 text-sm">
          <p>Rotate the shared code? Connected devices using the old code will stop syncing. Download a backup first; there is no account recovery.</p>
          <div class="mt-2 flex gap-2">
            <button class="btn btn-sm btn-warning" onclick={rotate}>Rotate code</button>
            <button class="btn btn-sm btn-ghost" onclick={() => (confirmRotate = false)}>Cancel</button>
          </div>
        </div>
      {:else}
        <button class="btn btn-ghost btn-sm px-0" onclick={() => (confirmRotate = true)}>Rotate shared code</button>
      {/if}
      {#if confirmDelete}
        <div class="w-full rounded-box bg-base-200 p-4 text-sm">
          <p>Delete all synced data from the server? This cannot be undone. Export a backup first; local data stays on this device.</p>
          <div class="mt-2 flex gap-2">
            <button class="btn btn-sm btn-error" onclick={removeRemote}>Delete synced data</button>
            <button class="btn btn-sm btn-ghost" onclick={() => (confirmDelete = false)}>Cancel</button>
          </div>
        </div>
      {:else}
        <button class="btn btn-ghost btn-sm px-0 text-error" onclick={() => (confirmDelete = true)}>Delete synced data</button>
      {/if}
    </div>
  {:else}
    <p class="mt-1 opacity-80">Sync is off. Your logs are saved only on this device.</p>
    <div class="mt-3 flex flex-wrap gap-2">
      <button class="btn btn-primary btn-sm" onclick={() => setSyncCode(generateCode())}>Create a new sync code</button>
    </div>
    <div class="join mt-4 w-full">
      <input class="input join-item w-full font-mono uppercase" placeholder="Or paste an existing code" aria-label="Existing sync code" autocomplete="off" bind:value={joinInput} />
      <button class="btn btn-neutral join-item" onclick={join}>Connect</button>
    </div>
    {#if joinError}<p class="mt-2 text-sm text-error">{joinError}</p>{/if}
  {/if}
</section>

<section class="mt-10 mb-6">
  <h2 class="font-semibold">Your data</h2>
  <div class="mt-3 flex flex-wrap gap-2">
    <button class="btn btn-sm btn-outline" onclick={exportData}>Download backup (JSON)</button>
  </div>
  <div class="mt-6">
    {#if confirmReset}
      <p class="text-sm">Restart from block 1 with a new baseline test? Your session and test history is kept.</p>
      <div class="mt-2 flex gap-2">
        <button class="btn btn-sm btn-error" onclick={() => { resetProgram(); confirmReset = false; }}>Restart program</button>
        <button class="btn btn-sm btn-ghost" onclick={() => (confirmReset = false)}>Cancel</button>
      </div>
    {:else}
      <button class="btn btn-ghost btn-sm px-0 text-error" onclick={() => (confirmReset = true)}>Restart program from block 1</button>
    {/if}
  </div>
</section>

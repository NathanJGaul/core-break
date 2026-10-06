<script>
  import { sync, syncNow } from '../lib/store.svelte.js';

  const label = $derived(
    !sync.code ? 'Sync off'
    : sync.status === 'syncing' ? 'Syncing'
    : sync.status === 'ok' ? 'Synced'
    : sync.status === 'offline' ? 'Offline'
    : sync.status === 'error' ? 'Not synced'
    : 'Sync'
  );
  const dot = $derived(
    sync.status === 'ok' ? 'status-success'
    : sync.status === 'error' ? 'status-error'
    : sync.status === 'offline' ? 'status-warning'
    : 'status-neutral'
  );
</script>

<button
  class="btn btn-ghost btn-sm shrink-0 gap-2 font-normal"
  onclick={() => syncNow()}
  title={sync.message || 'Sync now'}
  disabled={!sync.code}
>
  <span class={['status', dot, sync.status === 'syncing' && 'animate-pulse']} aria-hidden="true"></span>
  {label}
</button>

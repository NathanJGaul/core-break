import { emptyState, mergeStates, migrateState, validateState } from './merge.js';
import { readItem as readStorageItem, writeItem as writeStorageItem } from './storage.js';
import { localDate } from './dates.js';

const DATA_KEY = 'core-break:data';
const CODE_KEY = 'core-break:sync-code';
const SYNC_AT_KEY = 'core-break:last-synced';
const DEVICE_KEY = 'core-break:device-id';
const REVISION_KEY = 'core-break:sync-revision';

function readLocal() {
  try {
    const raw = localStorage.getItem(DATA_KEY);
    if (raw) return migrateState(JSON.parse(raw));
  } catch {}
  return emptyState();
}

function storage() {
  try { return globalThis.localStorage; } catch { return null; }
}

function readItem(key) {
  const target = storage();
  return target ? readStorageItem(target, key) : null;
}

function writeItem(key, value) {
  const target = storage();
  return target ? writeStorageItem(target, key, value) : false;
}

function deviceIdentifier() {
  const saved = readItem(DEVICE_KEY);
  if (saved) return saved;
  const value = crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  writeItem(DEVICE_KEY, value);
  return value;
}

export const app = $state({ data: readLocal() });

export const sync = $state({
  code: readItem(CODE_KEY),
  deviceId: deviceIdentifier(),
  revision: Number(readItem(REVISION_KEY)) || 0,
  status: 'idle', // idle | syncing | ok | offline | error | revoked
  message: '',
  errorCode: '',
  storageError: false,
  lastSynced: Number(readItem(SYNC_AT_KEY)) || null
});

function saveLocal() {
  const ok = writeItem(DATA_KEY, JSON.stringify($state.snapshot(app.data)));
  sync.storageError = !ok;
  return ok;
}

function commit() {
  saveLocal();
  schedulePush();
}

export function uid() {
  return crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// ---------- Sync ----------

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((b) => ALPHABET[b % 32]).join('');
}

export function normalizeCode(input) {
  const code = String(input ?? '').replace(/[\s-]/g, '').toUpperCase();
  return /^[A-Z2-7]{32}$/.test(code) ? code : null;
}

export function formatCode(code) {
  return code ? code.match(/.{1,4}/g).join('-') : '';
}

let pushTimer = null;
let inFlight = null;
let again = false;

function schedulePush() {
  if (!sync.code) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(syncNow, 2000);
}

export async function syncNow() {
  if (!sync.code) return;
  if (inFlight) {
    again = true;
    return inFlight;
  }
  clearTimeout(pushTimer);
  sync.status = 'syncing';
  sync.message = '';
  sync.errorCode = '';
  inFlight = (async () => {
    try {
      const res = await fetch('/api/sync', {
        method: 'PUT',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${sync.code}` },
        body: JSON.stringify({ protocol: 2, deviceId: sync.deviceId, lastRevision: sync.revision, state: $state.snapshot(app.data) })
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.state) {
        sync.errorCode = body?.error ?? `http_${res.status}`;
        sync.status = res.status === 410 ? 'revoked' : 'error';
        sync.message = {
          revoked_code: 'This sync code was revoked. Use a current code or connect a new device.',
          unsupported_protocol: 'This app needs an update before it can sync.',
          too_large: 'Synced data is at its size limit. Download a backup and prune local history.',
          invalid_state: 'This device has invalid sync data. Download a backup before continuing.'
        }[sync.errorCode] ?? `Sync failed (${sync.errorCode}). Changes remain on this device; retry when ready.`;
        return;
      }
      const migrated = migrateState(body.state);
      const validation = validateState(migrated);
      if (!validation.ok) throw new Error(validation.code);
      app.data = mergeStates($state.snapshot(app.data), migrated);
      if (!saveLocal()) {
        sync.status = 'error';
        sync.errorCode = 'local_storage_unavailable';
        sync.message = 'Device storage is full or unavailable. Download a backup; sync is paused until storage recovers.';
        return;
      }
      sync.revision = Number(body.revision) || sync.revision;
      writeItem(REVISION_KEY, String(sync.revision));
      sync.status = 'ok';
      sync.lastSynced = Date.now();
      writeItem(SYNC_AT_KEY, String(sync.lastSynced));
    } catch (error) {
      sync.errorCode = error?.message || 'network_error';
      sync.status = typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'error';
      sync.message = sync.status === 'offline'
        ? 'You are offline. Changes are saved on this device and will sync later.'
        : 'Could not reach the sync server. Changes are saved on this device; retry when ready.';
    } finally {
      inFlight = null;
      if (again) {
        again = false;
        schedulePush();
      }
    }
  })();
  return inFlight;
}

export function setSyncCode(code) {
  const normalized = code ? normalizeCode(code) : null;
  sync.code = normalized;
  if (!writeItem(CODE_KEY, normalized)) sync.storageError = true;
  if (normalized) syncNow();
  else {
    sync.status = 'idle';
    sync.message = '';
    sync.errorCode = '';
  }
}

export async function rotateSyncCode() {
  if (!sync.code) return false;
  try {
    const res = await fetch('/api/sync/rotate', { method: 'POST', headers: { authorization: `Bearer ${sync.code}` } });
    const body = await res.json().catch(() => null);
    if (!res.ok || !normalizeCode(body?.code)) throw new Error(body?.error ?? 'rotation_failed');
    setSyncCode(body.code);
    return true;
  } catch (error) {
    sync.status = 'error';
    sync.errorCode = error?.message ?? 'rotation_failed';
    sync.message = 'Could not rotate the sync code. Existing local data is unchanged; retry when ready.';
    return false;
  }
}

export async function deleteRemoteData() {
  if (!sync.code) return false;
  try {
    const res = await fetch('/api/sync', { method: 'DELETE', headers: { authorization: `Bearer ${sync.code}` } });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new Error(body?.error ?? 'delete_failed');
    setSyncCode(null);
    return true;
  } catch (error) {
    sync.status = 'error';
    sync.errorCode = error?.message ?? 'delete_failed';
    sync.message = 'Could not delete synced data. Nothing was removed; retry when ready.';
    return false;
  }
}

export function initSync() {
  if (sync.code) syncNow();
  else if (app.data.program.started) setSyncCode(generateCode());
  window.addEventListener('online', () => syncNow());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') syncNow();
  });
}

// ---------- Actions ----------

export function startProgram(baselineSeconds) {
  const today = localDate();
  const now = Date.now();
  const id = uid();
  app.data.tests[id] = { id, writerId: sync.deviceId, opId: uid(), updatedAt: now, at: now, date: today, seconds: baselineSeconds, kind: 'baseline', blockStart: today };
  app.data.program = { ...$state.snapshot(app.data.program), writerId: sync.deviceId, opId: uid(), updatedAt: now, started: true, blockIndex: 0, blockStart: today, history: [] };
  commit();
  if (!sync.code) setSyncCode(generateCode());
}

export function logSession(record) {
  const now = Date.now();
  const id = uid();
  app.data.sessions[id] = { id, writerId: sync.deviceId, opId: uid(), updatedAt: now, ...record };
  commit();
}

export function deleteSession(id) {
  const s = app.data.sessions[id];
  if (!s) return;
  app.data.sessions[id] = { ...s, deleted: true, deletedAt: Date.now(), deletedRevision: sync.revision + 1, writerId: sync.deviceId, opId: uid(), updatedAt: Date.now() };
  commit();
}

export function logTest(seconds, kind = 'extra') {
  const now = Date.now();
  const id = uid();
  app.data.tests[id] = {
    id,
    writerId: sync.deviceId,
    opId: uid(),
    updatedAt: now,
    at: now,
    date: localDate(),
    seconds,
    kind,
    blockStart: app.data.program.blockStart
  };
  commit();
}

export function deleteTest(id) {
  const t = app.data.tests[id];
  if (!t) return;
  app.data.tests[id] = { ...t, deleted: true, deletedAt: Date.now(), deletedRevision: sync.revision + 1, writerId: sync.deviceId, opId: uid(), updatedAt: Date.now() };
  commit();
}


export function decideBlock(decision) {
  const p = $state.snapshot(app.data.program);
  const today = localDate();
  app.data.program = {
    ...p,
    writerId: sync.deviceId,
    opId: uid(),
    updatedAt: Date.now(),
    blockIndex: decision === 'advance' ? p.blockIndex + 1 : p.blockIndex,
    blockStart: today,
    history: [...(p.history ?? []), { blockIndex: p.blockIndex, start: p.blockStart, end: today, decision }]
  };
  commit();
}

export function updateSettings(patch) {
  app.data.settings = { ...$state.snapshot(app.data.settings), ...patch, writerId: sync.deviceId, opId: uid(), updatedAt: Date.now() };
  commit();
}

export function resetProgram() {
  const now = Date.now();
  app.data.program = { ...$state.snapshot(app.data.program), writerId: sync.deviceId, opId: uid(), updatedAt: now, started: false, blockIndex: 0, blockStart: null, history: [] };
  commit();
}

export function exportData() {
  const blob = new Blob([JSON.stringify($state.snapshot(app.data), null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `core-break-${localDate()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

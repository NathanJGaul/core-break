import { emptyState, mergeStates, isValidState } from './merge.js';
import { localDate } from './dates.js';

const DATA_KEY = 'core-break:data';
const CODE_KEY = 'core-break:sync-code';
const SYNC_AT_KEY = 'core-break:last-synced';

function readLocal() {
  try {
    const raw = localStorage.getItem(DATA_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (isValidState(parsed)) return mergeStates(emptyState(), parsed);
    }
  } catch {}
  return emptyState();
}

function readItem(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeItem(key, value) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {}
}

export const app = $state({ data: readLocal() });

export const sync = $state({
  code: readItem(CODE_KEY),
  status: 'idle', // idle | syncing | ok | offline | error
  message: '',
  lastSynced: Number(readItem(SYNC_AT_KEY)) || null
});

function saveLocal() {
  writeItem(DATA_KEY, JSON.stringify($state.snapshot(app.data)));
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
  inFlight = (async () => {
    try {
      const res = await fetch('/api/sync', {
        method: 'PUT',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${sync.code}` },
        body: JSON.stringify({ state: $state.snapshot(app.data) })
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.state) {
        sync.status = 'error';
        sync.message = body?.error ?? `Sync server responded with ${res.status}.`;
        return;
      }
      app.data = mergeStates($state.snapshot(app.data), body.state);
      saveLocal();
      sync.status = 'ok';
      sync.lastSynced = Date.now();
      writeItem(SYNC_AT_KEY, String(sync.lastSynced));
    } catch {
      sync.status = navigator.onLine === false ? 'offline' : 'error';
      sync.message =
        sync.status === 'offline'
          ? 'You are offline. Changes are saved on this device and will sync later.'
          : 'Could not reach the sync server. Changes are saved on this device.';
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
  sync.code = code;
  writeItem(CODE_KEY, code);
  if (code) syncNow();
  else {
    sync.status = 'idle';
    sync.message = '';
  }
}

export function initSync() {
  // A code is created when the program starts, so a new device can join
  // an existing code during onboarding instead.
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
  app.data.tests[id] = { id, updatedAt: now, at: now, date: today, seconds: baselineSeconds, kind: 'baseline', blockStart: today };
  app.data.program = { updatedAt: now, started: true, blockIndex: 0, blockStart: today, history: [] };
  commit();
  if (!sync.code) setSyncCode(generateCode());
}

export function logSession(record) {
  const now = Date.now();
  const id = uid();
  app.data.sessions[id] = { id, updatedAt: now, ...record };
  commit();
}

export function deleteSession(id) {
  const s = app.data.sessions[id];
  if (!s) return;
  app.data.sessions[id] = { ...s, deleted: true, updatedAt: Date.now() };
  commit();
}

export function logTest(seconds, kind = 'extra') {
  const now = Date.now();
  const id = uid();
  app.data.tests[id] = {
    id,
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
  app.data.tests[id] = { ...t, deleted: true, updatedAt: Date.now() };
  commit();
}

export function decideBlock(decision) {
  const p = $state.snapshot(app.data.program);
  const today = localDate();
  app.data.program = {
    ...p,
    updatedAt: Date.now(),
    blockIndex: decision === 'advance' ? p.blockIndex + 1 : p.blockIndex,
    blockStart: today,
    history: [...(p.history ?? []), { blockIndex: p.blockIndex, start: p.blockStart, end: today, decision }]
  };
  commit();
}

export function updateSettings(patch) {
  app.data.settings = { ...$state.snapshot(app.data.settings), ...patch, updatedAt: Date.now() };
  commit();
}

export function resetProgram() {
  const now = Date.now();
  app.data.program = { updatedAt: now, started: false, blockIndex: 0, blockStart: null, history: [] };
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

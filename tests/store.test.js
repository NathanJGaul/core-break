import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, validateState, verifyDeviceAcknowledgement } from '../src/lib/merge.js';

class FakeStorage {
  constructor() {
    this.values = new Map();
    this.fail = false;
  }

  getItem(key) {
    if (this.fail) throw new Error('storage unavailable');
    return this.values.get(key) ?? null;
  }

  setItem(key, value) {
    if (this.fail) throw new Error('storage unavailable');
    this.values.set(key, String(value));
  }

  removeItem(key) {
    if (this.fail) throw new Error('storage unavailable');
    this.values.delete(key);
  }
}

const storage = new FakeStorage();
globalThis.localStorage = storage;
if (!globalThis.navigator) globalThis.navigator = {};
globalThis.$state = (value) => value;
globalThis.$state.snapshot = (value) => structuredClone(value);

const store = await import(`../src/lib/store.svelte.js?behavior=${Date.now()}`);
const {
  app,
  sync,
  normalizeCode,
  setSyncCode,
  syncNow,
  pruneTombstones,
  rotateSyncCode,
  deleteRemoteData,
  logSession,
  logTest,
  decideBlock,
  deleteSession,
  deleteTest,
  updateSettings
} = store;
const code = 'A'.repeat(32);
const replacement = 'B'.repeat(32);
const deviceSecret = 'A'.repeat(43);

function reset() {
  storage.fail = false;
  storage.values.clear();
  app.data = emptyState();
  sync.code = null;
  sync.deviceId = 'device-a';
  sync.deviceSecret = deviceSecret;
  sync.revision = 0;
  sync.status = 'idle';
  sync.message = '';
  sync.errorCode = '';
  sync.storageError = false;
  sync.lastSynced = null;
}

test('syncNow authenticates the device and surfaces revoked responses', async () => {
  reset();
  sync.code = code;
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options, body: JSON.parse(options.body) };
    return new Response(JSON.stringify({ state: emptyState(), revision: 4 }), { status: 200 });
  };
  await syncNow();
  assert.equal(sync.status, 'ok');
  assert.equal(sync.revision, 4);
  assert.equal(request.body.protocol, 2);
  assert.equal(request.body.deviceId, 'device-a');
  assert.equal(await verifyDeviceAcknowledgement(deviceSecret, 'device-a', 0, request.body.deviceProof), true);
  assert.equal(storage.getItem('core-break:data') !== null, true);

  globalThis.fetch = async () => new Response(JSON.stringify({ error: 'revoked_code' }), { status: 410 });
  await syncNow();
  assert.equal(sync.status, 'revoked');
  assert.equal(sync.errorCode, 'revoked_code');
  assert.match(sync.message, /revoked/);
});

test('syncNow reports local storage failure and offline network failure', async () => {
  reset();
  sync.code = code;
  globalThis.fetch = async () => new Response(JSON.stringify({ state: emptyState(), revision: 1 }), { status: 200 });
  storage.fail = true;
  await syncNow();
  assert.equal(sync.status, 'error');
  assert.equal(sync.errorCode, 'local_storage_unavailable');
  assert.match(sync.message, /storage/);

  reset();
  sync.code = code;
  Object.defineProperty(globalThis.navigator, 'onLine', { configurable: true, value: false });
  globalThis.fetch = async () => { throw new Error('network down'); };
  await syncNow();
  assert.equal(sync.status, 'offline');
  assert.match(sync.message, /offline/i);
  Object.defineProperty(globalThis.navigator, 'onLine', { configurable: true, value: true });
});

test('prune reconciles local tombstones with the authoritative server response', async () => {
  reset();
  sync.code = code;
  const tombstone = {
    id: 'gone',
    updatedAt: 2,
    writerId: 'device-a',
    opId: 'delete-gone',
    deleted: true,
    deletedAt: 2,
    deletedRevision: 1,
    date: '2026-10-06',
    blockStart: '2026-10-01',
    template: 'A',
    block: 0,
    form: 'clean',
    intervals: Array.from({ length: 5 }, () => ({ ex: 'hollow', work: 20, done: true }))
  };
  app.data.sessions.gone = tombstone;
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, body: JSON.parse(options.body) };
    return new Response(JSON.stringify({ state: emptyState(), revision: 2, pruned: { sessions: { gone: tombstone }, tests: {} } }), { status: 200 });
  };
  assert.equal(await pruneTombstones(), true);
  assert.equal(request.url, '/api/sync/prune');
  assert.equal(request.body.acknowledgedRevision, 0);
  assert.equal(app.data.sessions.gone, undefined);
  assert.equal(sync.revision, 2);
});

test('rotation and remote deletion update the persisted sync lifecycle', async () => {
  reset();
  sync.code = code;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, method: options.method });
    if (url === '/api/sync/rotate') return new Response(JSON.stringify({ code: replacement }), { status: 200 });
    if (options.method === 'DELETE') return new Response(JSON.stringify({ ok: true }), { status: 200 });
    return new Response(JSON.stringify({ state: emptyState(), revision: 2 }), { status: 200 });
  };
  assert.equal(await rotateSyncCode(), true);
  await syncNow();
  assert.equal(sync.code, replacement);
  assert.equal(calls.some(({ url }) => url === '/api/sync/rotate'), true);
  assert.equal(calls.some(({ method }) => method === 'PUT'), true);

  assert.equal(await deleteRemoteData(), true);
  assert.equal(sync.code, null);
  assert.equal(storage.getItem('core-break:sync-code'), null);
  assert.equal(calls.some(({ method }) => method === 'DELETE'), true);
});

test('public record actions persist validator-compatible sessions, tests, decisions, and tombstones', () => {
  reset();
  app.data.program = {
    ...emptyState().program,
    started: true,
    blockStart: '2026-10-01'
  };
  logSession({
    startedAt: 1,
    endedAt: 2,
    date: '2026-10-06',
    block: 0,
    blockStart: '2026-10-01',
    template: 'A',
    intervals: Array.from({ length: 5 }, (_, index) => ({
      ex: 'hollow',
      side: null,
      pattern: 'antiExtension',
      work: 20,
      done: index < 4
    })),
    form: 'clean'
  });
  const sessionId = Object.keys(app.data.sessions)[0];
  logTest(42, 'block-end');
  const testId = Object.keys(app.data.tests)[0];
  decideBlock('repeat');
  deleteSession(sessionId);
  deleteTest(testId);

  assert.equal(validateState(app.data).ok, true);
  assert.equal(app.data.sessions[sessionId].deleted, true);
  assert.equal(app.data.tests[testId].deleted, true);
  assert.equal(app.data.program.history.at(-1).decision, 'repeat');
  assert.equal(validateState(JSON.parse(storage.getItem('core-break:data'))).ok, true);
});

test('settings and onboarding sync lifecycles expose revoked and storage failures and reset revisions on join', async () => {
  reset();
  sync.code = code;
  globalThis.fetch = async () => new Response(JSON.stringify({ error: 'revoked_code' }), { status: 410 });
  setSyncCode(code);
  await syncNow();
  assert.equal(sync.status, 'revoked');
  assert.match(sync.message, /revoked/);

  reset();
  storage.fail = true;
  globalThis.fetch = async () => new Response(JSON.stringify({ state: emptyState(), revision: 1 }), { status: 200 });
  setSyncCode(code);
  await syncNow();
  assert.equal(sync.storageError, true);
  assert.equal(sync.errorCode, 'local_storage_unavailable');
  assert.match(sync.message, /storage/i);

  reset();
  sync.code = code;
  sync.revision = 9;
  let request;
  globalThis.fetch = async (url, options) => {
    if (url === '/api/sync') request = JSON.parse(options.body);
    return new Response(JSON.stringify({ state: emptyState(), revision: 1 }), { status: 200 });
  };
  setSyncCode(replacement);
  await syncNow();
  assert.equal(request.lastRevision, 0);
  assert.equal(sync.code, replacement);

  reset();
  updateSettings({ sound: false });
  assert.equal(app.data.settings.sound, false);
  assert.equal(JSON.parse(storage.getItem('core-break:data')).settings.sound, false);
  assert.equal(normalizeCode('aaaa-aaaa-aaaa-aaaa-aaaa-aaaa-aaaa-aaaa'), code);
  assert.equal(normalizeCode('not-a-code'), null);
  setSyncCode(null);
});

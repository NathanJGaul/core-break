import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { keyFor } from '../worker/index.js';
import { SyncCoordinator } from '../worker/sync-coordinator.js';
import { emptyState, deviceAcknowledgementProof } from '../src/lib/merge.js';

class MemoryStorage {
  constructor() { this.values = new Map(); }
  async get(key, options) { const value = this.values.get(key); return options?.type === 'json' && typeof value === 'string' ? JSON.parse(value) : value ?? null; }
  async put(key, value) { this.values.set(key, value); }
  async delete(key) { this.values.delete(key); }
}

class DurableObjectStub {
  constructor(legacy) {
    this.storage = new MemoryStorage();
    this.coordinator = new SyncCoordinator({ storage: this.storage }, { SYNC: legacy });
  }
  async fetch(request) { return this.coordinator.fetch(request); }
}

class DurableObjectNamespace {
  constructor(legacy) { this.objects = new Map(); this.legacy = legacy; }
  idFromName(name) { return name; }
  get(id) { if (!this.objects.has(id)) this.objects.set(id, new DurableObjectStub(this.legacy)); return this.objects.get(id); }
}

class MemoryKV {
  constructor() { this.values = new Map(); }
  async get(key, type) { const value = this.values.get(key); return type === 'json' && value ? JSON.parse(value) : value ?? null; }
  async put(key, value) { this.values.set(key, value); }
  async delete(key) { this.values.delete(key); }
}

const code = 'A'.repeat(32);
const code2 = 'B'.repeat(32);
const env = () => {
  const SYNC = new MemoryKV();
  return {
    SYNC,
    SYNC_COORDINATOR: new DurableObjectNamespace(SYNC),
    VERSION: 'test-version',
    ENVIRONMENT: 'test',
    ASSETS: { fetch: () => new Response('asset') }
  };
};

function record(id, template = 'A', writerId = 'device-a') {
  return { id, updatedAt: Date.now(), writerId, opId: `${writerId}-${id}`, date: '2026-10-06', blockStart: '2026-10-01', template, block: 0, form: 'clean', intervals: Array.from({ length: 5 }, () => ({ ex: 'hollow', work: 20, done: true })) };
}

function stateWith(id, template = 'A', writerId = 'device-a') {
  const state = emptyState();
  state.sessions[id] = record(id, template, writerId);
  return state;
}

const deviceSecrets = new Map([
  ['device-a', 'A'.repeat(43)],
  ['device-b', 'B'.repeat(43)]
]);

async function protocol2(deviceId, lastRevision, state, includeSecret = true) {
  const deviceSecret = deviceSecrets.get(deviceId) ?? 'C'.repeat(43);
  return {
    protocol: 2,
    deviceId,
    lastRevision,
    deviceProof: await deviceAcknowledgementProof(deviceSecret, deviceId, lastRevision),
    ...(includeSecret ? { deviceSecret } : {}),
    state
  };
}

async function call(path, options = {}, runtime = env()) {
  return worker.fetch(new Request(`https://example.test${path}`, options), runtime);
}

async function body(response) { return response.json(); }

test('health and API responses expose request/version headers without state', async () => {
  const response = await call('/api/health');
  const result = await body(response);
  assert.equal(response.status, 200);
  assert.equal(result.storageMode, 'durable-object');
  assert.equal(result.version, 'test-version');
  assert.ok(response.headers.get('x-request-id'));
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.match(response.headers.get('content-security-policy'), /default-src/);
  assert.equal(JSON.stringify(result).includes(code), false);
});

test('rejects malformed credentials, future protocols, and actual oversized bodies', async () => {
  const runtime = env();
  assert.equal((await call('/api/sync', { method: 'GET' }, runtime)).status, 401);
  const future = await call('/api/sync', {
    method: 'PUT', headers: { authorization: `Bearer ${code}`, 'content-type': 'application/json' },
    body: JSON.stringify({ protocol: 99, state: emptyState() })
  }, runtime);
  assert.equal(future.status, 426);
  assert.equal((await body(future)).error, 'unsupported_protocol');
  const oversized = await call('/api/sync', {
    method: 'PUT', headers: { authorization: `Bearer ${code}`, 'content-type': 'application/json' },
    body: JSON.stringify({ state: { ...emptyState(), sessions: { giant: { value: 'x'.repeat(2 * 1024 * 1024) } } } })
  }, runtime);
  assert.equal(oversized.status, 413);
  assert.equal((await body(oversized)).error, 'too_large');
});

test('accepts v1 and protocol 2 requests and serializes concurrent device updates', async () => {
  const runtime = env();
  const first = call('/api/sync', {
    method: 'PUT', headers: { authorization: `Bearer ${code}`, 'content-type': 'application/json' },
    body: JSON.stringify({ state: stateWith('one') })
  }, runtime);
  const second = call('/api/sync', {
    method: 'PUT', headers: { authorization: `Bearer ${code}`, 'content-type': 'application/json' },
    body: JSON.stringify(await protocol2('device-b', 0, stateWith('two', 'B', 'device-b')))
  }, runtime);
  const responses = await Promise.all([first, second]);
  assert.deepEqual(responses.map((response) => response.status), [200, 200]);
  const fetched = await call('/api/sync', { headers: { authorization: `Bearer ${code}` } }, runtime);
  const result = await body(fetched);
  assert.equal(Object.keys(result.state.sessions).length, 2);
  assert.ok(result.revision >= 2);
});

test('rotation copies state, revokes the old code, and deletion leaves a revocation marker', async () => {
  const runtime = env();
  const put = await call('/api/sync', {
    method: 'PUT', headers: { authorization: `Bearer ${code}`, 'content-type': 'application/json' },
    body: JSON.stringify(await protocol2('device-a', 0, stateWith('keep')))
  }, runtime);
  assert.equal(put.status, 200);
  await runtime.SYNC.put(await keyFor(code), JSON.stringify(stateWith('legacy-old')));
  const coordinator = runtime.SYNC_COORDINATOR.get(await keyFor(code));
  const firstPrepare = await coordinator.fetch(new Request('https://coordinator.internal/internal/prepare-rotation', { method: 'POST', headers: { 'x-sync-code': code } }));
  const secondPrepare = await coordinator.fetch(new Request('https://coordinator.internal/internal/prepare-rotation', { method: 'POST', headers: { 'x-sync-code': code } }));
  assert.equal((await body(firstPrepare)).code, (await body(secondPrepare)).code);
  const rotated = await call('/api/sync/rotate', { method: 'POST', headers: { authorization: `Bearer ${code}` } }, runtime);
  const replacement = await body(rotated);
  assert.equal(rotated.status, 200);
  assert.match(replacement.code, /^[A-Z2-7]{32}$/);
  assert.equal((await call('/api/sync', { headers: { authorization: `Bearer ${code}` } }, runtime)).status, 410);
  const replacementPut = await call('/api/sync', {
    method: 'PUT', headers: { authorization: `Bearer ${replacement.code}`, 'content-type': 'application/json' },
    body: JSON.stringify(await protocol2('device-a', 1, stateWith('keep'), false))
  }, runtime);
  assert.equal(replacementPut.status, 200);
  assert.equal(await runtime.SYNC.get(await keyFor(code)), null);
  await runtime.SYNC.put(await keyFor(replacement.code), JSON.stringify(stateWith('legacy-replacement')));
  assert.ok(await runtime.SYNC.get(await keyFor(replacement.code)));
  assert.equal((await call('/api/sync', { headers: { authorization: `Bearer ${replacement.code}` } }, runtime)).status, 200);
  const deleted = await call('/api/sync', { method: 'DELETE', headers: { authorization: `Bearer ${replacement.code}` } }, runtime);
  assert.equal(deleted.status, 200);
  assert.equal(await runtime.SYNC.get(await keyFor(replacement.code)), null);
  assert.equal(await runtime.SYNC.get(await keyFor(code)), null);
  assert.equal((await call('/api/sync', { headers: { authorization: `Bearer ${replacement.code}` } }, runtime)).status, 410);
  assert.equal((await call('/api/sync', { method: 'PUT', headers: { authorization: `Bearer ${replacement.code}`, 'content-type': 'application/json' }, body: JSON.stringify({ state: stateWith('recreate') }) }, runtime)).status, 410);
});

test('imports legacy KV once and preserves validated tombstones', async () => {
  const runtime = env();
  const legacy = stateWith('legacy');
  legacy.schema = 1;
  legacy.sessions.deleted = { ...legacy.sessions.legacy, id: 'deleted', deleted: true, deletedAt: Date.now(), deletedRevision: 1, writerId: 'old-device', opId: 'delete-1' };
  await runtime.SYNC.put(await keyFor(code), JSON.stringify(legacy));
  const first = await call('/api/sync', { headers: { authorization: `Bearer ${code}` } }, runtime);
  const firstBody = await body(first);
  assert.equal(first.status, 200);
  assert.equal(firstBody.state.sessions.legacy.id, 'legacy');
  assert.equal(firstBody.state.sessions.deleted.deleted, true);
  const second = await call('/api/sync', { headers: { authorization: `Bearer ${code}` } }, runtime);
  assert.equal((await body(second)).state.sessions.deleted.deleted, true);
  const malformedRuntime = env();
  await malformedRuntime.SYNC.put(await keyFor(code2), JSON.stringify({ schema: 1, sessions: { bad: { value: 'nope' } }, tests: {}, program: {}, settings: {} }));
  const malformed = await call('/api/sync', { headers: { authorization: `Bearer ${code2}` } }, malformedRuntime);
  assert.equal(malformed.status, 200);
  assert.equal(Object.keys((await body(malformed)).state.sessions).length, 0);
});

test('legacy imports register an unacknowledged participant for tombstones', async () => {
  const runtime = env();
  const legacy = stateWith('gone', 'A', 'old-device');
  legacy.schema = 1;
  delete legacy.sessions.gone.writerId;
  delete legacy.sessions.gone.opId;
  await runtime.SYNC.put(await keyFor(code), JSON.stringify(legacy));
  const imported = await call('/api/sync', { headers: { authorization: `Bearer ${code}` } }, runtime);
  assert.equal(imported.status, 200);

  const deleted = stateWith('gone', 'A', 'device-a');
  deleted.sessions.gone.deleted = true;
  deleted.sessions.gone.deletedAt = Date.now();
  deleted.sessions.gone.updatedAt = Date.now() + 1;
  const deletePut = await call('/api/sync', {
    method: 'PUT', headers: { authorization: `Bearer ${code}`, 'content-type': 'application/json' },
    body: JSON.stringify(await protocol2('device-a', 0, deleted))
  }, runtime);
  assert.equal(deletePut.status, 200);

  const prune = await call('/api/sync/prune', {
    method: 'POST', headers: { authorization: `Bearer ${code}`, 'content-type': 'application/json' },
    body: JSON.stringify({ deviceId: 'device-a', acknowledgedRevision: 1, deviceProof: await deviceAcknowledgementProof(deviceSecrets.get('device-a'), 'device-a', 1) })
  }, runtime);
  assert.equal(prune.status, 409);
  assert.equal((await body(prune)).error, 'tombstones_retained');
  assert.equal((await body(await call('/api/sync', { headers: { authorization: `Bearer ${code}` } }, runtime))).state.sessions.gone.deleted, true);
});

test('pre-flag coordinator metadata remains an unacknowledged participant', async () => {
  const runtime = env();
  const coordinator = runtime.SYNC_COORDINATOR.get(await keyFor(code));
  await coordinator.storage.put('state', stateWith('gone', 'A', 'legacy-client'));
  await coordinator.storage.put('meta', { revision: 0, imported: true, revoked: false, devices: { 'legacy-client': 0 } });

  const deleted = stateWith('gone', 'A', 'device-a');
  deleted.sessions.gone.deleted = true;
  deleted.sessions.gone.deletedAt = Date.now();
  deleted.sessions.gone.updatedAt = Date.now() + 1;
  const deletePut = await call('/api/sync', {
    method: 'PUT', headers: { authorization: `Bearer ${code}`, 'content-type': 'application/json' },
    body: JSON.stringify(await protocol2('device-a', 0, deleted))
  }, runtime);
  assert.equal(deletePut.status, 200);

  const prune = await call('/api/sync/prune', {
    method: 'POST', headers: { authorization: `Bearer ${code}`, 'content-type': 'application/json' },
    body: JSON.stringify({ deviceId: 'device-a', acknowledgedRevision: 1, deviceProof: await deviceAcknowledgementProof(deviceSecrets.get('device-a'), 'device-a', 1) })
  }, runtime);
  assert.equal(prune.status, 409);
  assert.equal((await body(prune)).error, 'tombstones_retained');
});

test('retains tombstones until every known device acknowledges the deletion revision', async () => {
  const runtime = env();
  const initial = await call('/api/sync', {
    method: 'PUT', headers: { authorization: `Bearer ${code}`, 'content-type': 'application/json' },
    body: JSON.stringify(await protocol2('device-a', 0, stateWith('gone', 'A', 'device-a')))
  }, runtime);
  assert.equal(initial.status, 200);
  const state = stateWith('gone', 'A', 'device-b');
  state.sessions.gone.deleted = true;
  state.sessions.gone.deletedAt = Date.now();
  state.sessions.gone.deletedRevision = 0;
  state.sessions.gone.updatedAt = Date.now() + 1;
  const put = await call('/api/sync', {
    method: 'PUT', headers: { authorization: `Bearer ${code}`, 'content-type': 'application/json' },
    body: JSON.stringify(await protocol2('device-b', 1, state))
  }, runtime);
  assert.equal(put.status, 200);
  const forged = await call('/api/sync/prune', {
    method: 'POST', headers: { authorization: `Bearer ${code}`, 'content-type': 'application/json' },
    body: JSON.stringify({ deviceId: 'device-b', acknowledgedRevision: 2, deviceProof: await deviceAcknowledgementProof(deviceSecrets.get('device-a'), 'device-b', 2) })
  }, runtime);
  assert.equal(forged.status, 422);
  const blocked = await call('/api/sync/prune', {
    method: 'POST', headers: { authorization: `Bearer ${code}`, 'content-type': 'application/json' },
    body: JSON.stringify({ deviceId: 'device-a', acknowledgedRevision: 1, deviceProof: await deviceAcknowledgementProof(deviceSecrets.get('device-a'), 'device-a', 1) })
  }, runtime);
  assert.equal(blocked.status, 409);
  const acknowledgeDeviceB = await call('/api/sync', {
    method: 'PUT', headers: { authorization: `Bearer ${code}`, 'content-type': 'application/json' },
    body: JSON.stringify(await protocol2('device-b', 2, state))
  }, runtime);
  assert.equal(acknowledgeDeviceB.status, 200);
  const pruned = await call('/api/sync/prune', {
    method: 'POST', headers: { authorization: `Bearer ${code}`, 'content-type': 'application/json' },
    body: JSON.stringify({ deviceId: 'device-a', acknowledgedRevision: 2, deviceProof: await deviceAcknowledgementProof(deviceSecrets.get('device-a'), 'device-a', 2) })
  }, runtime);
  assert.equal(pruned.status, 200);
  const fetched = await call('/api/sync', { headers: { authorization: `Bearer ${code}` } }, runtime);
  assert.equal((await body(fetched)).state.sessions.gone, undefined);
});

test('legacy protocol writes block tombstone pruning until rotation', async () => {
  const runtime = env();
  const legacyPut = await call('/api/sync', {
    method: 'PUT', headers: { authorization: `Bearer ${code}`, 'content-type': 'application/json' },
    body: JSON.stringify({ state: stateWith('gone', 'A', 'legacy-device') })
  }, runtime);
  assert.equal(legacyPut.status, 200);

  const deleted = stateWith('gone', 'A', 'device-a');
  deleted.sessions.gone.deleted = true;
  deleted.sessions.gone.deletedAt = Date.now();
  deleted.sessions.gone.updatedAt = Date.now() + 1;
  const deletePut = await call('/api/sync', {
    method: 'PUT', headers: { authorization: `Bearer ${code}`, 'content-type': 'application/json' },
    body: JSON.stringify(await protocol2('device-a', 1, deleted))
  }, runtime);
  assert.equal(deletePut.status, 200);

  const acknowledged = await call('/api/sync', {
    method: 'PUT', headers: { authorization: `Bearer ${code}`, 'content-type': 'application/json' },
    body: JSON.stringify(await protocol2('device-a', 2, deleted, false))
  }, runtime);
  assert.equal(acknowledged.status, 200);
  const blocked = await call('/api/sync/prune', {
    method: 'POST', headers: { authorization: `Bearer ${code}`, 'content-type': 'application/json' },
    body: JSON.stringify({ deviceId: 'device-a', acknowledgedRevision: 2, deviceProof: await deviceAcknowledgementProof(deviceSecrets.get('device-a'), 'device-a', 2) })
  }, runtime);
  assert.equal(blocked.status, 409);
  assert.equal((await body(blocked)).error, 'tombstones_retained');
  const staleLegacyPut = await call('/api/sync', {
    method: 'PUT', headers: { authorization: `Bearer ${code}`, 'content-type': 'application/json' },
    body: JSON.stringify({ state: stateWith('gone', 'A', 'legacy-device') })
  }, runtime);
  assert.equal(staleLegacyPut.status, 200);
  assert.equal((await body(await call('/api/sync', { headers: { authorization: `Bearer ${code}` } }, runtime))).state.sessions.gone.deleted, true);

  const rotated = await call('/api/sync/rotate', { method: 'POST', headers: { authorization: `Bearer ${code}` } }, runtime);
  const replacement = await body(rotated);
  assert.equal(rotated.status, 200);
  const pruned = await call('/api/sync/prune', {
    method: 'POST', headers: { authorization: `Bearer ${replacement.code}`, 'content-type': 'application/json' },
    body: JSON.stringify({ deviceId: 'device-a', acknowledgedRevision: 2, deviceProof: await deviceAcknowledgementProof(deviceSecrets.get('device-a'), 'device-a', 2) })
  }, runtime);
  assert.equal(pruned.status, 200);
  assert.equal((await body(await call('/api/sync', { headers: { authorization: `Bearer ${replacement.code}` } }, runtime))).state.sessions.gone, undefined);
});

test('rate limits repeated sync requests without revealing bearer material', async () => {
  const runtime = env();
  let last;
  for (let i = 0; i < 61; i += 1) {
    last = await call('/api/sync', { headers: { 'cf-connecting-ip': '198.51.100.9' } }, runtime);
  }
  assert.equal(last.status, 429);
  assert.equal((await body(last)).error, 'rate_limited');
});

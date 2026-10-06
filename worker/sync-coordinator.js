import {
  emptyState,
  migrateState,
  mergeStates,
  stableStringify,
  validateState,
  stateStats,
  canPruneTombstones,
  MAX_DEVICES
} from '../src/lib/merge.js';

const CODE_RE = /^[A-Z2-7]{32}$/;
const DEVICE_RE = /^[A-Za-z0-9:_-]{1,128}$/;
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function response(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
  });
}

function codeFrom(request) {
  return request.headers.get('x-sync-code')?.toUpperCase() ?? null;
}

function withDevice(state, deviceId) {
  const stamp = (record) => {
    if (!record || record.writerId !== 'legacy') return record;
    return { ...record, writerId: deviceId, opId: `${deviceId}:${record.opId}`.slice(0, 256) };
  };
  return {
    ...state,
    sessions: Object.fromEntries(Object.entries(state.sessions).map(([id, record]) => [id, stamp(record)])),
    tests: Object.fromEntries(Object.entries(state.tests).map(([id, record]) => [id, stamp(record)])),
    program: stamp(state.program),
    settings: stamp(state.settings)
  };
}

function stampDeletionRevision(merged, current, incoming, revision) {
  const stampMap = (kind) => Object.fromEntries(Object.entries(merged[kind]).map(([id, record]) => {
    if (!record.deleted) return [id, record];
    const previous = current[kind]?.[id];
    const proposed = incoming[kind]?.[id];
    if (!previous?.deleted && proposed?.deleted) return [id, { ...record, deletedRevision: revision }];
    return [id, { ...record, deletedRevision: record.deletedRevision ?? previous?.deletedRevision ?? revision }];
  }));
  return { ...merged, sessions: stampMap('sessions'), tests: stampMap('tests') };
}

function generateCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((byte) => ALPHABET[byte % ALPHABET.length]).join('');
}
export class SyncCoordinator {
  constructor(state, env = {}) {
    this.storage = state.storage;
    this.env = env;
    this.queue = Promise.resolve();
  }

  fetch(request) {
    const run = this.queue.then(() => this.handle(request));
    this.queue = run.catch(() => {});
    return run;
  }

  async meta() {
    return (await this.storage.get('meta')) ?? {
      revision: 0,
      imported: false,
      revoked: false,
      devices: {},
      replacement: null,
      migrationError: null
    };
  }

  async load(request, meta) {
    const stored = await this.storage.get('state');
    if (stored) return migrateState(stored);
    if (!meta.imported && this.env.SYNC) {
      const key = request.headers.get('x-legacy-key');
      if (key) {
        const legacy = await this.env.SYNC.get(key, 'json');
        if (legacy) {
          try {
            const migrated = migrateState(legacy);
            await this.storage.put('state', migrated);
            await this.storage.put('meta', { ...meta, imported: true });
            return migrated;
          } catch (error) {
            await this.storage.put('meta', { ...meta, imported: true, migrationError: error.code ?? 'invalid_state' });
          }
        } else {
          await this.storage.put('meta', { ...meta, imported: true });
        }
      }
    }
    return emptyState();
  }

  async save(state, meta) {
    const validation = validateState(state);
    if (!validation.ok) return response({ error: validation.code }, validation.code === 'too_large' ? 413 : 422);
    await this.storage.put('state', state);
    await this.storage.put('meta', meta);
    return null;
  }

  async handle(request) {
    const url = new URL(request.url);
    const meta = await this.meta();
    const code = codeFrom(request);
    if (code && !CODE_RE.test(code)) return response({ error: 'invalid_code' }, 401);
    if (meta.revoked && url.pathname !== '/internal/export') return response({ error: 'revoked_code' }, 410);

    if (url.pathname === '/internal/prepare-rotation' && request.method === 'POST') {
      if (meta.replacement && CODE_RE.test(meta.replacement)) return response({ code: meta.replacement });
      const replacement = generateCode();
      await this.storage.put('meta', { ...meta, replacement });
      return response({ code: replacement });
    }

    if (url.pathname === '/internal/export' && request.method === 'GET') {
      const state = await this.load(request, meta);
      return response({ state, revision: meta.revision, replacement: meta.replacement });
    }
    if (url.pathname === '/internal/import' && request.method === 'PUT') {
      const body = await request.json().catch(() => null);
      if (!body?.state) return response({ error: 'invalid_state' }, 422);
      const state = migrateState(body.state);
      const result = await this.save(state, { ...meta, imported: true, revision: Math.max(meta.revision, Number(body.revision) || 0) });
      return result ?? response({ state, revision: Math.max(meta.revision, Number(body.revision) || 0) });
    }
    if (url.pathname === '/internal/revoke' && request.method === 'POST') {
      const body = await request.json().catch(() => null);
      const replacement = body?.replacement ?? meta.replacement;
      const next = { ...meta, revoked: true, replacement: replacement ?? null, devices: {} };
      await this.storage.put('meta', next);
      await this.storage.delete('state');
      return response({ ok: true, replacement });
    }
    if (url.pathname === '/internal/delete' && request.method === 'DELETE') {
      await this.storage.delete('state');
      await this.storage.put('meta', { ...meta, revoked: true, replacement: null, devices: {} });
      return response({ ok: true });
    }
    if (url.pathname === '/internal/prune' && request.method === 'POST') {
      const body = await request.json().catch(() => null);
      const deviceId = typeof body?.deviceId === 'string' ? body.deviceId.slice(0, 128) : '';
      const acknowledgedRevision = Number(body?.acknowledgedRevision);
      if (!deviceId || !Number.isInteger(acknowledgedRevision) || acknowledgedRevision < 0) return response({ error: 'invalid_acknowledgement' }, 422);
      const state = await this.load(request, meta);
      const devices = { ...meta.devices, [deviceId]: Math.max(Number(meta.devices[deviceId]) || 0, acknowledgedRevision) };
      if (!canPruneTombstones(state, devices)) return response({ error: 'tombstones_retained', revision: meta.revision }, 409);
      const pruned = {
        ...state,
        sessions: Object.fromEntries(Object.entries(state.sessions).filter(([, record]) => !record.deleted)),
        tests: Object.fromEntries(Object.entries(state.tests).filter(([, record]) => !record.deleted))
      };
      const revision = meta.revision + 1;
      const saved = await this.save(pruned, { ...meta, revision, devices });
      if (saved) return saved;
      return response({ protocol: 2, state: pruned, revision, stats: stateStats(pruned) });
    }

    if (request.method === 'GET') {
      const state = await this.load(request, meta);
      return response({ protocol: 2, state, revision: meta.revision, stats: stateStats(state) });
    }
    if (request.method !== 'PUT') return response({ error: 'method_not_allowed' }, 405);

    const body = await request.json().catch(() => null);
    if (!body || !body.state) return response({ error: 'invalid_state' }, 422);
    const protocol = body.protocol ?? 1;
    if (protocol > 2 || protocol < 1) return response({ error: 'unsupported_protocol' }, 426);
    if (protocol === 2 && (!DEVICE_RE.test(String(body.deviceId ?? '')) || !Number.isInteger(body.lastRevision) || body.lastRevision < 0)) return response({ error: 'invalid_state' }, 422);
    const validation = validateState(body.state);
    if (!validation.ok) return response({ error: validation.code }, validation.code === 'too_large' ? 413 : 422);
    const incoming = withDevice(migrateState(body.state), body.deviceId || 'legacy-client');
    const current = await this.load(request, meta);
    const mergedCandidate = mergeStates(current, incoming);
    const changed = stableStringify(mergedCandidate) !== stableStringify(current);
    const revision = changed ? meta.revision + 1 : meta.revision;
    const merged = stampDeletionRevision(mergedCandidate, current, incoming, revision);
    const deviceId = String(body.deviceId || 'legacy-client').slice(0, 128);
    const devices = { ...meta.devices, [deviceId]: revision };
    const deviceIds = Object.keys(devices);
    if (deviceIds.length > MAX_DEVICES) return response({ error: 'too_many_devices' }, 422);
    const nextMeta = { ...meta, imported: true, revision, devices };
    const saved = await this.save(merged, nextMeta);
    if (saved) return saved;
    return response({ protocol: 2, state: merged, revision, stats: stateStats(merged) });
  }
}

export { generateCode };

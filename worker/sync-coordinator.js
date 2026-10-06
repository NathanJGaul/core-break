import {
  emptyState,
  migrateState,
  mergeStates,
  stableStringify,
  validateState,
  stateStats,
  canPruneTombstones,
  verifyDeviceAcknowledgement,
  MAX_DEVICES
} from '../src/lib/merge.js';

const CODE_RE = /^[A-Z2-7]{32}$/;
const DEVICE_RE = /^[A-Za-z0-9:_-]{1,128}$/;
const DEVICE_SECRET_RE = /^[A-Za-z0-9_-]{43}$/;
const PROOF_RE = /^[A-Za-z0-9_-]{43}$/;
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

function normalizeDevices(devices) {
  if (!devices || typeof devices !== 'object' || Array.isArray(devices)) return {};
  return Object.fromEntries(Object.entries(devices)
    .filter(([deviceId]) => DEVICE_RE.test(deviceId))
    .map(([deviceId, entry]) => {
      if (Number.isInteger(entry) && entry >= 0) return [deviceId, { acknowledgedRevision: entry, secret: null }];
      const revision = Number.isInteger(entry?.acknowledgedRevision) && entry.acknowledgedRevision >= 0 ? entry.acknowledgedRevision : 0;
      const secret = DEVICE_SECRET_RE.test(entry?.secret ?? '') ? entry.secret : null;
      return [deviceId, { acknowledgedRevision: revision, secret }];
    }));
}

function acknowledgementMap(devices, legacyParticipant = false) {
  const acknowledgements = Object.fromEntries(Object.entries(devices).map(([deviceId, entry]) => [deviceId, entry.acknowledgedRevision]));
  if (legacyParticipant) acknowledgements['legacy-participant'] = -1;
  return acknowledgements;
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
    const stored = await this.storage.get('meta');
    const value = stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
    return {
      revision: Number.isInteger(value.revision) && value.revision >= 0 ? value.revision : 0,
      imported: Boolean(value.imported),
      revoked: Boolean(value.revoked),
      devices: normalizeDevices(value.devices),
      legacyParticipant: Boolean(value.legacyParticipant),
      replacement: value.replacement ?? null,
      migrationError: value.migrationError ?? null
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

  async clearLegacy(request) {
    const key = request.headers.get('x-legacy-key');
    if (this.env.SYNC && /^user:[a-f0-9]{64}$/.test(key ?? '')) await this.env.SYNC.delete(key);
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
      return response({ state, revision: meta.revision, replacement: meta.replacement, devices: meta.devices });
    }
    if (url.pathname === '/internal/import' && request.method === 'PUT') {
      const body = await request.json().catch(() => null);
      if (!body?.state) return response({ error: 'invalid_state' }, 422);
      const state = migrateState(body.state);
      const devices = normalizeDevices(body.devices);
      if (Object.keys(devices).length > MAX_DEVICES) return response({ error: 'too_many_devices' }, 422);
      const revision = Math.max(meta.revision, Number.isInteger(body.revision) && body.revision >= 0 ? body.revision : 0);
      const nextMeta = { ...meta, imported: true, revision, devices, legacyParticipant: false };
      const result = await this.save(state, nextMeta);
      return result ?? response({ state, revision, devices });
    }
    if (url.pathname === '/internal/revoke' && request.method === 'POST') {
      const body = await request.json().catch(() => null);
      const replacement = body?.replacement ?? meta.replacement;
      await this.clearLegacy(request);
      const next = { ...meta, revoked: true, replacement: replacement ?? null, devices: {}, legacyParticipant: false };
      await this.storage.put('meta', next);
      await this.storage.delete('state');
      return response({ ok: true, replacement });
    }
    if (url.pathname === '/internal/delete' && request.method === 'DELETE') {
      await this.clearLegacy(request);
      await this.storage.delete('state');
      await this.storage.put('meta', { ...meta, revoked: true, replacement: null, devices: {}, legacyParticipant: false });
      return response({ ok: true });
    }
    if (url.pathname === '/internal/prune' && request.method === 'POST') {
      const body = await request.json().catch(() => null);
      const deviceId = typeof body?.deviceId === 'string' ? body.deviceId : '';
      const acknowledgedRevision = body?.acknowledgedRevision;
      const proof = typeof body?.deviceProof === 'string' ? body.deviceProof : '';
      const entry = meta.devices[deviceId];
      if (!DEVICE_RE.test(deviceId) || !Number.isInteger(acknowledgedRevision) || acknowledgedRevision < 0 || acknowledgedRevision > meta.revision || !PROOF_RE.test(proof) || !entry?.secret || !await verifyDeviceAcknowledgement(entry.secret, deviceId, acknowledgedRevision, proof)) {
        return response({ error: 'invalid_acknowledgement' }, 422);
      }
      const state = await this.load(request, meta);
      if (Object.keys(meta.devices).length > MAX_DEVICES) return response({ error: 'too_many_devices' }, 422);
      const devices = { ...meta.devices, [deviceId]: { ...entry, acknowledgedRevision: Math.max(entry.acknowledgedRevision, acknowledgedRevision) } };
      if (!canPruneTombstones(state, acknowledgementMap(devices, meta.legacyParticipant))) return response({ error: 'tombstones_retained', revision: meta.revision }, 409);
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
    if (protocol === 2 && (!DEVICE_RE.test(String(body.deviceId ?? '')) || !Number.isInteger(body.lastRevision) || body.lastRevision < 0 || body.lastRevision > meta.revision || !PROOF_RE.test(String(body.deviceProof ?? '')))) return response({ error: 'invalid_acknowledgement' }, 422);
    const validation = validateState(body.state);
    if (!validation.ok) return response({ error: validation.code }, validation.code === 'too_large' ? 413 : 422);
    const incoming = withDevice(migrateState(body.state), body.deviceId || 'legacy-client');
    const current = await this.load(request, meta);
    let devices = meta.devices;
    if (protocol === 2) {
      const deviceId = body.deviceId;
      const existing = devices[deviceId];
      const secret = existing?.secret ?? body.deviceSecret;
      if (!DEVICE_SECRET_RE.test(secret ?? '') || !await verifyDeviceAcknowledgement(secret, deviceId, body.lastRevision, body.deviceProof)) return response({ error: 'invalid_acknowledgement' }, 422);
      devices = {
        ...devices,
        [deviceId]: {
          secret,
          acknowledgedRevision: Math.max(existing?.acknowledgedRevision ?? 0, body.lastRevision)
        }
      };
    }
    const mergedCandidate = mergeStates(current, incoming);
    const changed = stableStringify(mergedCandidate) !== stableStringify(current);
    const revision = changed ? meta.revision + 1 : meta.revision;
    const merged = stampDeletionRevision(mergedCandidate, current, incoming, revision);
    const deviceIds = Object.keys(devices);
    if (deviceIds.length > MAX_DEVICES) return response({ error: 'too_many_devices' }, 422);
    const nextMeta = { ...meta, imported: true, revision, devices, legacyParticipant: meta.legacyParticipant || protocol === 1 };
    const saved = await this.save(merged, nextMeta);
    if (saved) return saved;
    return response({ protocol: 2, state: merged, revision, stats: stateStats(merged) });
  }
}

export { generateCode };

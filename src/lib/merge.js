// Shared by the browser and Worker. Schema validation and deterministic merging
// live here so local adoption and server merge use the same contract.

export const SCHEMA_VERSION = 2;
export const MAX_STATE_BYTES = 1024 * 1024;
export const MAX_REQUEST_BYTES = 2 * 1024 * 1024;
export const MAX_RECORDS = 5000;
export const MAX_TOMBSTONES = 2000;
export const MAX_HISTORY = 100;
export const MAX_INTERVALS = 5;
export const MAX_DEVICES = 64;

const TEMPLATE_IDS = new Set(['A', 'B', 'C', 0, 1, 2]);
const FORM_VALUES = new Set(['clean', 'ok', 'shaky']);
const TEST_KINDS = new Set(['baseline', 'retest', 'block-end', 'extra']);
const EXERCISES = new Set(['hollow', 'deadbug', 'sideplank', 'bicycle', 'reverse']);
const SIDES = new Set(['left', 'right']);
const DECISIONS = new Set(['advance', 'repeat']);
const KEY_RE = /^[A-Za-z0-9_-]{1,96}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ID_RE = /^[A-Za-z0-9_-]{1,128}$/;

export function emptyState() {
  return {
    schema: SCHEMA_VERSION,
    sessions: {},
    tests: {},
    program: { updatedAt: 0, writerId: 'system', opId: 'empty-program', started: false, blockIndex: 0, blockStart: null, history: [] },
    settings: { updatedAt: 0, writerId: 'system', opId: 'empty-settings', sound: true, vibrate: true }
  };
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function finiteTimestamp(value) {
  return Number.isFinite(value) && value >= 0 && value <= 4102444800000;
}

function validDate(value) {
  if (value === null) return true;
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function validId(value, re = ID_RE) {
  return typeof value === 'string' && re.test(value);
}

function allowed(value, keys) {
  return isObject(value) && Object.keys(value).every((key) => keys.has(key));
}

function validMeta(record) {
  return isObject(record) && finiteTimestamp(record.updatedAt) &&
    validId(record.writerId ?? 'legacy', /^[A-Za-z0-9:_-]{1,256}$/) &&
    validId(record.opId ?? 'legacy', /^[A-Za-z0-9:_-]{1,256}$/);
}

function validInterval(interval) {
  if (!allowed(interval, new Set(['ex', 'side', 'pattern', 'work', 'done']))) return false;
  return EXERCISES.has(interval.ex) &&
    (interval.side === undefined || interval.side === null || SIDES.has(interval.side)) &&
    (interval.pattern === undefined || typeof interval.pattern === 'string' && interval.pattern.length <= 64) &&
    Number.isInteger(interval.work) && interval.work >= 1 && interval.work <= 60 &&
    typeof interval.done === 'boolean';
}

function validSession(record, id) {
  if (!allowed(record, new Set(['id', 'updatedAt', 'writerId', 'opId', 'deleted', 'deletedAt', 'deletedRevision', 'date', 'startedAt', 'endedAt', 'blockStart', 'block', 'template', 'intervals', 'form']))) return false;
  if (!validMeta(record) || record.id !== id || !validId(id)) return false;
  if (typeof record.deleted !== 'undefined' && typeof record.deleted !== 'boolean') return false;
  if (record.deleted && (!finiteTimestamp(record.deletedAt) || (record.deletedRevision !== undefined && (!Number.isInteger(record.deletedRevision) || record.deletedRevision < 0)))) return false;
  if (!validDate(record.date) || !validDate(record.blockStart)) return false;
  if (record.startedAt !== undefined && !finiteTimestamp(record.startedAt)) return false;
  if (record.endedAt !== undefined && !finiteTimestamp(record.endedAt)) return false;
  if (!Number.isInteger(record.block) || record.block < 0 || record.block > 1000) return false;
  if (!TEMPLATE_IDS.has(record.template) || !FORM_VALUES.has(record.form)) return false;
  return Array.isArray(record.intervals) && record.intervals.length === MAX_INTERVALS && record.intervals.every(validInterval);
}

function validTest(record, id) {
  if (!allowed(record, new Set(['id', 'updatedAt', 'writerId', 'opId', 'deleted', 'deletedAt', 'deletedRevision', 'at', 'date', 'seconds', 'kind', 'blockStart']))) return false;
  if (!validMeta(record) || record.id !== id || !validId(id)) return false;
  if (typeof record.deleted !== 'undefined' && typeof record.deleted !== 'boolean') return false;
  if (record.deleted && (!finiteTimestamp(record.deletedAt) || (record.deletedRevision !== undefined && (!Number.isInteger(record.deletedRevision) || record.deletedRevision < 0)))) return false;
  return finiteTimestamp(record.at) && validDate(record.date) &&
    Number.isFinite(record.seconds) && record.seconds >= 0 && record.seconds <= 3600 &&
    TEST_KINDS.has(record.kind) && validDate(record.blockStart);
}

function validProgram(program) {
  if (!allowed(program, new Set(['updatedAt', 'writerId', 'opId', 'started', 'blockIndex', 'blockStart', 'history']))) return false;
  if (!validMeta(program) || typeof program.started !== 'boolean' ||
      !Number.isInteger(program.blockIndex) || program.blockIndex < 0 || program.blockIndex > 1000 ||
      !validDate(program.blockStart) || !Array.isArray(program.history) || program.history.length > MAX_HISTORY) return false;
  return program.history.every((entry) =>
    allowed(entry, new Set(['blockIndex', 'start', 'end', 'decision'])) &&
    Number.isInteger(entry.blockIndex) && entry.blockIndex >= 0 && entry.blockIndex <= 1000 &&
    validDate(entry.start) && validDate(entry.end) && DECISIONS.has(entry.decision)
  );
}

function validSettings(settings) {
  return allowed(settings, new Set(['updatedAt', 'writerId', 'opId', 'sound', 'vibrate'])) &&
    validMeta(settings) && typeof settings.sound === 'boolean' && typeof settings.vibrate === 'boolean';
}

export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (isObject(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function encodeBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeBase64Url(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4));
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
}

export function createDeviceSecret() {
  return encodeBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

function acknowledgementMessage(deviceId, revision) {
  return `core-break:ack:v1:${deviceId}:${revision}`;
}

export async function deviceAcknowledgementProof(secret, deviceId, revision) {
  const keyBytes = decodeBase64Url(secret);
  if (!keyBytes || !Number.isInteger(revision) || revision < 0) throw new Error('invalid_acknowledgement');
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(acknowledgementMessage(deviceId, revision)));
  return encodeBase64Url(new Uint8Array(signature));
}

export async function verifyDeviceAcknowledgement(secret, deviceId, revision, proof) {
  const keyBytes = decodeBase64Url(secret);
  const signature = decodeBase64Url(proof);
  if (!keyBytes || !signature || signature.length !== 32 || !Number.isInteger(revision) || revision < 0) return false;
  try {
    const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    return await crypto.subtle.verify('HMAC', key, signature, new TextEncoder().encode(acknowledgementMessage(deviceId, revision)));
  } catch {
    return false;
  }
}

function legacyIdentity(record) {
  const canonical = stableStringify(record);
  const opId = [...canonical].map((char) => char.codePointAt(0).toString(16).padStart(2, '0')).join('').slice(0, 256);
  return { writerId: 'legacy', opId: opId || 'legacy-record' };
}

function migrateRecord(record, id) {
  if (!isObject(record)) return record;
  const identity = record.writerId && record.opId ? {} : legacyIdentity(record);
  return { ...record, id, ...identity };
}

function migrateMeta(record, fallback) {
  if (!isObject(record)) return record;
  const identity = record.writerId && record.opId ? {} : legacyIdentity(record);
  return { ...record, ...identity, ...(record.updatedAt === undefined ? { updatedAt: fallback.updatedAt } : {}) };
}

function migrateMap(map) {
  if (!isObject(map)) return {};
  return Object.fromEntries(Object.entries(map).map(([id, record]) => [id, migrateRecord(record, id)]));
}

export function migrateState(state) {
  if (!isObject(state)) throw Object.assign(new Error('State must be an object'), { code: 'invalid_state' });
  if (state.schema !== 1 && state.schema !== SCHEMA_VERSION) {
    throw Object.assign(new Error('Unsupported state schema'), { code: 'unsupported_schema' });
  }
  const migrated = {
    schema: SCHEMA_VERSION,
    sessions: migrateMap(state.sessions),
    tests: migrateMap(state.tests),
    program: migrateMeta(state.program ?? emptyState().program, emptyState().program),
    settings: migrateMeta(state.settings ?? emptyState().settings, emptyState().settings)
  };
  const result = validateState(migrated);
  if (!result.ok) throw Object.assign(new Error(result.code), { code: result.code });
  return migrated;
}

export function validateState(state, { maxBytes = MAX_STATE_BYTES } = {}) {
  if (!isObject(state)) return { ok: false, code: 'invalid_state' };
  let serialized;
  try { serialized = JSON.stringify(state); } catch { return { ok: false, code: 'invalid_state' }; }
  if (serialized.length > maxBytes) return { ok: false, code: 'too_large' };
  if (state.schema !== SCHEMA_VERSION && state.schema !== 1) return { ok: false, code: 'unsupported_schema' };
  if (!isObject(state.sessions) || !isObject(state.tests) || !isObject(state.program) || !isObject(state.settings)) return { ok: false, code: 'invalid_state' };
  const sessionEntries = Object.entries(state.sessions);
  const testEntries = Object.entries(state.tests);
  if (sessionEntries.length + testEntries.length > MAX_RECORDS) return { ok: false, code: 'too_many_records' };
  const tombstones = [...sessionEntries, ...testEntries].filter(([, record]) => record?.deleted).length;
  if (tombstones > MAX_TOMBSTONES) return { ok: false, code: 'too_many_tombstones' };
  if (!sessionEntries.every(([id, record]) => validSession(record, id)) || !testEntries.every(([id, record]) => validTest(record, id))) return { ok: false, code: 'invalid_state' };
  if (!validProgram(state.program) || !validSettings(state.settings)) return { ok: false, code: 'invalid_state' };
  return { ok: true };
}

export function isValidState(state) {
  return validateState(state).ok;
}

function compareRecords(a, b) {
  if (!a) return -1;
  if (!b) return 1;
  const aTime = a.updatedAt ?? 0;
  const bTime = b.updatedAt ?? 0;
  if (aTime !== bTime) return aTime > bTime ? 1 : -1;
  const aWriter = String(a.writerId ?? 'legacy');
  const bWriter = String(b.writerId ?? 'legacy');
  if (aWriter !== bWriter) return aWriter > bWriter ? 1 : -1;
  const aOp = String(a.opId ?? 'legacy');
  const bOp = String(b.opId ?? 'legacy');
  if (aOp !== bOp) return aOp > bOp ? 1 : -1;
  const aKey = stableStringify(a);
  const bKey = stableStringify(b);
  return aKey === bKey ? 0 : aKey > bKey ? 1 : -1;
}

function mergeRecords(a = {}, b = {}) {
  const out = { ...a };
  for (const [id, record] of Object.entries(b)) {
    if (!out[id] || compareRecords(record, out[id]) > 0) out[id] = record;
  }
  return out;
}

export function mergeStates(a, b) {
  const base = emptyState();
  let left = base;
  let right = base;
  try { left = migrateState(a ?? base); } catch {}
  try { right = migrateState(b ?? base); } catch {}
  return {
    schema: SCHEMA_VERSION,
    sessions: mergeRecords(left.sessions, right.sessions),
    tests: mergeRecords(left.tests, right.tests),
    program: compareRecords(left.program, right.program) >= 0 ? left.program : right.program,
    settings: compareRecords(left.settings, right.settings) >= 0 ? left.settings : right.settings
  };
}

export function stateStats(state) {
  const sessions = Object.values(state?.sessions ?? {});
  const tests = Object.values(state?.tests ?? {});
  return {
    sessions: sessions.filter((record) => !record.deleted).length,
    tests: tests.filter((record) => !record.deleted).length,
    tombstones: [...sessions, ...tests].filter((record) => record.deleted).length,
    bytes: JSON.stringify(state ?? {}).length
  };
}

export function canPruneTombstones(state, acknowledgements = {}) {
  const devices = Object.keys(acknowledgements);
  if (!devices.length) return false;
  const minimumRevision = Math.min(...devices.map((device) => Number(acknowledgements[device]) || 0));
  return Object.values(state?.sessions ?? {}).concat(Object.values(state?.tests ?? {})).every((record) => {
    if (!record.deleted) return true;
    return Number.isInteger(record.deletedRevision) && record.deletedRevision >= 0 && record.deletedRevision <= minimumRevision;
  });
}

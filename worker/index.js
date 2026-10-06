import { validateState, MAX_REQUEST_BYTES } from '../src/lib/merge.js';
import { SyncCoordinator } from './sync-coordinator.js';

const CODE_RE = /^[A-Z2-7]{32}$/;
const VERSION = '2.0.0';
const DEVICE_RE = /^[A-Za-z0-9:_-]{1,128}$/;
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 60;
const rateBuckets = new Map();

function requestId() {
  return crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function baseHeaders(id, env) {
  return {
    'content-type': 'application/json',
    'cache-control': 'no-store',
    'x-request-id': id,
    'x-core-break-version': env.VERSION ?? VERSION,
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'permissions-policy': 'camera=(), microphone=(), geolocation=()',
    'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'"
  };
}

function json(body, status = 200, id = requestId(), env = {}) {
  return new Response(JSON.stringify(body), { status, headers: baseHeaders(id, env) });
}

async function keyFor(code) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code));
  const hex = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `user:${hex}`;
}

function readCode(request) {
  const auth = request.headers.get('authorization') ?? '';
  const code = auth.replace(/^Bearer\s+/i, '').replace(/[\s-]/g, '').toUpperCase();
  return CODE_RE.test(code) ? code : null;
}

function allowSyncRequest(request) {
  const key = request.headers.get('cf-connecting-ip') ?? 'anonymous';
  const now = Date.now();
  const current = rateBuckets.get(key);
  if (!current || now - current.startedAt >= RATE_WINDOW_MS) {
    if (rateBuckets.size >= 2048) rateBuckets.delete(rateBuckets.keys().next().value);
    rateBuckets.set(key, { startedAt: now, count: 1 });
    return true;
  }
  current.count += 1;
  return current.count <= RATE_LIMIT;
}

function coordinator(env, name) {
  if (!env.SYNC_COORDINATOR) return null;
  const id = env.SYNC_COORDINATOR.idFromName(name);
  return env.SYNC_COORDINATOR.get(id);
}

async function parseBody(request) {
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength > MAX_REQUEST_BYTES) return { error: 'too_large', status: 413 };
  try {
    return { body: JSON.parse(new TextDecoder().decode(bytes)) };
  } catch {
    return { error: 'invalid_json', status: 400 };
  }
}

function byteBucket(request) {
  const raw = request.headers.get('content-length');
  if (!raw) return 'unknown';
  const bytes = Number(raw);
  if (!Number.isFinite(bytes)) return 'unknown';
  if (bytes < 1024) return 'small';
  if (bytes < 64 * 1024) return 'medium';
  if (bytes < 1024 * 1024) return 'large';
  return 'oversized';
}

function statusError(status) {
  if (status < 400) return null;
  if (status === 401) return 'invalid_code';
  if (status === 410) return 'revoked_code';
  if (status === 413) return 'too_large';
  if (status === 429) return 'rate_limited';
  if (status >= 500) return 'internal_error';
  return 'request_error';
}

async function forward(env, code, path, method, body, requestIdValue) {
  const key = await keyFor(code);
  const target = coordinator(env, key);
  if (!target) return json({ error: 'storage_unavailable' }, 503, requestIdValue, env);
  const headers = {
    'x-sync-code': code,
    'x-legacy-key': await keyFor(code),
    'x-request-id': requestIdValue
  };
  if (body !== undefined) headers['content-type'] = 'application/json';
  const response = await target.fetch(new Request(`https://coordinator.internal${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  }));
  const result = await response.json().catch(() => ({ error: 'storage_unavailable' }));
  return json(result, response.status, requestIdValue, env);
}

async function handleSync(request, env, id) {
  const code = readCode(request);
  if (!code) return json({ error: 'invalid_code' }, 401, id, env);
  const key = await keyFor(code);
  if (!coordinator(env, key)) return json({ error: 'storage_unavailable' }, 503, id, env);
  if (request.method === 'GET') return forward(env, code, '/api/sync', 'GET', undefined, id);
  if (request.method === 'DELETE') return forward(env, code, '/internal/delete', 'DELETE', undefined, id);
  if (request.method !== 'PUT') return json({ error: 'method_not_allowed' }, 405, id, env);

  const parsed = await parseBody(request);
  if (parsed.error) return json({ error: parsed.error }, parsed.status, id, env);
  const body = parsed.body;
  const protocol = body?.protocol ?? 1;
  if (!Number.isInteger(protocol) || protocol < 1 || protocol > 2) return json({ error: 'unsupported_protocol' }, 426, id, env);
  if (protocol === 2 && (!DEVICE_RE.test(String(body?.deviceId ?? '')) || !Number.isInteger(body?.lastRevision) || body.lastRevision < 0)) return json({ error: 'invalid_state' }, 422, id, env);
  if (!body?.state) return json({ error: 'invalid_state' }, 422, id, env);
  const validation = validateState(body.state);
  if (!validation.ok) return json({ error: validation.code }, validation.code === 'too_large' ? 413 : 422, id, env);
  return forward(env, code, '/api/sync', 'PUT', { ...body, protocol }, id);
}

async function handleRotate(request, env, id) {
  const code = readCode(request);
  if (!code) return json({ error: 'invalid_code' }, 401, id, env);
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, id, env);
  const legacyKey = await keyFor(code);
  const oldCoordinator = coordinator(env, legacyKey);
  if (!oldCoordinator) return json({ error: 'storage_unavailable' }, 503, id, env);
  const preparedResponse = await oldCoordinator.fetch(new Request('https://coordinator.internal/internal/prepare-rotation', {
    method: 'POST', headers: { 'x-sync-code': code }
  }));
  const prepared = await preparedResponse.json().catch(() => null);
  if (!preparedResponse.ok || !CODE_RE.test(prepared?.code ?? '')) return json({ error: 'rotation_failed' }, preparedResponse.status || 503, id, env);
  const replacement = prepared.code;
  const exportedResponse = await oldCoordinator.fetch(new Request('https://coordinator.internal/internal/export', {
    headers: { 'x-sync-code': code, 'x-legacy-key': legacyKey }
  }));
  const exported = await exportedResponse.json().catch(() => null);
  if (!exportedResponse.ok) return json({ error: exported?.error ?? 'rotation_failed' }, exportedResponse.status, id, env);
  const newCoordinator = coordinator(env, await keyFor(replacement));
  const imported = await newCoordinator.fetch(new Request('https://coordinator.internal/internal/import', {
    method: 'PUT',
    headers: { 'content-type': 'application/json', 'x-sync-code': replacement },
    body: JSON.stringify({ state: exported.state, revision: exported.revision })
  }));
  if (!imported.ok) return json({ error: 'rotation_failed' }, 503, id, env);
  const revoked = await oldCoordinator.fetch(new Request('https://coordinator.internal/internal/revoke', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-sync-code': code },
    body: JSON.stringify({ replacement })
  }));
  if (!revoked.ok) return json({ error: 'rotation_failed' }, 503, id, env);
  return json({ code: replacement }, 200, id, env);
}

async function handlePrune(request, env, id) {
  const code = readCode(request);
  if (!code) return json({ error: 'invalid_code' }, 401, id, env);
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, id, env);
  const parsed = await parseBody(request);
  if (parsed.error) return json({ error: parsed.error }, parsed.status, id, env);
  if (!parsed.body?.deviceId || !Number.isInteger(Number(parsed.body.acknowledgedRevision))) return json({ error: 'invalid_acknowledgement' }, 422, id, env);
  return forward(env, code, '/internal/prune', 'POST', parsed.body, id);
}

async function health(env, id) {
  const ready = Boolean(env.SYNC_COORDINATOR && env.SYNC);
  return json({
    status: ready ? 'ok' : 'degraded',
    version: env.VERSION ?? VERSION,
    environment: env.ENVIRONMENT ?? 'unknown',
    storageMode: 'durable-object',
    bindings: { sync: Boolean(env.SYNC), coordinator: Boolean(env.SYNC_COORDINATOR), assets: Boolean(env.ASSETS) }
  }, ready ? 200 : 503, id, env);
}

export default {
  async fetch(request, env) {
    const id = requestId();
    const started = Date.now();
    const url = new URL(request.url);
    let response;
    try {
      if (url.pathname.startsWith('/api/sync') && !allowSyncRequest(request)) response = json({ error: 'rate_limited' }, 429, id, env);
      else if (url.pathname === '/api/health' && request.method === 'GET') response = await health(env, id);
      else if (url.pathname === '/api/sync/rotate') response = await handleRotate(request, env, id);
      else if (url.pathname === '/api/sync/prune') response = await handlePrune(request, env, id);
      else if (url.pathname === '/api/sync') response = await handleSync(request, env, id);
      else if (url.pathname.startsWith('/api/')) response = json({ error: 'not_found' }, 404, id, env);
      else response = await env.ASSETS.fetch(request);
    } catch {
      response = json({ error: 'internal_error' }, 500, id, env);
    } finally {
      console.log(JSON.stringify({
        requestId: id,
        environment: env.ENVIRONMENT ?? 'unknown',
        route: url.pathname.startsWith('/api/') ? url.pathname : '/asset',
        method: request.method,
        status: response?.status ?? 500,
        durationMs: Date.now() - started,
        payloadBucket: byteBucket(request),
        countBucket: 'unknown',
        revision: 'unknown',
        migrationMode: url.pathname.startsWith('/api/sync') ? 'legacy-compatible' : 'none',
        errorCode: statusError(response?.status ?? 500)
      }));
    }
    return response;
  }
};

export { keyFor, readCode, SyncCoordinator };

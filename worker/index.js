import { mergeStates, isValidState } from '../src/lib/merge.js';

const MAX_BYTES = 10 * 1024 * 1024;
const CODE_RE = /^[A-Z2-7]{32}$/;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
  });
}

async function keyFor(code) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code));
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `user:${hex}`;
}

function readCode(request) {
  const auth = request.headers.get('authorization') ?? '';
  const code = auth.replace(/^Bearer\s+/i, '').replace(/[\s-]/g, '').toUpperCase();
  return CODE_RE.test(code) ? code : null;
}

async function handleSync(request, env) {
  if (!env.SYNC) return json({ error: 'Sync storage is not set up. Add the SYNC KV binding in wrangler.jsonc.' }, 500);

  const code = readCode(request);
  if (!code) return json({ error: 'Missing or malformed sync code.' }, 401);
  const key = await keyFor(code);

  if (request.method === 'GET') {
    const stored = await env.SYNC.get(key, 'json');
    return json({ state: stored ?? null });
  }

  if (request.method === 'PUT') {
    const length = Number(request.headers.get('content-length') ?? 0);
    if (length > MAX_BYTES) return json({ error: 'Data too large.' }, 413);

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Body must be JSON.' }, 400);
    }
    if (!isValidState(body?.state)) return json({ error: 'Body must contain a valid state.' }, 400);

    const stored = await env.SYNC.get(key, 'json');
    const merged = mergeStates(stored, body.state);
    const serialized = JSON.stringify(merged);
    if (serialized.length > MAX_BYTES) return json({ error: 'Data too large.' }, 413);

    // Skip the write when nothing changed (KV free tier allows 1,000 writes a day).
    if (!stored || JSON.stringify(stored) !== serialized) await env.SYNC.put(key, serialized);
    return json({ state: merged });
  }

  return json({ error: 'Method not allowed.' }, 405);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/sync') return handleSync(request, env);
    if (url.pathname.startsWith('/api/')) return json({ error: 'Not found.' }, 404);
    return env.ASSETS.fetch(request);
  }
};

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const script = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');

function serviceWorkerHarness() {
  const listeners = new Map();
  const cacheValues = new Map();
  const cacheNames = new Set(['core-break-old']);
  const messages = [];
  let skipped = false;
  let claimed = false;
  let network = async () => new Response('network', { status: 200 });

  const caches = {
    async keys() { return [...cacheNames]; },
    async delete(name) { cacheNames.delete(name); return true; },
    async open(name) {
      cacheNames.add(name);
      return {
        async put(request, response) {
          cacheValues.set(request.url, response);
        }
      };
    },
    async match(request) {
      return cacheValues.get(request.url) ?? undefined;
    }
  };
  const clients = {
    async claim() { claimed = true; },
    async matchAll() { return [{ postMessage(message) { messages.push(message); } }]; }
  };
  const self = {
    clients,
    addEventListener(type, handler) { listeners.set(type, handler); },
    skipWaiting() { skipped = true; }
  };
  const context = {
    self,
    caches,
    fetch: (...args) => network(...args),
    location: { origin: 'https://app.test' },
    URL,
    Request,
    Response,
    Promise,
    console
  };
  vm.runInNewContext(script, context, { filename: 'public/sw.js' });
  return {
    listeners,
    caches,
    messages,
    get skipped() { return skipped; },
    get claimed() { return claimed; },
    set network(value) { network = value; }
  };
}

test('service worker activates the current cache and announces updates', async () => {
  const worker = serviceWorkerHarness();
  worker.listeners.get('install')();
  assert.equal(worker.skipped, true);
  let activation;
  worker.listeners.get('activate')({ waitUntil(value) { activation = value; } });
  await activation;
  assert.equal(worker.claimed, true);
  assert.equal(worker.messages[0].type, 'core-break-update');
  assert.equal(worker.messages[0].cache, 'core-break-v2.0.0');
  assert.deepEqual(await worker.caches.keys(), []);
});

test('service worker caches successful app requests, serves offline, and bypasses sync API', async () => {
  const worker = serviceWorkerHarness();
  let networkCalls = 0;
  worker.network = async (request) => {
    networkCalls += 1;
    return new Response(request.url.endsWith('/') ? 'fresh shell' : 'api response', { status: 200 });
  };
  const appEvent = {
    request: { url: 'https://app.test/', method: 'GET', mode: 'navigate' },
    respondWith(value) { this.response = value; }
  };
  worker.listeners.get('fetch')(appEvent);
  assert.equal(await (await appEvent.response).text(), 'fresh shell');
  await new Promise((resolve) => setImmediate(resolve));

  worker.network = async () => { throw new Error('offline'); };
  const offlineEvent = {
    request: { url: 'https://app.test/', method: 'GET', mode: 'navigate' },
    respondWith(value) { this.response = value; }
  };
  worker.listeners.get('fetch')(offlineEvent);
  assert.equal(await (await offlineEvent.response).text(), 'fresh shell');

  const apiEvent = {
    request: { url: 'https://app.test/api/sync', method: 'GET', mode: 'same-origin' },
    respondWith() { throw new Error('API must not be intercepted'); }
  };
  worker.listeners.get('fetch')(apiEvent);
  assert.equal(networkCalls, 1);
});

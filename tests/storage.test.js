import test from 'node:test';
import assert from 'node:assert/strict';
import { readItem, writeItem } from '../src/lib/storage.js';

class FakeStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

class FailingStorage {
  getItem() { throw new Error('quota'); }
  setItem() { throw new Error('quota'); }
  removeItem() { throw new Error('quota'); }
}

test('local storage helper round-trips JSON and returns failure instead of hiding quota errors', () => {
  const storage = new FakeStorage();
  assert.equal(writeItem(storage, 'data', JSON.stringify({ ok: true })), true);
  assert.deepEqual(JSON.parse(readItem(storage, 'data')), { ok: true });
  assert.equal(writeItem(storage, 'data', null), true);
  assert.equal(readItem(storage, 'data'), null);
  assert.equal(writeItem(new FailingStorage(), 'data', '{}'), false);
  assert.equal(readItem(new FailingStorage(), 'data'), null);
});

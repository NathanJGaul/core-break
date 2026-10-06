import test from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyState,
  migrateState,
  validateState,
  mergeStates,
  isValidState,
  MAX_STATE_BYTES,
  MAX_RECORDS
} from '../src/lib/merge.js';

test('migrates valid schema 1 state and preserves records without fabrication', () => {
  const migrated = migrateState({
    schema: 1,
    sessions: { s1: { id: 's1', date: '2026-10-06', blockStart: '2026-10-01', template: 'A', block: 0, form: 'clean', intervals: Array.from({ length: 5 }, () => ({ ex: 'hollow', work: 20, done: true })), updatedAt: 10 } },
    tests: {},
    program: { updatedAt: 10, started: true, blockIndex: 1, blockStart: '2026-10-01', history: [] },
    settings: { updatedAt: 10, sound: true, vibrate: false }
  });
  assert.equal(migrated.schema, 2);
  assert.equal(migrated.sessions.s1.id, 's1');
  assert.equal(migrated.sessions.fake, undefined);
  assert.equal(validateState(migrated).ok, true);
});

test('rejects malformed nested records, unknown schema, and bounds', () => {
  assert.equal(validateState({ ...emptyState(), schema: 99 }).code, 'unsupported_schema');
  assert.equal(validateState({ ...emptyState(), sessions: { x: { id: 'x', date: 'not-a-date' } } }).code, 'invalid_state');
  const tooMany = Object.fromEntries(Array.from({ length: MAX_RECORDS + 1 }, (_, i) => [`s${i}`, { id: `s${i}` }]));
  assert.equal(validateState({ ...emptyState(), sessions: tooMany }).code, 'too_many_records');
  assert.equal(validateState({ ...emptyState(), sessions: { s: { id: 's', date: '2026-10-06', blockStart: '2026-10-01', template: 0, block: 0, form: 'full', intervals: [], updatedAt: 1, note: 'x'.repeat(MAX_STATE_BYTES) } } }).code, 'too_large');
  assert.equal(isValidState({ ...emptyState(), sessions: { broken: null } }), false);
});

test('equal timestamps use writer and operation identity regardless of argument order', () => {
  const left = { ...emptyState(), sessions: { s: { id: 's', date: '2026-10-06', blockStart: '2026-10-01', template: 'A', block: 0, form: 'clean', intervals: Array.from({ length: 5 }, () => ({ ex: 'hollow', work: 20, done: true })), updatedAt: 100, writerId: 'writer-b', opId: 'op-2' } } };
  const right = { ...emptyState(), sessions: { s: { id: 's', date: '2026-10-06', blockStart: '2026-10-01', template: 'B', block: 0, form: 'clean', intervals: Array.from({ length: 5 }, () => ({ ex: 'hollow', work: 20, done: true })), updatedAt: 100, writerId: 'writer-a', opId: 'op-1' } } };
  assert.deepEqual(mergeStates(left, right).sessions.s, mergeStates(right, left).sessions.s);
  assert.equal(mergeStates(left, right).sessions.s.template, 'A');
});

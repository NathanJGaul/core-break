import test from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyState,
  migrateState,
  validateState,
  mergeStates,
  isValidState,
  canPruneTombstones,
  reconcilePrunedState,
  MAX_STATE_BYTES,
  MAX_RECORDS
} from '../src/lib/merge.js';

function nearLimitState(prefix) {
  const state = emptyState();
  for (let index = 0; index < 1100; index += 1) {
    const id = `${prefix}${index}`;
    state.sessions[id] = {
      id,
      updatedAt: 1,
      writerId: 'legacy',
      opId: 'o',
      date: '2026-10-06',
      blockStart: '2026-10-01',
      template: 'A',
      block: 0,
      form: 'clean',
      intervals: Array.from({ length: 5 }, () => ({ ex: 'hollow', work: 20, done: true, pattern: 'x'.repeat(20) }))
    };
  }
  return state;
}

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

test('tombstone pruning never treats missing or negative revisions as acknowledged', () => {
  const state = emptyState();
  state.sessions.deleted = { id: 'deleted', updatedAt: 1, writerId: 'writer-a', opId: 'delete-1', deleted: true, deletedAt: 1, date: '2026-10-06', blockStart: '2026-10-01', template: 'A', block: 0, form: 'clean', intervals: Array.from({ length: 5 }, () => ({ ex: 'hollow', work: 20, done: true })) };
  assert.equal(canPruneTombstones(state, { 'device-a': 10 }), false);
  state.sessions.deleted.deletedRevision = -1;
  assert.equal(validateState(state).ok, false);
  assert.equal(canPruneTombstones(state, { 'device-a': 10 }), false);
});

test('pruned tombstones reject newer offline copies of deleted records', () => {
  const tombstone = {
    id: 's1',
    updatedAt: 10,
    writerId: 'device-a',
    opId: 'delete-s1',
    deleted: true,
    deletedAt: 10,
    deletedRevision: 1,
    date: '2026-10-06',
    blockStart: '2026-10-01',
    template: 'A',
    block: 0,
    form: 'clean',
    intervals: Array.from({ length: 5 }, () => ({ ex: 'hollow', work: 20, done: true }))
  };
  const offlineCopy = { ...tombstone, updatedAt: 11, writerId: 'device-b', opId: 'offline-s1', deleted: false };
  const reconciled = reconcilePrunedState(
    { ...emptyState(), sessions: { [offlineCopy.id]: offlineCopy } },
    { sessions: { [tombstone.id]: tombstone }, tests: {} }
  );
  assert.equal(reconciled.sessions.s1, undefined);
});

test('equal timestamps use writer and operation identity regardless of argument order', () => {
  const left = { ...emptyState(), sessions: { s: { id: 's', date: '2026-10-06', blockStart: '2026-10-01', template: 'A', block: 0, form: 'clean', intervals: Array.from({ length: 5 }, () => ({ ex: 'hollow', work: 20, done: true })), updatedAt: 100, writerId: 'writer-b', opId: 'op-2' } } };
  const right = { ...emptyState(), sessions: { s: { id: 's', date: '2026-10-06', blockStart: '2026-10-01', template: 'B', block: 0, form: 'clean', intervals: Array.from({ length: 5 }, () => ({ ex: 'hollow', work: 20, done: true })), updatedAt: 100, writerId: 'writer-a', opId: 'op-1' } } };
  assert.deepEqual(mergeStates(left, right).sessions.s, mergeStates(right, left).sessions.s);
  assert.equal(mergeStates(left, right).sessions.s.template, 'A');
});

test('rejects a merged state that exceeds the size bound', () => {
  assert.throws(() => mergeStates(nearLimitState('a'), nearLimitState('b')), { code: 'too_large' });
});

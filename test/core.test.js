import assert from 'node:assert/strict';
import test from 'node:test';

import { addDays, daysBetween, weekStart } from '../src/lib/dates.js';
import { emptyState, isValidState, mergeStates } from '../src/lib/merge.js';
import { buildIntervals, getBlock } from '../src/lib/program.js';
import { blockStatus, nextTemplateIndex, sessionsByDate, streak, weeklyPatternSets } from '../src/lib/stats.js';

test('date helpers handle calendar boundaries and Monday weeks', () => {
  assert.equal(addDays('2024-02-28', 1), '2024-02-29');
  assert.equal(daysBetween('2024-02-28', '2024-03-01'), 2);
  assert.equal(weekStart('2024-01-07'), '2024-01-01');
});

test('buildIntervals expands a template with the selected block settings', () => {
  const intervals = buildIntervals(1, 0);

  assert.deepEqual(intervals.map((interval) => interval.ex), ['deadbug', 'bicycle', 'sideplank', 'sideplank', 'deadbug']);
  assert.deepEqual(intervals.slice(2, 4).map((interval) => interval.side), ['left', 'right']);
  assert.ok(intervals.every((interval) => interval.work === 20 && interval.rest === 40));
  assert.ok(intervals.every((interval) => interval.cues.length > 0));
  assert.equal(getBlock(5).level, 'tempo');
});

test('mergeStates keeps the newest record from either device', () => {
  const left = emptyState();
  const right = emptyState();
  left.sessions.keep = { id: 'keep', updatedAt: 1, value: 'left' };
  left.sessions.replace = { id: 'replace', updatedAt: 2, value: 'old' };
  right.sessions.replace = { id: 'replace', updatedAt: 3, value: 'new' };
  right.sessions.remote = { id: 'remote', updatedAt: 1, value: 'right' };

  const merged = mergeStates(left, right);

  assert.equal(merged.sessions.keep.value, 'left');
  assert.equal(merged.sessions.replace.value, 'new');
  assert.equal(merged.sessions.remote.value, 'right');
  assert.ok(isValidState(merged));
  assert.equal(isValidState({}), false);
});

test('stats count active sessions, weekly sets, and consecutive days', () => {
  const data = emptyState();
  data.sessions = {
    first: {
      id: 'first',
      startedAt: 1,
      date: '2024-01-01',
      intervals: [{ done: true, pattern: 'antiExtension' }, { done: true, pattern: 'flexion' }]
    },
    second: {
      id: 'second',
      startedAt: 2,
      date: '2024-01-02',
      intervals: [{ done: true, pattern: 'antiLateral' }, { done: false, pattern: 'flexion' }]
    },
    deleted: { id: 'deleted', startedAt: 3, date: '2024-01-03', deleted: true, intervals: [] }
  };

  assert.deepEqual([...sessionsByDate(data).entries()], [['2024-01-01', 1], ['2024-01-02', 1]]);
  assert.equal(streak(data, '2024-01-02'), 2);
  assert.deepEqual(weeklyPatternSets(data, '2024-01-01'), { antiExtension: 1, antiLateral: 1, flexion: 1 });
  assert.equal(nextTemplateIndex(data), 2);
});

test('blockStatus recommends advancing a completed, consistent block', () => {
  const data = emptyState();
  data.program = { ...data.program, started: true, blockStart: '2024-01-01' };
  data.tests = {
    baseline: { id: 'baseline', at: 1, date: '2024-01-01', seconds: 30, kind: 'baseline' },
    end: { id: 'end', at: 2, date: '2024-01-29', seconds: 40, kind: 'block-end', blockStart: '2024-01-01' }
  };
  for (let i = 0; i < 12; i++) {
    const id = `session-${i}`;
    data.sessions[id] = { id, startedAt: i, date: addDays('2024-01-01', i), form: 'clean', intervals: [] };
  }

  const status = blockStatus(data, '2024-01-29');

  assert.equal(status.complete, true);
  assert.equal(status.sessionCount, 12);
  assert.equal(status.recommendation, 'advance');
  assert.match(status.reasons.join(' '), /improved from 30\.0s to 40\.0s/);
});

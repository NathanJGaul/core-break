import assert from 'node:assert/strict';

import { EXERCISES, TEMPLATES, buildIntervals } from '../src/lib/program.js';
import { emptyState, isValidState } from '../src/lib/merge.js';

const levels = ['easy', 'standard', 'tempo', 'leverage'];

for (const [id, exercise] of Object.entries(EXERCISES)) {
  assert.ok(exercise.name, `${id} needs a name`);
  assert.ok(exercise.pattern, `${id} needs a pattern`);
  for (const level of levels) {
    const version = exercise.versions[level];
    assert.ok(version?.label, `${id} needs a ${level} label`);
    assert.ok(version?.cues?.length, `${id} needs ${level} cues`);
  }
}

assert.ok(TEMPLATES.length > 0, 'template catalog must not be empty');

for (const [templateIndex, template] of TEMPLATES.entries()) {
  assert.equal(template.intervals.length, 5, `template ${template.id} must have five intervals`);
  const sidePlanks = template.intervals.filter((interval) => interval.ex === 'sideplank');
  if (sidePlanks.length) {
    assert.deepEqual(sidePlanks.map((interval) => interval.side), ['left', 'right'], `template ${template.id} needs both sides`);
  }

  for (const blockIndex of [0, 1, 2, 3, 4, 5, 6]) {
    const intervals = buildIntervals(templateIndex, blockIndex);
    assert.ok(intervals.every((interval) => interval.work > 0 && interval.rest >= 0));
    assert.ok(intervals.every((interval) => interval.name && interval.label && interval.cues.length));
  }
}

assert.ok(isValidState(emptyState()), 'emptyState must be accepted by the sync boundary');
console.log('Core Break checks passed.');

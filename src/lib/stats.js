import { getBlock, BLOCK_DAYS, TEMPLATES } from './program.js';
import { localDate, addDays, daysBetween, weekStart } from './dates.js';

export function activeSessions(data) {
  return Object.values(data.sessions)
    .filter((s) => !s.deleted && Array.isArray(s.intervals) && s.date)
    .sort((a, b) => a.startedAt - b.startedAt);
}

export function activeTests(data) {
  return Object.values(data.tests)
    .filter((t) => !t.deleted && typeof t.seconds === 'number')
    .sort((a, b) => a.at - b.at);
}

export function nextTemplateIndex(data) {
  return activeSessions(data).length % TEMPLATES.length;
}

export function sessionsByDate(data) {
  const map = new Map();
  for (const s of activeSessions(data)) map.set(s.date, (map.get(s.date) ?? 0) + 1);
  return map;
}

/** Consecutive days with at least one session, ending today (or yesterday if today has none yet). */
export function streak(data, today = localDate()) {
  const byDate = sessionsByDate(data);
  let day = byDate.has(today) ? today : addDays(today, -1);
  let count = 0;
  while (byDate.has(day)) {
    count++;
    day = addDays(day, -1);
  }
  return count;
}

export function weeklyPatternSets(data, start = weekStart(localDate())) {
  const end = addDays(start, 7);
  const sets = { antiExtension: 0, antiLateral: 0, flexion: 0 };
  for (const s of activeSessions(data)) {
    if (s.date < start || s.date >= end) continue;
    for (const it of s.intervals) if (it.done && sets[it.pattern] !== undefined) sets[it.pattern]++;
  }
  return sets;
}

export function blockStatus(data, today = localDate()) {
  const p = data.program;
  const block = getBlock(p.blockIndex);
  const day = daysBetween(p.blockStart, today) + 1; // 1-based
  const tests = activeTests(data);

  const startTest = [...tests].reverse().find((t) => t.date <= p.blockStart) ?? null;
  const endTest = [...tests].reverse().find((t) => t.kind === 'block-end' && t.blockStart === p.blockStart) ?? null;

  const inBlock = activeSessions(data).filter((s) => s.date >= p.blockStart);
  const rated = inBlock.filter((s) => s.form);
  const shakyRate = rated.length ? rated.filter((s) => s.form === 'shaky').length / rated.length : 0;

  const complete = day > BLOCK_DAYS;
  let recommendation = null;
  const reasons = [];
  if (complete && endTest) {
    const improved = startTest ? endTest.seconds > startTest.seconds : true;
    const formOk = shakyRate < 0.3;
    if (startTest) {
      reasons.push(
        improved
          ? `Your hold improved from ${startTest.seconds.toFixed(1)}s to ${endTest.seconds.toFixed(1)}s.`
          : `Your hold went from ${startTest.seconds.toFixed(1)}s to ${endTest.seconds.toFixed(1)}s, with no improvement.`
      );
    }
    reasons.push(
      formOk
        ? `You rated ${Math.round(shakyRate * 100)}% of sessions as shaky.`
        : `You rated ${Math.round(shakyRate * 100)}% of sessions as shaky. Aim for under 30% before moving on.`
    );
    if (inBlock.length < 12) reasons.push(`You logged ${inBlock.length} sessions this block. Fewer than 12 is a light block.`);
    recommendation = improved && formOk && inBlock.length >= 12 ? 'advance' : 'repeat';
  }

  return {
    block,
    day: Math.max(1, day),
    week: Math.min(4, Math.ceil(Math.max(1, day) / 7)),
    daysLeft: Math.max(0, BLOCK_DAYS - day + 1),
    complete,
    startTest,
    endTest,
    sessionCount: inBlock.length,
    shakyRate,
    recommendation,
    reasons
  };
}

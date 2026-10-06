// Shared by the browser and the Worker. Merges two copies of the app data
// so logs from different devices never overwrite each other.

export function emptyState() {
  return {
    schema: 1,
    sessions: {},
    tests: {},
    program: { updatedAt: 0, started: false, blockIndex: 0, blockStart: null, history: [] },
    settings: { updatedAt: 0, sound: true, vibrate: true }
  };
}

function newer(a, b) {
  if (!a) return b;
  if (!b) return a;
  return (b.updatedAt ?? 0) > (a.updatedAt ?? 0) ? b : a;
}

function mergeRecords(a = {}, b = {}) {
  const out = { ...a };
  for (const [id, rec] of Object.entries(b)) out[id] = newer(out[id], rec);
  return out;
}

export function mergeStates(a, b) {
  const base = emptyState();
  a = a ?? base;
  b = b ?? base;
  return {
    schema: 1,
    sessions: mergeRecords(a.sessions, b.sessions),
    tests: mergeRecords(a.tests, b.tests),
    program: newer(a.program ?? base.program, b.program ?? base.program),
    settings: newer(a.settings ?? base.settings, b.settings ?? base.settings)
  };
}

export function isValidState(s) {
  return (
    s && typeof s === 'object' &&
    typeof s.sessions === 'object' && s.sessions !== null &&
    typeof s.tests === 'object' && s.tests !== null &&
    typeof s.program === 'object' && s.program !== null
  );
}

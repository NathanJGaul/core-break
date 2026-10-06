// Beeps via Web Audio, vibration, and screen wake lock for sessions.
let ctx = null;

/** Must be called from a tap (browsers block audio until a user gesture). */
export function unlockAudio() {
  try {
    ctx ??= new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
  } catch {
    ctx = null;
  }
}

export function beep(freq = 880, ms = 120, volume = 0.25) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + ms / 1000 + 0.02);
}

export function vibrate(pattern) {
  try {
    navigator.vibrate?.(pattern);
  } catch {}
}

let lock = null;
let wanted = false;

async function acquire() {
  try {
    if (wanted && 'wakeLock' in navigator && document.visibilityState === 'visible') {
      lock = await navigator.wakeLock.request('screen');
    }
  } catch {
    lock = null;
  }
}

function onVisibility() {
  if (wanted && document.visibilityState === 'visible') acquire();
}

export function keepAwake(on) {
  wanted = on;
  if (on) {
    document.addEventListener('visibilitychange', onVisibility);
    acquire();
  } else {
    document.removeEventListener('visibilitychange', onVisibility);
    lock?.release().catch(() => {});
    lock = null;
  }
}

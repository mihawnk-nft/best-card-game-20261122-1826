// Sound, synthesized live with WebAudio: no sound files, no network. A tiny
// pluck for clicks, a low thud for strikes, a rising chime for a win and a
// falling one for a loss. Sound stays off until the first click or keypress
// (browsers demand a gesture first), and M mutes it.
let context = null;
let muted = false;

function ensureContext() {
  if (context) return context;
  try {
    const AudioContext = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContext) return null;
    context = new AudioContext();
  } catch {
    context = null;
  }
  return context;
}

/** Unlock audio from a user gesture; call from the first click or key. */
export function unlockAudio() {
  const ctx = ensureContext();
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
}

export function toggleMute() {
  muted = !muted;
  return muted;
}

export function isMuted() {
  return muted;
}

function tone(frequency, duration, type, volume, when = 0, slideTo = null) {
  if (muted) return;
  const ctx = ensureContext();
  if (!ctx) return;
  try {
    const start = ctx.currentTime + when;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    if (slideTo !== null) oscillator.frequency.exponentialRampToValueAtTime(slideTo, start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.05);
  } catch {
    // Audio is decoration: a failure here must never break the duel.
  }
}

export const sfx = {
  click() {
    tone(660, 0.07, 'triangle', 0.12);
  },
  select() {
    tone(520, 0.09, 'sine', 0.14);
  },
  playCard() {
    tone(392, 0.12, 'triangle', 0.16);
    tone(587, 0.14, 'triangle', 0.12, 0.06);
  },
  attack() {
    tone(180, 0.18, 'sawtooth', 0.16, 0, 90);
  },
  hurt() {
    tone(140, 0.22, 'square', 0.1, 0, 70);
  },
  heal() {
    tone(523, 0.16, 'sine', 0.12);
    tone(784, 0.2, 'sine', 0.1, 0.08);
  },
  turn() {
    tone(440, 0.1, 'sine', 0.1);
  },
  win() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.28, 'triangle', 0.14, i * 0.12));
  },
  lose() {
    [392, 330, 262, 196].forEach((f, i) => tone(f, 0.32, 'triangle', 0.12, i * 0.14));
  },
};

// Signatures sonores synthétisées (Web Audio API). Aucun fichier externe.
// Registre apaisant, jamais d'alarme stridente.

let ctx = null;
let enabled = true;

function ensureCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

export function setEnabled(v) { enabled = !!v; }
export function isEnabled() { return enabled; }

function tone(freq, dur, delay = 0, gain = 0.08, type = 'sine') {
  const c = ensureCtx();
  if (!c || !enabled) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 2400;
  osc.type = type;
  osc.frequency.value = freq;
  // Enveloppe douce.
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.03);
  g.gain.linearRampToValueAtTime(0, t0 + dur);
  osc.connect(lp).connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

// Signatures par étape (légères variations harmoniques).
const CUES = {
  wakeup:    () => { tone(440, 0.4); tone(660, 0.5, 0.18); },
  shower:    () => { tone(392, 0.5); tone(523, 0.4, 0.22, 0.06, 'triangle'); },
  outfit:    () => { tone(523, 0.3); tone(622, 0.35, 0.15); },
  breakfast: () => { tone(349, 0.35); tone(523, 0.4, 0.18); tone(440, 0.3, 0.32); },
  grooming:  () => { tone(587, 0.3); tone(740, 0.35, 0.16); },
  bag:       () => { tone(330, 0.35); tone(494, 0.35, 0.16); },
  ready:     () => { tone(523, 0.3); tone(659, 0.35, 0.14); },
  // Départ : trois notes montantes reconnaissables (spec §10.1).
  leave:     () => { tone(523, 0.3, 0.00, 0.10); tone(659, 0.3, 0.18, 0.10); tone(784, 0.45, 0.36, 0.10); },
  nudge:     () => { tone(392, 0.35, 0, 0.05, 'triangle'); }
};

export function cue(stepKey) {
  const fn = CUES[stepKey];
  if (fn) fn();
}

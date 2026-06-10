// Son v2 (spec v2 §3.6) : deux couches Web Audio, tout synthétisé, zéro sample.
// 1. Signatures (confirmation, départ, nudge, réveil) sur une même gamme
//    pentatonique majeure de La : toute interaction sonne dans la même tonalité.
// 2. Nappe ambiante générative (off par défaut), ouverte par la lumière de scène.
// Le son de réveil démarre sous le seuil d'audibilité et monte sur 90 s.

let ctx = null;
let enabled = true;
let master = null;
let ambient = null;   // { gain, filter, oscs, lfo }
let wake = null;      // { gain, oscs, timer }

// Gamme pentatonique majeure de La.
const P = { A3: 220, B3: 246.94, Cs4: 277.18, E4: 329.63, Fs4: 369.99, A4: 440, Cs5: 554.37, E5: 659.25, A5: 880 };

function ensureCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 1;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

// À appeler dans la chaîne d'un geste utilisateur (tap de lancement,
// "Bonne nuit" du chevet) : crée le contexte et joue un buffer silencieux
// pour verrouiller l'autorisation iOS.
export function unlock() {
  const c = ensureCtx();
  if (!c) return false;
  const buf = c.createBuffer(1, 1, 22050);
  const src = c.createBufferSource();
  src.buffer = buf;
  src.connect(c.destination);
  src.start(0);
  return true;
}

export function isReady() {
  return !!ctx && ctx.state === 'running';
}

export function setEnabled(v) { enabled = !!v; if (!enabled) { stopAmbient(); stopWake(); } }
export function isEnabled() { return enabled; }

function note(freq, dur, delay = 0, gain = 0.07, type = 'sine', dest = null) {
  const c = ensureCtx();
  if (!c || !enabled) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 2200;
  osc.type = type;
  osc.frequency.value = freq;
  // Enveloppe longue et douce.
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.06);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(lp).connect(g).connect(dest || master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

// Signatures accordées (spec : confirmation, départ, nudge, réveil).
const CUES = {
  confirm: () => { note(P.A4, 0.7); note(P.Cs5, 0.8, 0.14, 0.05); },
  arrive:  () => { note(P.A4, 0.8, 0, 0.09); note(P.Cs5, 0.8, 0.2, 0.09); note(P.E5, 0.9, 0.4, 0.09); note(P.A5, 1.4, 0.62, 0.08); },
  nudge:   () => { note(P.E4, 0.9, 0, 0.04, 'triangle'); },
  wakeup:  () => { note(P.A3, 1.2, 0, 0.05); note(P.E4, 1.2, 0.3, 0.04); },
};

export function cue(name) {
  const fn = CUES[name];
  if (fn) fn();
}

// ─── Nappe ambiante (off par défaut) ────────────────────────────
// 2 oscillateurs détunés + passe-bas + LFO lent. La fréquence de coupure
// suit la lumière de scène : la pièce s'éclaire, le son s'ouvre.

export function startAmbient() {
  const c = ensureCtx();
  if (!c || !enabled || ambient) return;
  const gain = c.createGain();
  gain.gain.setValueAtTime(0, c.currentTime);
  gain.gain.linearRampToValueAtTime(0.022, c.currentTime + 4); // niveau perçu très bas
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 320;
  filter.Q.value = 0.4;

  const oscs = [P.A3, P.A3 * 1.005].map((f, i) => {
    const o = c.createOscillator();
    o.type = i === 0 ? 'sawtooth' : 'triangle';
    o.frequency.value = f;
    o.detune.value = i === 0 ? -4 : 4;
    o.connect(filter);
    o.start();
    return o;
  });

  // LFO lent sur la coupure.
  const lfo = c.createOscillator();
  const lfoGain = c.createGain();
  lfo.frequency.value = 0.06;
  lfoGain.gain.value = 60;
  lfo.connect(lfoGain).connect(filter.frequency);
  lfo.start();

  filter.connect(gain).connect(master);
  ambient = { gain, filter, oscs, lfo };
}

// l : lumière de scène 0..1. Ouvre le filtre avec la lumière.
export function setAmbientOpenness(l) {
  if (!ambient || !ctx) return;
  const target = 220 + Math.min(Math.max(l, 0), 1) * 1400;
  ambient.filter.frequency.linearRampToValueAtTime(target, ctx.currentTime + 1.2);
}

// Duck de -8 dB pendant la parole (F2).
export function duckAmbient(on) {
  if (!ambient || !ctx) return;
  const target = on ? 0.022 * 0.4 : 0.022;
  ambient.gain.gain.linearRampToValueAtTime(target, ctx.currentTime + 0.25);
}

export function stopAmbient() {
  if (!ambient || !ctx) { ambient = null; return; }
  const a = ambient;
  ambient = null;
  a.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.5);
  setTimeout(() => {
    a.oscs.forEach((o) => { try { o.stop(); } catch { /* déjà arrêté */ } });
    try { a.lfo.stop(); } catch { /* idem */ }
  }, 1700);
}

// ─── Son de réveil (F1) ─────────────────────────────────────────
// Démarre sous le seuil d'audibilité, monte sur riseSeconds (gain exponentiel),
// texture harmonique qui s'enrichit avec le temps. Jamais de sonnerie brutale.

export function startWake(riseSeconds = 90) {
  const c = ensureCtx();
  if (!c || !enabled || wake) return false;
  if (c.state !== 'running') return false; // repli lumière seule géré par l'appelant

  const gain = c.createGain();
  const t0 = c.currentTime;
  gain.gain.setValueAtTime(0.0004, t0);
  gain.gain.exponentialRampToValueAtTime(0.16, t0 + riseSeconds);
  gain.connect(master);

  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(400, t0);
  lp.frequency.linearRampToValueAtTime(2400, t0 + riseSeconds); // la texture s'enrichit
  lp.connect(gain);

  const oscs = [
    [P.A3, 'sine', 0],
    [P.E4, 'sine', 0],
    [P.A4, 'triangle', riseSeconds * 0.35],
    [P.Cs5, 'triangle', riseSeconds * 0.65],
  ].map(([f, type, delay]) => {
    const o = c.createOscillator();
    const og = c.createGain();
    o.type = type;
    o.frequency.value = f;
    og.gain.setValueAtTime(0, t0 + delay);
    og.gain.linearRampToValueAtTime(0.5, t0 + delay + 12);
    o.connect(og).connect(lp);
    o.start(t0);
    return o;
  });

  // Respiration lente du volume, pour rester organique.
  const lfo = c.createOscillator();
  const lfoGain = c.createGain();
  lfo.frequency.value = 0.12;
  lfoGain.gain.value = 0.02;
  lfo.connect(lfoGain).connect(gain.gain);
  lfo.start();

  wake = { gain, oscs, lfo };
  return true;
}

export function stopWake() {
  if (!wake || !ctx) { wake = null; return; }
  const w = wake;
  wake = null;
  w.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.2);
  setTimeout(() => {
    w.oscs.forEach((o) => { try { o.stop(); } catch { /* déjà arrêté */ } });
    try { w.lfo.stop(); } catch { /* idem */ }
  }, 1400);
}

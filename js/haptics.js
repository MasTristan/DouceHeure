// Haptique : wrapper navigator.vibrate avec patterns nommés (spec v2 §3.5).
// Silencieux si l'API est absente (iOS Safari) : dégradation muette.

const PATTERNS = {
  tap: 10,
  confirm: [15, 40, 30],
  arrive: [10, 30, 20, 30, 40],
  nudge: 8,
  crank: 5,
};

let enabled = true;

export function setEnabled(v) { enabled = !!v; }

export function buzz(name) {
  if (!enabled) return;
  const pattern = PATTERNS[name];
  if (!pattern) return;
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try { navigator.vibrate(pattern); } catch { /* muet */ }
  }
}

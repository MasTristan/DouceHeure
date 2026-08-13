// Horloge et minuteries injectables (S1 étape 2, ADR-004). En mode réel,
// chaque méthode délègue à la globale correspondante : comportement
// strictement identique aux appels directs qu'elle remplace. Les tests
// installent une horloge factice pour piloter le temps sans délai réel.

function realClock() {
  return {
    now: () => Date.now(),
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (id) => clearTimeout(id),
    setInterval: (fn, ms) => setInterval(fn, ms),
    clearInterval: (id) => clearInterval(id),
  };
}

// Instance partagée, mutable : les modules importent `clock` et appellent
// ses méthodes plutôt que les globales directement.
export const clock = realClock();

// Restaure le mode réel. À appeler en fin de test pour ne pas laisser fuir
// une horloge factice vers le test suivant.
export function resetClock() {
  Object.assign(clock, realClock());
}

// Horloge factice complète : le temps virtuel n'avance que sur tick(ms),
// qui déclenche alors, dans l'ordre de leur échéance, tous les minuteurs
// dus (les intervalles se reprogramment). Ni setTimeout ni setInterval
// n'utilisent de vrai délai en mode factice : un test peut simuler des
// heures en quelques appels synchrones.
export function installFakeClock(startTs = 0) {
  let t = startTs;
  let seq = 0;
  const timers = new Map(); // id -> { fireAt, fn, interval: ms|null }

  clock.now = () => t;

  clock.setTimeout = (fn, ms) => {
    const id = ++seq;
    timers.set(id, { fireAt: t + ms, fn, interval: null });
    return id;
  };
  clock.clearTimeout = (id) => { timers.delete(id); };

  clock.setInterval = (fn, ms) => {
    const id = ++seq;
    timers.set(id, { fireAt: t + ms, fn, interval: ms });
    return id;
  };
  clock.clearInterval = (id) => { timers.delete(id); };

  function dueTimer(target) {
    let best = null;
    for (const [id, timer] of timers) {
      if (timer.fireAt > target) continue;
      if (!best || timer.fireAt < best.timer.fireAt) best = { id, timer };
    }
    return best;
  }

  function tick(ms) {
    const target = t + ms;
    let next;
    while ((next = dueTimer(target))) {
      t = next.timer.fireAt;
      if (next.timer.interval != null) {
        next.timer.fireAt = t + next.timer.interval; // se reprogramme
      } else {
        timers.delete(next.id);
      }
      next.timer.fn();
    }
    t = target;
  }

  return { tick, now: () => t, pendingCount: () => timers.size };
}

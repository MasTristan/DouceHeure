// Maintien de l'écran allumé pendant le live (pivot app-ouverte, cf. CLAUDE.md §3.2).

let lock = null;

export async function acquire() {
  if (!('wakeLock' in navigator)) return false;
  try {
    lock = await navigator.wakeLock.request('screen');
    lock.addEventListener('release', () => { lock = null; });
    return true;
  } catch {
    return false;
  }
}

export function release() {
  if (lock) {
    try { lock.release(); } catch {}
    lock = null;
  }
}

let bound = false;
export function bindVisibility() {
  if (bound) return;
  bound = true;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !lock) acquire();
  });
}

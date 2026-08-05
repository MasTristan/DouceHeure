// B4 · release() doit retirer la reacquisition automatique du verrou d'ecran.
// Avant correctif : bindVisibility() pose un ecouteur permanent que release()
// ne desarme jamais, donc apres une seule session le verrou se reacquiert a
// chaque retour au premier plan, pour le reste de la vie de la page.
import test from 'node:test';
import assert from 'node:assert/strict';

function makeLock(onAddListener) {
  const listeners = {};
  return {
    addEventListener(ev, fn) { listeners[ev] = fn; onAddListener && onAddListener(fn); },
    release() { if (listeners.release) listeners.release(); },
  };
}

function stubNavigatorAndDocument(onRequest) {
  const visListeners = [];
  Object.defineProperty(globalThis, 'navigator', {
    value: { wakeLock: { request: onRequest } },
    configurable: true,
  });
  const doc = {
    visibilityState: 'visible',
    addEventListener(ev, fn) { if (ev === 'visibilitychange') visListeners.push(fn); },
  };
  globalThis.document = doc;
  return { doc, visListeners };
}

test('B4 : apres release(), un retour au premier plan ne reacquiert pas le verrou', async () => {
  let requestCount = 0;
  const { visListeners } = stubNavigatorAndDocument(async () => {
    requestCount++;
    return makeLock();
  });

  const wake = await import('../js/wakelock.js?b4-negative');
  await wake.acquire();
  assert.equal(requestCount, 1);

  wake.bindVisibility();
  wake.release();

  for (const fn of visListeners) fn();
  await new Promise((r) => setTimeout(r, 5));

  assert.equal(requestCount, 1, 'le verrou a ete reacquis apres release() : fuite');
});

test('B4 : tant que le verrou est voulu, une liberation externe est reacquise', async () => {
  let requestCount = 0;
  let lastReleaseCb = null;
  const { doc, visListeners } = stubNavigatorAndDocument(async () => {
    requestCount++;
    return makeLock((cb) => { lastReleaseCb = cb; });
  });
  doc.visibilityState = 'hidden';

  const wake = await import('../js/wakelock.js?b4-positive');
  await wake.acquire(); // session live en cours, verrou voulu
  assert.equal(requestCount, 1);

  wake.bindVisibility();
  // Le systeme peut liberer le verrou sans passer par release() de l'app
  // (par ex. iOS quand l'onglet passe hors champ) : le lock emet 'release'.
  lastReleaseCb();

  doc.visibilityState = 'visible';
  for (const fn of visListeners) fn();
  await new Promise((r) => setTimeout(r, 5));

  assert.equal(requestCount, 2, 'le verrou aurait du etre reacquis, la session est toujours voulue');
});

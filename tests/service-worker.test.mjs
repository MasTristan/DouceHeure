// B6 · Repli du service worker quand le reseau echoue et que rien n'est en
// cache. Avant correctif : `.catch(() => cached)` retournait `undefined` par
// construction dans cette branche (on n'y arrive que si caches.match n'a
// rien trouve), ce qui produit un ecran blanc hors-ligne plutot qu'une
// degradation. Charge le fichier de production tel quel via node:vm, sans
// dependance, sur le meme principe que le futur harnais tiny-dom.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const swSource = fs.readFileSync(path.join(__dirname, '../service-worker.js'), 'utf8');

function loadServiceWorker({ networkFails = true, indexCached = true } = {}) {
  const listeners = {};
  const cacheStore = new Map();
  if (indexCached) cacheStore.set('./index.html', new Response('coquille app', { status: 200 }));

  const sandbox = {
    self: {
      addEventListener(ev, fn) { listeners[ev] = fn; },
      location: { origin: 'https://example.test' },
      skipWaiting() {},
      clients: { claim() {} },
    },
    caches: {
      match: async (req) => {
        const key = typeof req === 'string' ? req : req.url;
        return cacheStore.get(key);
      },
      open: async () => ({ put: async () => {}, addAll: async () => {} }),
      keys: async () => [...cacheStore.keys()],
      delete: async () => true,
    },
    fetch: async () => {
      if (networkFails) throw new Error('hors ligne');
      return new Response('reseau', { status: 200 });
    },
    Response,
    URL,
    console,
  };
  vm.createContext(sandbox);
  vm.runInContext(swSource, sandbox);
  return { listeners, sandbox };
}

test('B6 : une navigation hors-ligne sans reseau retombe sur index.html, jamais undefined', async () => {
  const { listeners } = loadServiceWorker({ networkFails: true, indexCached: true });
  let capturedResponsePromise = null;
  const event = {
    request: { method: 'GET', url: 'https://example.test/quelque-part', mode: 'navigate', destination: 'document' },
    respondWith(p) { capturedResponsePromise = p; },
  };
  listeners.fetch(event);
  const res = await capturedResponsePromise;
  assert.notEqual(res, undefined, 'la reponse est undefined : ecran blanc garanti');
  assert.equal(await res.text(), 'coquille app');
});

test('B6 : une ressource non-navigation absente du cache et du reseau recoit une reponse construite, jamais undefined', async () => {
  const { listeners } = loadServiceWorker({ networkFails: true, indexCached: true });
  let capturedResponsePromise = null;
  const event = {
    request: { method: 'GET', url: 'https://example.test/js/manquant.js', mode: 'no-cors', destination: 'script' },
    respondWith(p) { capturedResponsePromise = p; },
  };
  listeners.fetch(event);
  const res = await capturedResponsePromise;
  assert.notEqual(res, undefined, 'la reponse est undefined : ecran blanc garanti');
  assert.ok(res instanceof Response);
});

test('B6 (positif) : une ressource presente au cache est servie normalement', async () => {
  const { listeners, sandbox } = loadServiceWorker({ networkFails: true, indexCached: true });
  const store = new Map([['https://example.test/css/tokens.css', new Response('css', { status: 200 })]]);
  sandbox.caches.match = async (req) => {
    const key = typeof req === 'string' ? req : req.url;
    return store.get(key);
  };
  let capturedResponsePromise = null;
  const event = {
    request: { method: 'GET', url: 'https://example.test/css/tokens.css', mode: 'no-cors', destination: 'style' },
    respondWith(p) { capturedResponsePromise = p; },
  };
  listeners.fetch(event);
  const res = await capturedResponsePromise;
  assert.equal(await res.text(), 'css');
});

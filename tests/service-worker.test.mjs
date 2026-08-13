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
import {
  parseServiceWorker, listRealCoveredFiles,
  computeAssetsHash, readLock, COVERED_DIRS, shouldRefuseStamp,
} from './tools/sw-assets.mjs';

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

// ─── S1 étape 1 : couverture et fraîcheur du manifeste ASSETS ──────────
// Le manifeste est aujourd'hui exact (43/43), mais la découpe de J1 va
// ajouter une vingtaine de fichiers d'un coup : ce test doit passer avant
// la découpe, pas après, sinon le risque devient réel exactement au moment
// où personne ne le regarde plus fichier par fichier.

test('S1 : chaque fichier de js/, css/ et assets/ figure dans ASSETS', () => {
  const { assets } = parseServiceWorker(swSource);
  const real = listRealCoveredFiles();
  const missing = real.filter((f) => !assets.includes(f));
  assert.deepEqual(missing, [], `fichiers absents du manifeste : ${missing.join(', ')}`);
});

test('S1 : chaque entrée de ASSETS pointe vers un fichier qui existe', () => {
  const { assets } = parseServiceWorker(swSource);
  const missing = assets.filter((rel) => {
    if (rel === '' || rel === 'index.html' || rel === 'manifest.webmanifest') {
      return !fs.existsSync(path.join(__dirname, '..', rel || 'index.html'));
    }
    return !COVERED_DIRS.some((d) => rel.startsWith(d + '/')) ? false
      : !fs.existsSync(path.join(__dirname, '..', rel));
  });
  assert.deepEqual(missing, [], `entrees du manifeste sans fichier : ${missing.join(', ')}`);
});

test('S1 : le verrou de hash (service-worker.assets.lock.json) est a jour', () => {
  const { version, assets } = parseServiceWorker(swSource);
  const currentHash = computeAssetsHash(assets);
  const lock = readLock();
  assert.ok(lock, 'aucun verrou trouve : lance node tests/tools/sw-stamp.mjs');
  assert.equal(
    currentHash, lock.hash,
    'le contenu des fichiers du manifeste a change sans re-tamponnage : ' +
    'lance node tests/tools/sw-stamp.mjs et commite le resultat'
  );
  assert.equal(
    version, lock.version,
    `VERSION (${version}) ne correspond pas au verrou (${lock.version}) : ` +
    're-execute node tests/tools/sw-stamp.mjs'
  );
});

test('S1 : sw-stamp.mjs refuse de re-tamponner un contenu change sans montee de VERSION', () => {
  // C'est ce refus qui force la montee de VERSION a chaque changement d'un
  // fichier cache. Teste directement la fonction de decision du script.
  const previous = { version: 'v9.9.9', hash: 'ancien-hash' };
  assert.equal(
    shouldRefuseStamp('nouveau-hash', 'v9.9.9', previous), true,
    'contenu different, VERSION inchangee : doit etre refuse'
  );
  assert.equal(
    shouldRefuseStamp('nouveau-hash', 'v10.0.0', previous), false,
    'contenu different, VERSION montee : doit etre accepte'
  );
  assert.equal(
    shouldRefuseStamp('ancien-hash', 'v9.9.9', previous), false,
    'contenu identique : rien a refuser'
  );
  assert.equal(
    shouldRefuseStamp('peu-importe', 'v1.0.0', null), false,
    'aucun verrou existant : premier tamponnage toujours accepte'
  );
});

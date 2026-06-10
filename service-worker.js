// Service Worker : cache hors-ligne UNIQUEMENT, jamais de notification.
// Cache versionné explicite (spec v2 §17) : app 100 % offline après
// premier chargement, polices auto-hébergées comprises.

const VERSION = 'v2.0.0';
const CACHE = `douce-heure-${VERSION}`;

const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/fonts.css',
  './css/tokens.css',
  './css/base.css',
  './css/components.css',
  './js/app.js',
  './js/store.js',
  './js/time.js',
  './js/predict.js',
  './js/plan.js',
  './js/travel.js',
  './js/bedside.js',
  './js/backup.js',
  './js/audio.js',
  './js/speech.js',
  './js/haptics.js',
  './js/scene.js',
  './js/icons.js',
  './js/card.js',
  './js/wakelock.js',
  './js/copy.js',
  './js/social.js',
  './js/ui.js',
  './js/studio.js',
  './assets/icon.svg',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/apple-touch-icon.png',
  './assets/fonts/fraunces-0.woff2',
  './assets/fonts/fraunces-1.woff2',
  './assets/fonts/fraunces-2.woff2',
  './assets/fonts/fraunces-3.woff2',
  './assets/fonts/fraunces-4.woff2',
  './assets/fonts/fraunces-5.woff2',
  './assets/fonts/outfit-0.woff2',
  './assets/fonts/outfit-1.woff2',
  './assets/fonts/atkinsonhyperlegible-0.woff2',
  './assets/fonts/atkinsonhyperlegible-1.woff2',
  './assets/fonts/atkinsonhyperlegible-2.woff2',
  './assets/fonts/atkinsonhyperlegible-3.woff2',
  './assets/fonts/atkinsonhyperlegible-4.woff2',
  './assets/fonts/atkinsonhyperlegible-5.woff2'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Cache d'abord, réseau en secours. Aucune donnée personnelle ne transite :
// seules les ressources statiques de l'app passent ici.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        const copy = res.clone();
        if (res.ok && new URL(req.url).origin === self.location.origin) {
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => cached);
    })
  );
});

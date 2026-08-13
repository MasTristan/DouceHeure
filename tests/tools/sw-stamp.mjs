#!/usr/bin/env node
// Outil de developpement (pas execute par la CI) : recalcule le condensat du
// contenu des fichiers listes dans ASSETS (service-worker.js) et met a jour
// tests/service-worker.assets.lock.json en consequence.
//
// Refuse d'ecrire si le contenu a change mais VERSION n'a pas ete montee :
// c'est ce refus qui force la montee de VERSION a chaque changement d'un
// fichier cache (S1-socle-de-confiance.md, etape 1).
//
// Usage : node tests/tools/sw-stamp.mjs
import { readServiceWorkerSource, parseServiceWorker, computeAssetsHash, readLock, writeLock, shouldRefuseStamp } from './sw-assets.mjs';

const { version, assets } = parseServiceWorker(readServiceWorkerSource());
const currentHash = computeAssetsHash(assets);
const previous = readLock();

if (shouldRefuseStamp(currentHash, version, previous)) {
  console.error(
    'Le contenu des fichiers du manifeste ASSETS a change mais VERSION\n' +
    `(service-worker.js) est toujours '${version}'. Monte VERSION avant de\n` +
    're-executer cet outil.'
  );
  process.exit(1);
}

writeLock({ version, hash: currentHash });

if (!previous) {
  console.log(`Verrou cree : version=${version}`);
} else if (currentHash === previous.hash) {
  console.log(`Rien a mettre a jour : contenu identique (version=${version}).`);
} else {
  console.log(`Verrou mis a jour : version=${previous.version} -> ${version}`);
}

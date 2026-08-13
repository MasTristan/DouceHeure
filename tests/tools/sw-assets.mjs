// Logique partagee entre le test de couverture (tests/service-worker.test.mjs)
// et l'outil de tamponnage (tests/tools/sw-stamp.mjs). Node natif uniquement,
// aucune dependance (ADR-001).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const LOCK_PATH = path.join(REPO_ROOT, 'tests/service-worker.assets.lock.json');

// Repertoires dont chaque fichier doit obligatoirement figurer dans ASSETS.
export const COVERED_DIRS = ['js', 'css', 'assets'];

export function parseServiceWorker(source) {
  const versionMatch = source.match(/const VERSION = '([^']+)'/);
  const assetsMatch = source.match(/const ASSETS = \[([\s\S]*?)\];/);
  if (!versionMatch || !assetsMatch) {
    throw new Error('VERSION ou ASSETS introuvable dans service-worker.js');
  }
  const version = versionMatch[1];
  const assets = [...assetsMatch[1].matchAll(/'\.\/([^']*)'/g)].map((m) => m[1]).filter(Boolean);
  return { version, assets };
}

export function readServiceWorkerSource() {
  return fs.readFileSync(path.join(REPO_ROOT, 'service-worker.js'), 'utf8');
}

// Tous les fichiers reels sous COVERED_DIRS, chemins relatifs a la racine du depot.
export function listRealCoveredFiles() {
  const out = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(path.join(REPO_ROOT, dir), { withFileTypes: true })) {
      const rel = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(rel);
      else out.push(rel);
    }
  }
  for (const dir of COVERED_DIRS) walk(dir);
  return out.sort();
}

// Hash stable du contenu de tous les fichiers listes dans ASSETS (hors './',
// qui designe le repertoire et n'a pas de contenu propre a hasher).
export function computeAssetsHash(assets) {
  const hash = crypto.createHash('sha256');
  for (const rel of [...assets].filter((a) => a !== '').sort()) {
    const full = path.join(REPO_ROOT, rel);
    hash.update(rel);
    hash.update('\0');
    if (fs.existsSync(full) && fs.statSync(full).isFile()) {
      hash.update(fs.readFileSync(full));
    }
    hash.update('\0');
  }
  return hash.digest('hex');
}

// Vrai si le stamp tool doit refuser d'ecrire : le contenu a change mais
// VERSION est restee identique a celle du dernier verrou connu. Fonction
// pure, extraite pour etre testee directement sans invoquer le script.
export function shouldRefuseStamp(currentHash, currentVersion, previousLock) {
  if (!previousLock) return false;
  return currentHash !== previousLock.hash && currentVersion === previousLock.version;
}

export function readLock() {
  if (!fs.existsSync(LOCK_PATH)) return null;
  return JSON.parse(fs.readFileSync(LOCK_PATH, 'utf8'));
}

export function writeLock(lock) {
  fs.writeFileSync(LOCK_PATH, JSON.stringify(lock, null, 2) + '\n');
}

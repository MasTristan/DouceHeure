// J2 · Le budget de performance devient mécanique.
//
// `CLAUDE.md` §3 fixe depuis l'origine « JS total < 220 Ko non minifié ».
// Rien ne le vérifiait. Il a donc dérivé en silence jusqu'à le dépasser
// pendant J2, et personne ne s'en serait aperçu avant un chargement lent
// sur un iPhone en Low Power Mode.
//
// Une contrainte d'architecture que rien n'exécute n'est pas une
// contrainte, c'est un souhait. Celle-ci en redevient une ici.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const BUDGET = 220 * 1024;

function jsFiles(dir = 'js') {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...jsFiles(path));
    else if (entry.endsWith('.js')) out.push(path);
  }
  return out;
}

test('CLAUDE.md §3 · le JavaScript de production tient sous 220 Ko non minifie', () => {
  const files = jsFiles();
  const sizes = files
    .map((f) => ({ f, n: readFileSync(f).length }))
    .sort((a, b) => b.n - a.n);
  const total = sizes.reduce((a, s) => a + s.n, 0);

  const worst = sizes.slice(0, 5).map((s) => `${s.f} (${s.n})`).join(', ');
  assert.ok(total <= BUDGET,
    `JS de production : ${total} octets pour un budget de ${BUDGET}. `
    + `Dépassement de ${total - BUDGET}. Les cinq plus gros : ${worst}. `
    + 'Un jalon qui dépasse le budget doit retirer, pas négocier (00-vision.md §2).');
});

// La marge restante est une information de pilotage : elle dit combien il
// reste avant que le prochain jalon ait à retirer quelque chose. Ce test
// ne bloque pas, il rend le chiffre visible dans la sortie de la CI.
test('marge restante sous le budget (informatif)', () => {
  const total = jsFiles().reduce((a, f) => a + readFileSync(f).length, 0);
  const left = BUDGET - total;
  console.log(`    budget JS : ${total} / ${BUDGET} octets, il reste ${left} octets (${(total / BUDGET * 100).toFixed(1)} %)`);
  assert.ok(left >= 0);
});

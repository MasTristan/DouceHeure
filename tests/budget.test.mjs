// Le budget de performance, mécanique (ADR-005).
//
// `CLAUDE.md` §3 fixait « JS total < 220 Ko non minifié » et rien ne le
// vérifiait : il a dérivé en silence puis a été dépassé pendant J2. Une
// contrainte d'architecture que rien n'exécute n'est pas une contrainte,
// c'est un souhait.
//
// ADR-005 l'a ensuite dédoublé, parce qu'il y a deux coûts distincts et
// qu'un seul chiffre les confondait : le poids transféré est payé une fois
// au remplissage du cache, le code hors commentaires est analysé à chaque
// démarrage à froid. Le second est le budget contraignant.
//
// Ni l'un ni l'autre n'est la vraie cible, qui est « First Paint < 1 s sur
// iPhone 12 » et se mesure sur un iPhone 12 (ADR-005, dernier paragraphe).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const TRANSFER_BUDGET = 260 * 1024;
const CODE_BUDGET = 185 * 1024;

function jsFiles(dir = 'js') {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...jsFiles(path));
    else if (entry.endsWith('.js')) out.push(path);
  }
  return out;
}

// Retire commentaires de bloc, commentaires de ligne et lignes vides. Une
// approximation : une chaine contenant `//` serait tronquée à tort. Elle
// suffit à un budget, elle ne suffirait pas à un analyseur.
function codeOnly(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/(^|\s)\/\/.*$/, ''))
    .filter((line) => line.trim())
    .join('\n');
}

function measure() {
  const rows = jsFiles().map((f) => {
    const source = readFileSync(f, 'utf8');
    return {
      f,
      transfer: Buffer.byteLength(source, 'utf8'),
      code: Buffer.byteLength(codeOnly(source), 'utf8'),
    };
  });
  return {
    rows,
    transfer: rows.reduce((a, r) => a + r.transfer, 0),
    code: rows.reduce((a, r) => a + r.code, 0),
  };
}

test('ADR-005 · le code hors commentaires tient sous 185 Ko', () => {
  const { rows, code } = measure();
  const worst = [...rows].sort((a, b) => b.code - a.code).slice(0, 5)
    .map((r) => `${r.f} (${r.code})`).join(', ');
  assert.ok(code <= CODE_BUDGET,
    `code de production : ${code} octets pour un budget de ${CODE_BUDGET}. `
    + `Dépassement de ${code - CODE_BUDGET}. Les cinq plus gros : ${worst}. `
    + 'C\'est le budget contraignant : il est analysé à chaque démarrage à froid. '
    + 'Un jalon qui le dépasse doit retirer du CODE, pas des commentaires (00-vision.md §2).');
});

test('ADR-005 · le poids transféré tient sous 260 Ko', () => {
  const { transfer } = measure();
  assert.ok(transfer <= TRANSFER_BUDGET,
    `poids transféré : ${transfer} octets pour un budget de ${TRANSFER_BUDGET}. `
    + `Dépassement de ${transfer - TRANSFER_BUDGET}. Ce budget est payé une seule fois, `
    + 'au remplissage du cache du service worker.');
});

// Les deux marges sont affichées à chaque exécution : ADR-005 assume le
// risque qu'avec deux budgets on ne regarde plus que le plus lâche.
test('marges restantes (informatif)', () => {
  const { transfer, code } = measure();
  console.log(`    code    : ${code} / ${CODE_BUDGET} octets, reste ${CODE_BUDGET - code} (${(code / CODE_BUDGET * 100).toFixed(1)} %)`);
  console.log(`    transfert : ${transfer} / ${TRANSFER_BUDGET} octets, reste ${TRANSFER_BUDGET - transfer} (${(transfer / TRANSFER_BUDGET * 100).toFixed(1)} %)`);
  assert.ok(code <= CODE_BUDGET && transfer <= TRANSFER_BUDGET);
});

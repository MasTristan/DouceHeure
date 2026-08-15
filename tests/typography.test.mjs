// J4 (S5 article 1) · Dynamic Type.
//
// Avant ce jalon, `css/` comptait 77 déclarations `font-size` en pixels
// contre 4 en unités relatives. Conséquence : le réglage « Taille du
// texte » d'iOS n'avait STRICTEMENT AUCUN effet sur l'app. Une personne
// qui avait agrandi son système parce qu'elle en a besoin ouvrait Douce
// heure et retrouvait du 16 px.
//
// Ces tests sont structurels : ils empêchent la réintroduction du défaut.
// Ils ne disent RIEN de ce qui se passe à 310 % de taille de texte, où le
// risque réel est qu'une mise en page casse. Ça, ça se voit sur un
// téléphone, et c'est dans la recette de J4 (S5 §7).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const CSS_DIR = 'css';
const cssFiles = () => readdirSync(CSS_DIR).filter((f) => f.endsWith('.css')).map((f) => join(CSS_DIR, f));

// Retire les commentaires : ils citent légitimement des tailles en pixels
// pour raconter ce qui a été converti.
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');

test('S5 §2 · aucune taille de texte en pixels dans css/', () => {
  const offenders = [];
  for (const file of cssFiles()) {
    const src = stripComments(readFileSync(file, 'utf8'));
    for (const [i, line] of src.split('\n').entries()) {
      if (!line.includes('font-size')) continue;
      if (/\d\s*px/.test(line)) offenders.push(`${file}:${i + 1} ${line.trim()}`);
    }
  }
  assert.deepEqual(offenders, [],
    'une taille en pixels ne suit pas le reglage systeme : utiliser rem, ou un token de tokens.css');
});

test('S5 §2 · les tokens de l\'echelle typographique sont tous relatifs', () => {
  const src = stripComments(readFileSync('css/tokens.css', 'utf8'));
  const tokens = [...src.matchAll(/--t-(hero|step|title|body|meta):\s*([^;]+);/g)];
  assert.equal(tokens.length >= 5, true, 'les cinq tailles de l\'echelle doivent etre declarees');
  for (const [, name, value] of tokens) {
    assert.match(value, /rem/, `--t-${name} doit etre exprime en rem : "${value.trim()}"`);
    assert.doesNotMatch(value, /\d\s*px/, `--t-${name} contient encore des pixels : "${value.trim()}"`);
  }
});

test('S5 §2 · la racine suit la taille de texte du systeme', () => {
  const src = readFileSync('css/base.css', 'utf8');
  const html = src.slice(src.indexOf('html {'), src.indexOf('}', src.indexOf('html {')));
  assert.match(html, /font:\s*-apple-system-body/,
    'sans ce levier, l\'echelle en rem suit une racine fixe et Dynamic Type reste sans effet sur iOS');
  assert.match(html, /font-family:\s*var\(--font-body\)/,
    '-apple-system-body impose aussi une famille : elle doit etre reprise, sinon l\'app perd ses polices');
});

// DEC-12 · Ce que J4 retire : un reglage de taille dans l'app, remplace
// par celui que la personne a deja fait une fois pour tout son telephone.
test('DEC-12 · le mode lisible ne regle plus la taille du texte', () => {
  const src = stripComments(readFileSync('css/tokens.css', 'utf8'));
  const start = src.indexOf('.readable {');
  assert.notEqual(start, -1, '.readable doit toujours exister : il change la fonte, pas la taille');
  const block = src.slice(start, src.indexOf('}', start));
  assert.doesNotMatch(block, /--base-scale/, 'la taille appartient au systeme (S5 article 1)');
  assert.doesNotMatch(block, /--t-(body|meta|title|step|hero)/, 'le mode lisible ne redefinit plus l\'echelle');
  assert.match(block, /Atkinson Hyperlegible/, 'ce qu\'il doit garder : une fonte dessinee pour la lisibilite');
});

test('DEC-12 · la variable --base-scale a disparu du depot', () => {
  for (const file of cssFiles()) {
    assert.doesNotMatch(stripComments(readFileSync(file, 'utf8')), /var\(--base-scale\)/,
      `${file} multiplie encore une taille par --base-scale`);
  }
});

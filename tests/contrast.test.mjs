// J4 (S5 article 2) · Contrastes.
//
// Les quatre scènes ont été dessinées à l'œil et la spec v2 annonce « AA
// partout, AAA sur le mot d'étape et le bouton de confirmation » sans que
// rien ne l'ait jamais vérifié. Ce fichier le vérifie, sur les couples
// réellement utilisés, en lisant tokens.css.
//
// Calcul WCAG 2.1, sans dépendance (ADR-001).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const SRC = readFileSync('css/tokens.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

// Lit un bloc de déclarations (`:root`, `[data-scene='day']`, ...) et rend
// ses tokens de couleur.
function blockTokens(selector) {
  const start = SRC.indexOf(selector);
  if (start === -1) throw new Error(`bloc introuvable : ${selector}`);
  const open = SRC.indexOf('{', start);
  const close = SRC.indexOf('}', open);
  const out = {};
  for (const [, name, value] of SRC.slice(open, close).matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
    out[name] = value.trim();
  }
  return out;
}

// Une scène hérite de :root et ne redéfinit que ce qui change.
const ROOT = blockTokens(':root');
const scene = (sel) => ({ ...ROOT, ...blockTokens(sel) });

const SCENES = {
  dawn: ROOT,
  day: scene("[data-scene='day']"),
  evening: scene("[data-scene='evening']"),
  night: scene("[data-scene='night']"),
};

function toRgb(value) {
  const hex = value.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const rgb = value.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  throw new Error(`couleur non interpretable : ${value}`);
}

function luminance([r, g, b]) {
  const lin = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

function ratio(fg, bg) {
  const [a, b] = [luminance(toRgb(fg)), luminance(toRgb(bg))].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

// Couples réellement utilisés dans le produit, avec leur exigence.
// AAA (7:1) sur ce qui porte le geste : le mot d'étape et le bouton de
// confirmation sont ce qu'on lit en étant pressé et mal réveillé.
const PAIRS = [
  { fg: '--text', bg: '--bg', min: 4.5, what: 'corps de texte sur le fond' },
  { fg: '--text', bg: '--surface', min: 4.5, what: 'corps de texte sur une carte' },
  { fg: '--text', bg: '--surface-hi', min: 4.5, what: 'corps de texte sur une carte haute' },
  { fg: '--text-mid', bg: '--bg', min: 4.5, what: 'texte secondaire sur le fond' },
  { fg: '--text-mid', bg: '--surface', min: 4.5, what: 'texte secondaire sur une carte' },
  { fg: '--amber', bg: '--bg', min: 7, what: "le mot d'etape en etat suggere" },
  { fg: '--on-amber', bg: '--amber', min: 7, what: 'le bouton de confirmation' },
];

// La scène Nuit est exemptée, et l'exemption est ECRITE. Elle est
// délibérément très sombre parce qu'elle ne doit pas réveiller : c'est un
// choix produit assumé qui ne peut pas viser AA, et une exemption tacite
// serait un bug. Ce qu'on vérifie d'elle est plus bas, et c'est l'inverse :
// que rien n'y soit trop lumineux.
const AA_SCENES = ['dawn', 'day', 'evening'];

for (const name of AA_SCENES) {
  for (const { fg, bg, min, what } of PAIRS) {
    test(`contraste · scene ${name} · ${what} (${fg} sur ${bg})`, () => {
      const tokens = SCENES[name];
      assert.ok(tokens[fg] && tokens[bg], `token manquant : ${fg} ou ${bg}`);
      const r = ratio(tokens[fg], tokens[bg]);
      assert.ok(r >= min,
        `${r.toFixed(2)}:1, exige ${min}:1. A corriger dans tokens.css et nulle part ailleurs (CLAUDE.md §7).`);
    });
  }
}

test('scene Nuit · exemptee de AA, et verifiee dans l\'autre sens', () => {
  const n = SCENES.night;
  // Ce qui compte de nuit n'est pas de contraster, c'est de ne pas
  // reveiller. Aucun couple ne doit DEPASSER un contraste doux.
  const bright = ratio(n['--text'], n['--bg']);
  assert.ok(bright < 4.5,
    `le texte de nuit contraste a ${bright.toFixed(2)}:1 : c'est trop lumineux pour 3 h du matin`);
  assert.ok(bright > 1.5,
    `le texte de nuit contraste a ${bright.toFixed(2)}:1 : il devient illisible`);
});

test('S5 §3 · aucune couleur de marque en dur hors de tokens.css', () => {
  // Les noirs et blancs translucides restent tolérés : ce sont des ombres
  // et des voiles neutres, pas des couleurs de marque. Tout le reste doit
  // passer par un token, sinon il ne change pas de scène, ce qui était le
  // cas des 34 occurrences d'ambre figées avant J4.
  const offenders = [];
  for (const file of ['css/base.css', 'css/components.css']) {
    const src = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const [i, line] of src.split('\n').entries()) {
      const hex = line.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
      const rgb = (line.match(/rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+/g) || [])
        .filter((m) => !/\(\s*0\s*,\s*0\s*,\s*0/.test(m) && !/\(\s*255\s*,\s*255\s*,\s*255/.test(m));
      if (hex.length || rgb.length) offenders.push(`${file}:${i + 1} ${line.trim()}`);
    }
  }
  assert.deepEqual(offenders, [],
    'une couleur en dur ne change pas de scene : la declarer dans tokens.css');
});

test('les quatre scenes declarent les tokens de teinte', () => {
  for (const [name, tokens] of Object.entries(SCENES)) {
    for (const t of ['--amber-rgb', '--green-rgb', '--on-amber', '--danger', '--danger-rgb', '--scrim']) {
      assert.ok(tokens[t], `scene ${name} : ${t} manquant, elle heriterait de l'Aube`);
    }
  }
});

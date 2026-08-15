// B2/B3 · Verifications complementaires a confirm-control.test.mjs :
// - une integration bout en bout du contrat "aucune valeur v=1 parasite dans
//   step.real apres un scenario clavier agressif", sans DOM (le mecanisme de
//   garde est deja prouve dans confirm-control.test.mjs ; ce test verifie
//   qu'il protege bien recordDurations comme confirmNext le ferait).
// - des verifications structurelles legeres sur le rendu du geste : le cablage reel
//   sur de vrais evenements DOM (pointerdown/keydown/click du navigateur)
//   n'est pas testable sans un DOM complet. Ce niveau de test est reserve
//   au harnais tiny-dom de J1 (S1-socle-de-confiance.md, etape 2) : ce
//   fichier documente explicitement cette limite plutot que de la taire.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createConfirmControl } from '../js/confirm-control.js';
import { recordDurations } from '../js/predict.js';
import { defaultState } from '../js/store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// J1 découpe étape 4 (préalable) : holdButton vit désormais dans
// ui/gesture.js, extrait de ui.js (socle, pas spécifique au live).
const gestureSrc = fs.readFileSync(path.join(__dirname, '../js/ui/gesture.js'), 'utf8');
// J1 découpe étape 5 : renderNight/renderWakeProposal vivent désormais
// dans night/view.js, extrait de ui.js (Nour, R1 §1.4).
const nightViewSrc = fs.readFileSync(path.join(__dirname, '../js/night/view.js'), 'utf8');

function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

test('B2 : une rafale de keydown repete ne produit qu\'une seule mesure dans step.real', async () => {
  const state = defaultState();
  const profileId = state.activeProfileId;
  const ctx = { day: 1, type: 'work', profileId };

  let confirmCount = 0;
  const control = createConfirmControl({
    holdMs: 15,
    onConfirm: () => {
      confirmCount++;
      // Reproduit exactement ce que confirmNext() fait a chaque confirmation.
      recordDurations(state, [{ stepKey: 'wakeup', v: 1 }], ctx);
    },
  });

  control.keyDown({ key: ' ', repeat: false });
  for (let i = 0; i < 200; i++) control.keyDown({ key: ' ', repeat: true });
  await wait(30);
  control.keyUp();

  assert.equal(confirmCount, 1, 'plus d\'une confirmation a ete declenchee par la rafale');
  const step = state.profiles.find((p) => p.id === profileId).steps.find((s) => s.key === 'wakeup');
  assert.equal(step.real.length, 1, `step.real contient ${step.real.length} mesures parasites au lieu de 1`);
});

test('B1/B2 combinees : une session clavier "traversee en boucle" ne remplit pas le FIFO de mesures a 1 min', async () => {
  const state = defaultState();
  const profileId = state.activeProfileId;
  const ctx = { day: 1, type: 'work', profileId };
  const stepKeys = state.profiles.find((p) => p.id === profileId).steps.map((s) => s.key);

  // Simule un scenario ou quelqu'un maintient Entree en boucle sur chaque
  // etape (ce que le clavier permettait AVANT le correctif B2).
  for (const stepKey of stepKeys) {
    let confirmed = false;
    const control = createConfirmControl({
      holdMs: 10,
      onConfirm: () => {
        confirmed = true;
        recordDurations(state, [{ stepKey, v: 1 }], ctx);
      },
    });
    control.keyDown({ key: 'Enter', repeat: false });
    for (let i = 0; i < 50; i++) control.keyDown({ key: 'Enter', repeat: true }); // spam
    await wait(20);
    assert.equal(confirmed, true); // l'etape avance normalement une fois
  }

  for (const stepKey of stepKeys) {
    const step = state.profiles.find((p) => p.id === profileId).steps.find((s) => s.key === stepKey);
    assert.equal(step.real.length, 1, `${stepKey} a ${step.real.length} mesures au lieu de 1`);
  }
});

test('ui/gesture.js : holdButton cable les quatre chemins (pointer, clavier, click, tap) via confirm-control.js', () => {
  assert.match(gestureSrc, /import\s*\{\s*createConfirmControl\s*\}\s*from\s*'\.\.\/confirm-control\.js'/);
  const fnStart = gestureSrc.indexOf('function holdButton');
  assert.notEqual(fnStart, -1);
  const fnEnd = gestureSrc.indexOf('\n}\n', fnStart);
  const body = gestureSrc.slice(fnStart, fnEnd);
  assert.match(body, /control\.pointerDown\(\)/, 'chemin maintien absent');
  assert.match(body, /control\.keyDown\(/, 'chemin clavier absent');
  assert.match(body, /control\.click\(\)/, 'chemin assistif/click absent');
  assert.doesNotMatch(body, /onConfirm\(\);\s*\n\s*\}\s*\n\s*\}\);\s*\n\s*btn\.addEventListener\('keydown'/,
    'le clavier semble encore confirmer directement sans passer par confirm-control');
});

test('ui/gesture.js : le keydown de holdButton ne confirme plus directement sans garde e.repeat', () => {
  // Le defaut B2 original : le bloc `btn.addEventListener('keydown', ...)`
  // appelait onConfirm() lui-meme, sans reference a repeat ni a un minuteur.
  // Desormais ce bloc doit uniquement deleguer a control.keyDown(e).
  const keydownStart = gestureSrc.indexOf(`btn.addEventListener('keydown'`);
  assert.notEqual(keydownStart, -1, 'aucun ecouteur keydown trouve sur le bouton en mode hold');
  const keydownEnd = gestureSrc.indexOf('});', keydownStart);
  const keydownBlock = gestureSrc.slice(keydownStart, keydownEnd);
  assert.doesNotMatch(keydownBlock, /(?<!control\.)onConfirm\(/, 'le keydown appelle encore onConfirm() directement');
  assert.match(keydownBlock, /control\.keyDown\(e\)/, 'le keydown ne delegue pas a control.keyDown');
  assert.match(keydownBlock, /e\.repeat|!e\.repeat/, 'aucune reference a e.repeat dans le chemin clavier');
});

test('night/view.js : le mode chevet (renderNight, renderWakeProposal) expose un element focusable et nomme', () => {
  for (const fnName of ['renderNight', 'renderWakeProposal']) {
    const start = nightViewSrc.indexOf(`function ${fnName}`);
    assert.notEqual(start, -1, `${fnName} introuvable`);
    const end = nightViewSrc.indexOf('\n}\n', start);
    const body = nightViewSrc.slice(start, end);
    assert.match(body, /tabindex:\s*'0'/, `${fnName} n'expose pas d'element focusable`);
    assert.match(body, /'aria-label':/, `${fnName} n'expose pas de nom accessible`);
    assert.match(body, /role:\s*'button'/, `${fnName} n'expose pas de role actionnable`);
  }
});

test('night/view.js : la sortie du chevet ne passe plus par un confirm() natif (DEC-03)', () => {
  // Ce test comptait auparavant EXACTEMENT un confirm(), pour verrouiller
  // le seul dialogue natif preexistant sans interdire sa suppression a
  // venir. J1 etape 8 l'a supprime : la cible est maintenant zero. Les
  // commentaires sont exclus du comptage (ils mentionnent legitimement
  // "confirm()" en prose pour raconter ce qui a ete retire).
  const start = nightViewSrc.indexOf('function renderNight');
  const end = nightViewSrc.indexOf('function renderWakeProposal');
  const nightBody = nightViewSrc.slice(start, end)
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n');
  const nativeCalls = (nightBody.match(/(?<![.\w])(confirm|prompt|alert)\(/g) || []).length;
  assert.equal(nativeCalls, 0, 'la sortie du chevet doit passer par la feuille (ui/sheet.js), pas par un dialogue natif');
  assert.match(nightBody, /askConfirm\(/, 'la sortie du chevet doit demander confirmation via la feuille');
});

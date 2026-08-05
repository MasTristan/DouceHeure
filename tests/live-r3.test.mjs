// S1 étape 2 · R3 dans le comportement réel : aucune écriture sur un geste
// interrompu, une étape sautée, ou une étape polluée par un imprévu (F6).
// Lit l'état persisté (dom.localStorage) après chaque scénario, exactement
// comme le ferait un rechargement de l'app.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installTinyDom, byClass, byExactText } from './tiny-dom.mjs';
import { installFakeClock, resetClock } from '../js/clock.js';
import { defaultState } from '../js/store.js';
import { UI } from '../js/copy.js';

test.afterEach(() => resetClock());

async function importFreshUi() {
  return import(`../js/ui.js?t=${Date.now()}-${Math.random()}`);
}

function seed(dom) {
  const state = defaultState();
  state.onboarded = true;
  dom.localStorage.setItem('douce-heure:v1', JSON.stringify(state));
  return state;
}

function readPersistedSteps(dom, profileId) {
  const raw = dom.localStorage.getItem('douce-heure:v1');
  const state = JSON.parse(raw);
  return state.profiles.find((p) => p.id === profileId).steps;
}

async function reachLive(dom, state) {
  const ui = await importFreshUi();
  ui.showPreview(state.activeProfileId);
  dom.fireEvent(byClass(dom.app, 'btn--primary'), 'click');
  return ui;
}

test('R3 · un appui interrompu avant 600ms n\'écrit rien dans step.real', async () => {
  const dom = installTinyDom();
  const fake = installFakeClock(Date.parse('2026-08-05T07:00:00'));
  const state = seed(dom);
  await reachLive(dom, state);

  const btn = byClass(dom.app, 'hold-btn');
  dom.fireEvent(btn, 'pointerdown');
  fake.tick(300);
  dom.fireEvent(btn, 'pointerup');

  const steps = readPersistedSteps(dom, state.activeProfileId);
  const totalReal = steps.reduce((n, s) => n + s.real.length, 0);
  assert.equal(totalReal, 0, 'un appui interrompu a quand meme ecrit une mesure');
});

// Le tiroir (comme les toasts et modales) est ajouté directement à
// document.body, hors de #app : les recherches sur son contenu portent sur
// dom.document.body, pas sur dom.app.

test('R3 · une étape sautée depuis le tiroir n\'écrit rien pour cette étape', async () => {
  const dom = installTinyDom();
  const fake = installFakeClock(Date.parse('2026-08-05T07:00:00'));
  const state = seed(dom);
  await reachLive(dom, state);

  // Confirme la première étape normalement (pour avoir une mesure de
  // référence ailleurs), puis saute la deuxième depuis le tiroir.
  let btn = byClass(dom.app, 'hold-btn');
  dom.fireEvent(btn, 'pointerdown');
  fake.tick(700);

  const drawerOpenBtn = byExactText(dom.app, UI.live_drawer_open);
  assert.ok(drawerOpenBtn, 'bouton d\'ouverture du tiroir introuvable');
  dom.fireEvent(drawerOpenBtn, 'click');

  const skipBtn = byClass(dom.document.body, 'drawer-skip');
  assert.ok(skipBtn, 'bouton "pas aujourd\'hui" introuvable dans le tiroir');
  // "drawer-item__label" existe aussi bien pour les étapes déjà confirmées
  // (past) que pour les étapes à venir (upcoming) : on remonte au conteneur
  // exact du bouton "skip" pour lire le libellé de LA bonne étape.
  const skippedItem = skipBtn.parentNode.parentNode; // .drawer-item du bouton
  const skippedLabel = byClass(skippedItem, 'drawer-item__label')?.textContent;
  dom.fireEvent(skipBtn, 'click');

  // Termine la session en confirmant tout ce qui reste.
  for (let i = 0; i < 10; i++) {
    btn = byClass(dom.app, 'hold-btn');
    if (!btn) break;
    dom.fireEvent(btn, 'pointerdown');
    fake.tick(700);
  }

  const steps = readPersistedSteps(dom, state.activeProfileId);
  const skippedStep = steps.find((s) => s.label === skippedLabel);
  assert.ok(skippedStep, 'étape sautée introuvable dans le profil');
  assert.equal(skippedStep.real.length, 0, 'l\'étape sautée a quand meme une mesure ecrite');
});

test('R3 · une étape polluée par un imprévu (pause puis reprise) n\'écrit rien à sa confirmation', async () => {
  const dom = installTinyDom();
  const fake = installFakeClock(Date.parse('2026-08-05T07:00:00'));
  const state = seed(dom);
  await reachLive(dom, state);

  // Ouvre le tiroir pour déclencher l'imprévu (F6) sur l'étape courante.
  const drawerOpenBtn = byExactText(dom.app, UI.live_drawer_open);
  dom.fireEvent(drawerOpenBtn, 'click');
  const pauseBtn = byExactText(dom.document.body, UI.live_drawer_pause);
  assert.ok(pauseBtn, 'bouton "Imprevu" introuvable dans le tiroir');
  const currentStepLabelBeforePause = byClass(dom.app, 't-step')?.textContent;
  dom.fireEvent(pauseBtn, 'click');

  fake.tick(20 * 60000); // l'imprevu dure 20 minutes simulees

  const resumeBtn = byClass(dom.app, 'btn--primary');
  assert.ok(resumeBtn, 'bouton de reprise introuvable sur l\'ecran pause');
  dom.fireEvent(resumeBtn, 'click');

  // L'étape en cours au moment de l'imprévu est désormais polluée : sa
  // confirmation ne doit rien écrire.
  const btn = byClass(dom.app, 'hold-btn');
  dom.fireEvent(btn, 'pointerdown');
  fake.tick(700);

  const steps = readPersistedSteps(dom, state.activeProfileId);
  const pollutedStep = steps.find((s) => s.label === currentStepLabelBeforePause);
  assert.ok(pollutedStep, 'étape polluée introuvable dans le profil');
  assert.equal(pollutedStep.real.length, 0, 'l\'étape polluée par l\'imprévu a quand meme une mesure ecrite');
});

test('R3 (positif) : une session normale, sans incident, écrit bien les mesures des étapes confirmées', async () => {
  const dom = installTinyDom();
  const fake = installFakeClock(Date.parse('2026-08-05T07:00:00'));
  const state = seed(dom);
  await reachLive(dom, state);

  let confirmedCount = 0;
  for (let i = 0; i < 10; i++) {
    const btn = byClass(dom.app, 'hold-btn');
    if (!btn) break;
    dom.fireEvent(btn, 'pointerdown');
    fake.tick(700);
    confirmedCount++;
  }

  const steps = readPersistedSteps(dom, state.activeProfileId);
  const totalReal = steps.reduce((n, s) => n + s.real.length, 0);
  assert.ok(totalReal > 0, 'aucune mesure ecrite alors qu\'une session complete a ete jouee normalement');
  assert.ok(confirmedCount >= steps.length, 'pas assez d\'etapes confirmees pour couvrir le profil');
});

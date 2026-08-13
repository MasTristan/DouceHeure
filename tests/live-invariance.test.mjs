// S1 étape 2 · ADR-003 : « pendant le guidage, jour 1 et jour 30 doivent
// être indiscernables ». L'écran live n'exprime jamais l'état de la
// connaissance du modèle (R4 : la marge est invisible ; R1 : aucune durée).
// Ce fichier compare le rendu sous un modèle froid (aucune mesure, w=0
// partout) et sous un modèle nourri (mesures abondantes, forte confiance,
// durées prédites différentes) au même step, au même instant.
//
// Nuance assumée : copy.js::pick() évite délibérément de répéter le même
// message d'un appel à l'autre. Une égalité caractère pour caractère entre
// deux rendus indépendants n'est donc pas le bon test pour la partie
// randomisée (le paragraphe d'ambiance). Ce qui compte réellement pour
// ADR-003 : les parties déterministes sont identiques au caractère près,
// et la partie randomisée est tirée du MÊME réservoir dans les deux cas —
// la confiance du modèle ne débloque ni ne verrouille jamais une
// formulation différente.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installTinyDom, byClass } from './tiny-dom.mjs';
import { installFakeClock, resetClock } from '../js/clock.js';
import { defaultState } from '../js/store.js';
import { COPY } from '../js/copy.js';
import { resetLiveForTests } from '../js/live/controller.js';
import { showPreview } from '../js/screens/preview.js';
// Auto-enregistrement dans liveNav (S1 §4) : en production, seul app.js
// importe ces modules pour cet effet de bord. Sans cet import ici,
// startLive() plante au premier appel à liveNav.renderLive() (jamais
// défini).
import '../js/live/view.js';
import '../js/live/drawer.js';
import '../js/live/leave.js';

test.afterEach(() => { resetClock(); resetLiveForTests(); });

function coldState() {
  const state = defaultState();
  state.onboarded = true;
  return state;
}

// Mêmes étapes que coldState(), mais chacune abondamment mesurée : forte
// confiance (w proche de 1), durées prédites différentes de `est`.
function warmState() {
  const state = defaultState();
  state.onboarded = true;
  const profile = state.profiles.find((p) => p.id === state.activeProfileId);
  for (const step of profile.steps) {
    for (let i = 0; i < 8; i++) {
      step.real.push({ v: Math.max(1, step.est + (i % 2 === 0 ? 4 : -3)), day: 1, type: 'work' });
    }
  }
  return state;
}

function renderLiveScreen(dom, state) {
  // live/controller.js est un singleton : chaque test ici lance DEUX
  // sessions (froide puis nourrie) dans le même cas, la deuxième doit donc
  // trouver `live` déjà reparti à zéro, sinon startLive() no-op
  // silencieusement (if (live) return;).
  resetLiveForTests();
  showPreview(state.activeProfileId);
  dom.fireEvent(byClass(dom.app, 'btn--primary'), 'click');
}

test('ADR-003 : le live rendu sous modèle froid et sous modèle nourri est indiscernable', async () => {
  const domA = installTinyDom();
  installFakeClock(Date.parse('2026-08-05T07:00:00'));
  const stateA = coldState();
  domA.localStorage.setItem('douce-heure:v1', JSON.stringify(stateA));
  renderLiveScreen(domA, stateA);

  const domB = installTinyDom();
  installFakeClock(Date.parse('2026-08-05T07:00:00'));
  const stateB = warmState();
  domB.localStorage.setItem('douce-heure:v1', JSON.stringify(stateB));
  renderLiveScreen(domB, stateB);

  const firstStepKey = stateA.profiles.find((p) => p.id === stateA.activeProfileId).steps[0].key;

  // ─── Parties déterministes : identiques au caractère près ──────
  assert.equal(
    byClass(domA.app, 't-step')?.textContent,
    byClass(domB.app, 't-step')?.textContent,
    'le libellé de l\'étape diffère selon la confiance du modèle'
  );

  const btnA = byClass(domA.app, 'hold-btn');
  const btnB = byClass(domB.app, 'hold-btn');
  assert.equal(
    btnA.getAttribute('aria-label'), btnB.getAttribute('aria-label'),
    'le libellé du bouton de confirmation diffère selon la confiance du modèle'
  );
  assert.equal(btnA.classList.contains('state-suggested'), false, 'suggested actif au rendu initial (modèle froid)');
  assert.equal(btnB.classList.contains('state-suggested'), false, 'suggested actif au rendu initial (modèle nourri)');
  assert.equal(btnA.classList.contains('is-armed'), false);
  assert.equal(btnB.classList.contains('is-armed'), false);

  const nextHintA = byClass(domA.app, 't-meta')?.textContent;
  const nextHintB = byClass(domB.app, 't-meta')?.textContent;
  assert.equal(nextHintA, nextHintB, 'l\'indication de la prochaine étape diffère selon la confiance du modèle');

  // ─── Partie randomisée : même réservoir, jamais un réservoir différent ──
  const pool = COPY[firstStepKey] || COPY.free;
  const bodyA = byClass(domA.app, 't-body')?.textContent;
  const bodyB = byClass(domB.app, 't-body')?.textContent;
  assert.ok(pool.includes(bodyA), `message du modèle froid hors réservoir attendu : "${bodyA}"`);
  assert.ok(pool.includes(bodyB), `message du modèle nourri hors réservoir attendu : "${bodyB}"`);
});

test('ADR-003 : indiscernable aussi à l\'état "suggested" (l\'étape a dépassé sa durée prédite)', async () => {
  const domA = installTinyDom();
  const fakeA = installFakeClock(Date.parse('2026-08-05T07:00:00'));
  const stateA = coldState();
  domA.localStorage.setItem('douce-heure:v1', JSON.stringify(stateA));
  renderLiveScreen(domA, stateA);
  fakeA.tick(30 * 60000); // dépasse largement dur, quel que soit le modèle

  const domB = installTinyDom();
  const fakeB = installFakeClock(Date.parse('2026-08-05T07:00:00'));
  const stateB = warmState();
  domB.localStorage.setItem('douce-heure:v1', JSON.stringify(stateB));
  renderLiveScreen(domB, stateB);
  fakeB.tick(30 * 60000);

  assert.equal(
    byClass(domA.app, 't-step')?.textContent,
    byClass(domB.app, 't-step')?.textContent
  );
  const bodyA = byClass(domA.app, 't-body')?.textContent;
  const bodyB = byClass(domB.app, 't-body')?.textContent;
  // Les deux doivent venir du même réservoir "suggested" (copy.js) : la
  // confiance du modèle ne débloque jamais un message différent.
  assert.ok(COPY.suggested.includes(bodyA), `message "suggested" du modèle froid hors réservoir : "${bodyA}"`);
  assert.ok(COPY.suggested.includes(bodyB), `message "suggested" du modèle nourri hors réservoir : "${bodyB}"`);
});

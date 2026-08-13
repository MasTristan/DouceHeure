// J1 découpe étape 7 · app.js est désormais le seul point de composition
// (la façade ui.js a disparu) : lui seul importe live/view.js, drawer.js,
// leave.js et night/view.js pour leur auto-enregistrement dans
// liveNav/nightNav (S1 §4). Tous les autres fichiers de tests réimportent
// ces modules eux-mêmes pour rester indépendants d'app.js ; ce fichier est
// le seul qui vérifie le VRAI point d'entrée de production, tel qu'un
// chargement de page l'exécuterait.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installTinyDom, byClass, byExactText } from './tiny-dom.mjs';
import { installFakeClock, resetClock } from '../js/clock.js';
import { defaultState } from '../js/store.js';
import { UI } from '../js/copy.js';
import { resetLiveForTests } from '../js/live/controller.js';
import { resetNightForTests } from '../js/night/controller.js';

test.afterEach(() => { resetClock(); resetLiveForTests(); resetNightForTests(); });

function seed(dom, mutate) {
  const state = defaultState();
  state.onboarded = true;
  if (mutate) mutate(state);
  dom.localStorage.setItem('douce-heure:v1', JSON.stringify(state));
  return state;
}

test('app.js : chargement réel affiche l\'accueil et permet d\'atteindre le live', async () => {
  const dom = installTinyDom();
  const fake = installFakeClock(Date.parse('2026-08-05T09:00:00'));
  const state = seed(dom);

  // Reproduit le chargement réel : app.js s'exécute à l'import (pas
  // d'export à appeler), exactement comme le <script type="module"> de
  // index.html.
  await import(`../js/app.js?t=${Date.now()}-${Math.random()}`);

  assert.ok(byExactText(dom.app, UI.home_settings_link), 'app.js n\'a pas affiché l\'accueil au démarrage');

  const nextCta = byExactText(dom.app, UI.home_next_cta);
  assert.ok(nextCta, 'aucun CTA de prochain départ sur l\'accueil');
  dom.fireEvent(nextCta, 'click');
  assert.ok(byExactText(dom.app, UI.preview_back), 'le clic sur le prochain départ ne mène pas à l\'aperçu');

  const startCta = byExactText(dom.app, UI.preview_cta);
  assert.ok(startCta, 'CTA de lancement de session introuvable sur l\'aperçu');
  dom.fireEvent(startCta, 'click');

  const btn = byClass(dom.app, 'hold-btn');
  assert.ok(btn, 'le direct ne s\'est pas lancé (liveNav mal enregistré par app.js ?)');
  dom.fireEvent(btn, 'pointerdown');
  fake.tick(600);
  assert.notEqual(byClass(dom.app, 't-step')?.textContent, undefined, 'la première étape ne s\'est pas confirmée');
});

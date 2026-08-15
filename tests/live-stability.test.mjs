// J1 étape 9 (S2 §5) · L'écran live se met à jour, il ne se reconstruit
// pas.
//
// Cause racine signalée par Iris : le ticker rappelait renderLive toutes
// les 5 secondes et chaque appel refaisait tout l'arbre jusqu'au
// root.replaceChildren(). Le focus clavier était donc perdu et le curseur
// VoiceOver renvoyé en haut de page toutes les 5 secondes. Les chemins
// clavier et assistif corrigés en J0 restaient inutilisables : atteindre
// le bouton était une course contre l'horloge, et la fenêtre de 8 s du
// chemin assistif n'était qu'un pansement sur ce défaut.
//
// Ces tests portent sur l'IDENTITÉ des nœuds, pas sur leur contenu : c'est
// l'identité qui porte le focus, l'armement du geste et la sélection de
// l'utilisateur. Un test de contenu serait passé au vert sur le code
// fautif.

import test from 'node:test';
import assert from 'node:assert/strict';
import { installTinyDom, byClass, findWhere } from './tiny-dom.mjs';
import { UI } from '../js/copy.js';
import { installFakeClock, resetClock } from '../js/clock.js';
import { defaultState } from '../js/store.js';
import { resetLiveForTests } from '../js/live/controller.js';
import { resetNightForTests } from '../js/night/controller.js';
import { showPreview } from '../js/screens/preview.js';
import { showHome } from '../js/screens/home.js';
import { registerScreens } from '../js/ui/nav.js';
// Auto-enregistrement dans liveNav (S1 §4), comme le fait app.js.
import '../js/live/view.js';
import '../js/live/drawer.js';
import '../js/live/leave.js';
import '../js/night/view.js';

// abortLive() rend la main a l'accueil via le registre de navigation, que
// seul app.js remplit en production (S1 §4). Ce test en a besoin, et de
// lui seul : on n'enregistre donc que ce qu'on exerce.
registerScreens({ home: showHome, preview: showPreview });

test.afterEach(() => { resetClock(); resetLiveForTests(); resetNightForTests(); });

function seed(dom, mutate) {
  const state = defaultState();
  state.onboarded = true;
  if (mutate) mutate(state);
  dom.localStorage.setItem('douce-heure:v1', JSON.stringify(state));
  return state;
}

function reachLive(dom, state) {
  showPreview(state.activeProfileId);
  dom.fireEvent(byClass(dom.app, 'btn--primary'), 'click');
}

const holdBtn = (dom) => byClass(dom.app, 'hold-btn');
const stepLabel = (dom) => byClass(dom.app, 't-step')?.textContent ?? null;
const message = (dom) => byClass(dom.app, 'live-word')?.children
  .find((c) => c.classList?.contains('t-body'))?.textContent ?? null;

// Fait avancer d'une étape par le chemin du maintien, sans raccourci :
// c'est le seul geste qui a le droit de faire avancer quoi que ce soit.
function holdConfirm(dom, fake) {
  const btn = holdBtn(dom);
  dom.fireEvent(btn, 'pointerdown');
  fake.tick(600);
  dom.fireEvent(btn, 'pointerup');
}

test('S2 §5 · le bouton de confirmation n\'est pas remplace pendant 60 s de session', () => {
  const dom = installTinyDom();
  const fake = installFakeClock(Date.parse('2026-08-05T07:00:00'));
  const state = seed(dom);
  reachLive(dom, state);

  const btn = holdBtn(dom);
  assert.ok(btn, 'aucun bouton de confirmation apres le lancement de la session');

  // Douze battements du ticker (5 s chacun) : sur le code d'avant, douze
  // reconstructions completes de l'arbre.
  for (let i = 0; i < 12; i++) fake.tick(5000);

  assert.equal(holdBtn(dom), btn,
    'le bouton de confirmation a ete remplace par le ticker : le focus clavier et le curseur VoiceOver repartent en haut de page');
});

test('S2 §5 · le focus pose sur le bouton survit au ticker', () => {
  const dom = installTinyDom();
  const fake = installFakeClock(Date.parse('2026-08-05T07:00:00'));
  const state = seed(dom);
  reachLive(dom, state);

  const btn = holdBtn(dom);
  btn.focus();
  assert.equal(dom.document.activeElement, btn);

  for (let i = 0; i < 6; i++) fake.tick(5000);

  assert.equal(dom.document.activeElement, btn,
    'le focus a ete perdu : atteindre le bouton redevient une course contre l\'horloge');
});

test('S2 §5 · l\'armement du chemin assistif survit au ticker au-dela de 8 s', () => {
  const dom = installTinyDom();
  const fake = installFakeClock(Date.parse('2026-08-05T07:00:00'));
  const state = seed(dom);
  reachLive(dom, state);

  const first = stepLabel(dom);
  const btn = holdBtn(dom);

  // Premiere activation atomique : arme, ne confirme pas (R2).
  dom.fireEvent(btn, 'click');
  assert.equal(stepLabel(dom), first, 'une activation isolee ne doit rien faire avancer');
  assert.ok(btn.classList.contains('is-armed'), 'la premiere activation doit armer visiblement');

  // Un battement du ticker passe. Sur le code d'avant, le bouton arme
  // etait remplace par un bouton neuf, donc desarme sans que l'utilisateur
  // l'ait demande.
  fake.tick(5000);
  assert.equal(holdBtn(dom), btn, 'le bouton arme a ete remplace');
  assert.ok(btn.classList.contains('is-armed'), 'l\'armement a ete perdu au battement du ticker');
});

test('S2 §5 · le message d\'une etape ne change pas entre deux battements', () => {
  const dom = installTinyDom();
  const fake = installFakeClock(Date.parse('2026-08-05T07:00:00'));
  const state = seed(dom);
  reachLive(dom, state);

  const first = message(dom);
  assert.ok(first, 'aucun message affiche');
  for (let i = 0; i < 8; i++) {
    fake.tick(5000);
    assert.equal(message(dom), first,
      'le message a ete retire au sort a nouveau : les phrases alternent sous les yeux de l\'utilisateur');
  }
});

test('S2 §5 · le message de suggestion est tire une fois, pas a chaque battement', () => {
  const dom = installTinyDom();
  const fake = installFakeClock(Date.parse('2026-08-05T07:00:00'));
  const state = seed(dom);
  reachLive(dom, state);

  // Assez de temps pour que l'etape courante passe en "suggested"
  // (elapsed >= duree prevue), sans jamais confirmer : l'etape ne doit pas
  // bouger pour autant (R2).
  const before = stepLabel(dom);
  for (let i = 0; i < 12; i++) fake.tick(5000);
  assert.equal(stepLabel(dom), before, 'le temps qui passe ne fait pas avancer l\'etape (R2)');

  const suggestedMsg = message(dom);
  for (let i = 0; i < 6; i++) {
    fake.tick(5000);
    assert.equal(message(dom), suggestedMsg, 'le message de suggestion doit rester stable');
  }
});

test('S2 §5 · le libelle du bouton suit l\'etape sans que le bouton change de nœud', () => {
  const dom = installTinyDom();
  const fake = installFakeClock(Date.parse('2026-08-05T07:00:00'));
  const state = seed(dom);
  reachLive(dom, state);

  const btn = holdBtn(dom);
  const labelNode = byClass(btn, 'hold-btn__label');
  const before = labelNode.textContent;
  const firstStep = stepLabel(dom);

  holdConfirm(dom, fake);

  assert.notEqual(stepLabel(dom), firstStep, 'la confirmation doit avoir fait avancer l\'etape');
  assert.equal(holdBtn(dom), btn, 'le bouton doit garder son identite d\'une etape a l\'autre');
  assert.equal(byClass(btn, 'hold-btn__label'), labelNode, 'le libelle doit etre reecrit, pas remplace');
  assert.notEqual(labelNode.textContent, before, 'le libelle doit suivre la nouvelle etape');
  assert.equal(btn.getAttribute('aria-label'), labelNode.textContent,
    'le nom accessible doit suivre le libelle visible, sinon la voix annonce l\'etape precedente');
});

test('S2 §5 · quitter le live puis en relancer un remonte un ecran neuf', () => {
  const dom = installTinyDom();
  const fake = installFakeClock(Date.parse('2026-08-05T07:00:00'));
  const state = seed(dom);

  reachLive(dom, state);
  const firstBtn = holdBtn(dom);
  fake.tick(5000);

  // Sortie de session par le bouton de renoncement de l'ecran live (le
  // second des deux liens de bas d'ecran, apres "La suite").
  const quit = byClass(dom.app, 'live-bottom-links').children[1];
  dom.fireEvent(quit, 'click');
  assert.equal(holdBtn(dom), null, 'la session quittee ne doit plus afficher de bouton de confirmation');

  // Une nouvelle session ne doit jamais reutiliser le montage de la
  // precedente : ce serait un ecran mort, branche sur un etat disparu.
  reachLive(dom, seed(dom));
  const secondBtn = holdBtn(dom);
  assert.ok(secondBtn, 'la nouvelle session doit monter un ecran live');
  assert.notEqual(secondBtn, firstBtn, 'le montage de la session precedente a ete reutilise');
});

// ─── J4 (S5 article 5) · Le geste s'entend ────────────────────────

const liveRegion = (dom) => findWhere(dom.document.body, (n) => n.getAttribute?.('id') === 'live-region');

test('S5 §6 · l\'etat arme est annonce, pas seulement affiche', () => {
  const dom = installTinyDom();
  installFakeClock(Date.parse('2026-08-05T07:00:00'));
  const state = seed(dom);
  reachLive(dom, state);

  const btn = holdBtn(dom);
  dom.fireEvent(btn, 'click'); // premiere activation atomique : arme

  assert.ok(btn.classList.contains('is-armed'), 'l\'etat arme doit se voir');
  assert.equal(liveRegion(dom)?.textContent, UI.gesture_armed,
    'sans annonce, une personne sous VoiceOver active, n\'obtient rien, et ne sait pas que l\'app attend');
});

test('S5 §6 · un appui interrompu se dit, il ne se devine pas', () => {
  const dom = installTinyDom();
  const fake = installFakeClock(Date.parse('2026-08-05T07:00:00'));
  const state = seed(dom);
  reachLive(dom, state);

  const btn = holdBtn(dom);
  const before = stepLabel(dom);
  dom.fireEvent(btn, 'pointerdown');
  fake.tick(200); // relache bien avant les 600 ms
  dom.fireEvent(btn, 'pointerup');

  assert.equal(stepLabel(dom), before, 'un appui interrompu n\'avance rien (R2)');
  assert.equal(liveRegion(dom)?.textContent, UI.gesture_released,
    'sans cette annonce, on ne distingue pas "j\'ai relache trop tot" de "l\'app ne repond pas"');
});

test('S5 §6 · le bouton porte l\'indice d\'activation en deux temps', () => {
  const dom = installTinyDom();
  installFakeClock(Date.parse('2026-08-05T07:00:00'));
  const state = seed(dom);
  reachLive(dom, state);
  assert.equal(holdBtn(dom).getAttribute('aria-description'), UI.gesture_assist_hint,
    'l\'indice doit etre disponible AVANT le premier essai, pas apres coup');
});

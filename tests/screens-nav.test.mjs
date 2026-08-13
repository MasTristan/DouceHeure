// J1 découpe étape 6 · Les huit écrans plats naviguent désormais entre eux
// exclusivement via le registre ui/nav.js (jamais d'import direct d'un
// screens/*.js vers un autre, cf. app.js). Un nom mal orthographié dans un
// nav.xxx() ne casse rien à l'analyse statique (nav est un objet ordinaire)
// et ne se verrait qu'au clic, en production. Ce fichier clique réellement
// à travers les écrans pour vérifier que chaque lien de navigation atterrit
// bien où il doit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installTinyDom, byClass, byExactText } from './tiny-dom.mjs';
import { installFakeClock, resetClock } from '../js/clock.js';
import { defaultState } from '../js/store.js';
import { UI } from '../js/copy.js';
import { resetLiveForTests } from '../js/live/controller.js';
import { resetNightForTests } from '../js/night/controller.js';

test.afterEach(() => { resetClock(); resetLiveForTests(); resetNightForTests(); });

async function importFreshApp() {
  // Chaque écran plat appelle nav.xxx() (ui/nav.js) pour naviguer vers un
  // autre écran plat : sans l'enregistrement que app.js fait au démarrage
  // réel, ces appels échoueraient (nav.xxx is not a function). On reproduit
  // ici uniquement ce enregistrement, pas le reste du démarrage de app.js
  // (service worker, canvas de scène, pont Raccourcis F8 : hors périmètre
  // de ce test et non pertinents dans le DOM factice).
  const ui = await import(`../js/ui.js?t=${Date.now()}-${Math.random()}`);
  const { registerScreens } = await import('../js/ui/nav.js');
  registerScreens({
    home: ui.showHome, trip: ui.showTrip, feedback: ui.showFeedback, preview: ui.showPreview,
    mornings: ui.showMornings, settings: ui.showSettings, social: ui.showSocial,
  });
  return ui;
}

function seed(dom) {
  const state = defaultState();
  state.onboarded = true;
  dom.localStorage.setItem('douce-heure:v1', JSON.stringify(state));
  return state;
}

test('accueil -> mes matins -> accueil', async () => {
  const dom = installTinyDom();
  installFakeClock(Date.parse('2026-08-05T09:00:00'));
  seed(dom);
  const ui = await importFreshApp();
  ui.showHome();

  const morningsLink = byExactText(dom.app, UI.home_mornings_link);
  assert.ok(morningsLink, 'lien "mes matins" introuvable sur l\'accueil');
  dom.fireEvent(morningsLink, 'click');
  assert.ok(byExactText(dom.app, UI.mornings_back), 'l\'écran mes matins n\'est pas apparu');

  dom.fireEvent(byExactText(dom.app, UI.mornings_back), 'click');
  assert.ok(byExactText(dom.app, UI.home_mornings_link), 'le retour depuis mes matins ne ramène pas à l\'accueil');
});

test('accueil -> reglages -> mes proches -> reglages -> accueil', async () => {
  const dom = installTinyDom();
  installFakeClock(Date.parse('2026-08-05T09:00:00'));
  seed(dom);
  const ui = await importFreshApp();
  ui.showHome();

  const settingsLink = byExactText(dom.app, UI.home_settings_link);
  dom.fireEvent(settingsLink, 'click');
  assert.ok(byExactText(dom.app, UI.settings_title), 'l\'écran réglages n\'est pas apparu');

  const contactsBtn = byExactText(dom.app, UI.settings_contacts);
  dom.fireEvent(contactsBtn, 'click');
  assert.ok(byExactText(dom.app, UI.social_title), 'l\'écran mes proches n\'est pas apparu');

  // Le topbar de mes proches ramène aux réglages (pas à l'accueil).
  const backFromSocial = byClass(dom.app, 'studio-back-btn');
  assert.ok(backFromSocial, 'bouton de retour introuvable sur mes proches');
  dom.fireEvent(backFromSocial, 'click');
  assert.ok(byExactText(dom.app, UI.settings_title), 'le retour depuis mes proches ne ramène pas aux réglages');

  dom.fireEvent(byExactText(dom.app, UI.settings_back), 'click');
  assert.ok(byExactText(dom.app, UI.home_settings_link), 'le retour depuis les réglages ne ramène pas à l\'accueil');
});

test('accueil -> apercu -> accueil (bouton retour)', async () => {
  const dom = installTinyDom();
  installFakeClock(Date.parse('2026-08-05T09:00:00'));
  const state = seed(dom);
  const ui = await importFreshApp();
  ui.showPreview(state.activeProfileId);
  assert.ok(byExactText(dom.app, UI.preview_back), 'l\'écran aperçu n\'est pas apparu');

  dom.fireEvent(byExactText(dom.app, UI.preview_back), 'click');
  assert.ok(byExactText(dom.app, UI.home_settings_link), 'le retour depuis l\'aperçu ne ramène pas à l\'accueil');
});

test('onboarding termine -> accueil', async () => {
  const dom = installTinyDom();
  installFakeClock(Date.parse('2026-08-05T09:00:00'));
  const state = defaultState();
  state.onboarded = false;
  dom.localStorage.setItem('douce-heure:v1', JSON.stringify(state));
  const ui = await importFreshApp();
  ui.showOnboarding();

  // Ecran 1 "passer" saute directement a l'accueil.
  const skipBtn = byExactText(dom.app, UI.ob_skip);
  assert.ok(skipBtn, 'bouton "passer" introuvable sur l\'onboarding');
  dom.fireEvent(skipBtn, 'click');
  assert.ok(byExactText(dom.app, UI.home_settings_link), 'la fin de l\'onboarding ne ramène pas à l\'accueil');
});

// J1 étape 4 (préalable) · Nour (R1, §1.6) : startLive() et startNight()
// n'avaient aucune garde contre un double appel. Deux taps rapides sur le
// CTA de l'Aperçu créent deux clock.setInterval(renderLive, 5000) : le
// second écrase la référence liveTicker du premier dans stopLiveSession(),
// qui ne peut alors plus jamais être nettoyé. Même schéma dans
// startNight(). Corrigé en gardant chaque fonction contre un second appel
// tant qu'une session est déjà active.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installTinyDom, byClass } from './tiny-dom.mjs';
import { installFakeClock, resetClock } from '../js/clock.js';
import { defaultState } from '../js/store.js';
import { resetLiveForTests } from '../js/live/controller.js';
import { resetNightForTests } from '../js/night/controller.js';
import { showPreview } from '../js/screens/preview.js';
import { showBedsideSetup } from '../js/night/setup.js';
// Auto-enregistrement dans liveNav/nightNav (S1 §4) : en production, seul
// app.js importe ces modules pour cet effet de bord. Sans cet import ici,
// startLive()/startNight() plantent au premier appel à
// liveNav.renderLive()/nightNav.renderNight() (jamais défini).
import '../js/live/view.js';
import '../js/live/drawer.js';
import '../js/live/leave.js';
import '../js/night/view.js';

// live/controller.js et night/controller.js sont des singletons : sans ce
// reset, une session laissée ouverte par un cas de test bloquerait
// silencieusement le suivant (cf. leur commentaire sur
// resetLiveForTests/resetNightForTests).
test.afterEach(() => { resetClock(); resetLiveForTests(); resetNightForTests(); });

function seed(dom, mutate) {
  const state = defaultState();
  state.onboarded = true;
  if (mutate) mutate(state);
  dom.localStorage.setItem('douce-heure:v1', JSON.stringify(state));
  return state;
}

test('startLive : un double tap sur le CTA ne cree pas un second ticker fantome', async () => {
  const dom = installTinyDom();
  const fake = installFakeClock(Date.parse('2026-08-05T07:00:00'));
  const state = seed(dom);
  showPreview(state.activeProfileId);

  const cta = byClass(dom.app, 'btn--primary');
  dom.fireEvent(cta, 'click'); // premier tap : demarre la session
  dom.fireEvent(cta, 'click'); // second tap rapide sur le MEME bouton avant tout re-rendu

  // Un seul minuteur (le ticker du live) doit etre en attente : si le bug
  // existe, il y en a deux, et un seul sera jamais nettoye par
  // stopLiveSession() (qui n'a qu'une seule variable liveTicker).
  assert.equal(fake.pendingCount(), 1, 'plus d\'un minuteur en attente : le ticker fuit');
});

test('startNight : un double tap sur "Bonne nuit" ne cree pas un second ticker fantome', async () => {
  const dom = installTinyDom();
  const fake = installFakeClock(Date.parse('2026-08-05T06:40:00'));
  const state = seed(dom, (s) => {
    s.bedside = { wakeTime: '07:00', profileId: s.activeProfileId, lightLeadMin: 10, sound: false };
  });
  showBedsideSetup();

  const cta = byClass(dom.app, 'btn--primary');
  dom.fireEvent(cta, 'click');
  dom.fireEvent(cta, 'click');

  assert.equal(fake.pendingCount(), 1, 'plus d\'un minuteur en attente : le ticker de nuit fuit');
});

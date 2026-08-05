// S1 étape 2 · Harnais anti bug de la douche. C'est le test le plus
// important du projet (CLAUDE.md §6) et, avant ce fichier, rien ne le
// vérifiait automatiquement : R2 n'était couverte par aucune machine
// (constat de Milo, R1). Pilote js/ui.js réel, non modifié dans sa
// décision d'avancement, via tests/tiny-dom.mjs et une horloge factice
// (js/clock.js, ADR-004).
//
// L'invariant à protéger, mot pour mot (CLAUDE.md §6) : « l'horloge sert
// UNIQUEMENT à savoir si on est dans les temps. Elle ne change JAMAIS
// l'étape courante. Seul un geste de confirmation accompli avance. »
import test from 'node:test';
import assert from 'node:assert/strict';
import { installTinyDom, byClass } from './tiny-dom.mjs';
import { installFakeClock, resetClock } from '../js/clock.js';
import { defaultState } from '../js/store.js';
import { resetLiveForTests } from '../js/live/controller.js';

// live/controller.js est importé de façon statique par ui.js (jamais
// réinstancié malgré le suffixe de requête ci-dessous, cf. son commentaire
// sur resetLiveForTests) : sans ce reset, une session laissée ouverte par
// un cas de test bloquerait silencieusement le suivant.
test.afterEach(() => { resetClock(); resetLiveForTests(); });

async function importFreshUi() {
  return import(`../js/ui.js?t=${Date.now()}-${Math.random()}`);
}

function seed(dom, mutate) {
  const state = defaultState();
  state.onboarded = true;
  if (mutate) mutate(state);
  dom.localStorage.setItem('douce-heure:v1', JSON.stringify(state));
  return state;
}

function currentStepLabel(dom) {
  return byClass(dom.app, 't-step')?.textContent ?? null;
}
function holdBtn(dom) {
  return byClass(dom.app, 'hold-btn');
}

// Amène l'app jusqu'à l'écran live, prête à confirmer la première étape.
async function reachLive(dom, state) {
  const ui = await importFreshUi();
  ui.showPreview(state.activeProfileId);
  const cta = byClass(dom.app, 'btn--primary');
  dom.fireEvent(cta, 'click');
  return ui;
}

// ─── 1. Geste accompli ──────────────────────────────────────────

test('R2 · geste accompli (maintien 600ms) fait avancer d\'exactement une étape', async () => {
  const dom = installTinyDom();
  const fake = installFakeClock(Date.parse('2026-08-05T07:00:00'));
  const state = seed(dom);
  await reachLive(dom, state);

  const first = currentStepLabel(dom);
  assert.ok(first, 'aucune étape affichée après le lancement de la session');

  const btn = holdBtn(dom);
  dom.fireEvent(btn, 'pointerdown');
  fake.tick(600);

  const second = currentStepLabel(dom);
  assert.notEqual(second, first, 'le maintien de 600 ms n\'a pas fait avancer l\'étape');
});

// ─── 2. Geste interrompu ────────────────────────────────────────

test('R2 · un appui relâché avant 600ms n\'avance rien (R3 : n\'écrit rien non plus)', async () => {
  const dom = installTinyDom();
  const fake = installFakeClock(Date.parse('2026-08-05T07:00:00'));
  const state = seed(dom);
  await reachLive(dom, state);

  const before = currentStepLabel(dom);
  const btn = holdBtn(dom);
  dom.fireEvent(btn, 'pointerdown');
  fake.tick(300); // moins que HOLD_MS
  dom.fireEvent(btn, 'pointerup');
  fake.tick(1000); // largement au-delà de 600ms, mais après le relâchement

  assert.equal(currentStepLabel(dom), before, 'un appui interrompu a fait avancer l\'étape');
});

// ─── 3. Geste annulé (pointercancel) ────────────────────────────

test('R2 · un pointercancel avant 600ms n\'avance rien', async () => {
  const dom = installTinyDom();
  const fake = installFakeClock(Date.parse('2026-08-05T07:00:00'));
  const state = seed(dom);
  await reachLive(dom, state);

  const before = currentStepLabel(dom);
  const btn = holdBtn(dom);
  dom.fireEvent(btn, 'pointerdown');
  fake.tick(400);
  dom.fireEvent(btn, 'pointercancel');
  fake.tick(1000);

  assert.equal(currentStepLabel(dom), before, 'un pointercancel a quand meme fait avancer l\'étape');
});

// ─── 4. Le temps qui passe sans geste : le harnais anti bug de la douche ──

test('R2 · bug de la douche : le temps qui passe seul ne fait JAMAIS avancer l\'étape courante', async () => {
  const dom = installTinyDom();
  const fake = installFakeClock(Date.parse('2026-08-05T07:00:00'));
  const state = seed(dom);
  await reachLive(dom, state);

  const before = currentStepLabel(dom);

  // Le ticker du live (clock.setInterval(renderLive, 5000)) tourne pendant
  // 45 minutes simulées, largement au-delà de la durée de n'importe quelle
  // étape (douche comprise), sans qu'aucun geste ne soit joué.
  fake.tick(45 * 60000);

  assert.equal(
    currentStepLabel(dom), before,
    'BUG DE LA DOUCHE REPRODUIT : l\'étape a avancé sans confirmation, uniquement parce que le temps a passé'
  );

  // Et l'étape avance normalement si, après cette attente, un geste a
  // effectivement lieu : le temps qui passe n'a pas non plus "cassé" le
  // mécanisme de confirmation.
  const btn = holdBtn(dom);
  dom.fireEvent(btn, 'pointerdown');
  fake.tick(600);
  assert.notEqual(currentStepLabel(dom), before, 'le geste normal n\'avance plus après une longue attente');
});

test('R2 · bug de la douche, variante clavier : une touche maintenue tres longtemps sans repeat spam n\'avance qu\'une fois', async () => {
  const dom = installTinyDom();
  const fake = installFakeClock(Date.parse('2026-08-05T07:00:00'));
  const state = seed(dom);
  await reachLive(dom, state);
  const before = currentStepLabel(dom);

  const btn = holdBtn(dom);
  dom.fireEvent(btn, 'keydown', { key: ' ', repeat: false });
  // Simule une tres longue attente AVANT que le minuteur clavier n'expire
  // (impossible en pratique puisqu'il expire a 600ms, mais on verifie que
  // le systeme ne « rattrape » pas plusieurs avances si le tick est en retard).
  fake.tick(600);
  const afterOne = currentStepLabel(dom);
  assert.notEqual(afterOne, before);

  // Puis un tres long silence : aucune avance supplementaire.
  fake.tick(60 * 60000);
  assert.equal(currentStepLabel(dom), afterOne, 'le silence apres une confirmation a fait avancer une deuxieme fois');
});

// ─── 5. Réveil : l'aube ne lance jamais le direct ───────────────

test('R2 · réveil : l\'aube logicielle ne lance jamais le direct, seul un geste tenu confirme le lever', async () => {
  const dom = installTinyDom();
  const wakeTs = Date.parse('2026-08-05T07:00:00');
  const fake = installFakeClock(wakeTs - 20 * 60000); // 20 min avant le reveil
  const state = seed(dom, (s) => {
    s.bedside = { wakeTime: '07:00', profileId: s.activeProfileId, lightLeadMin: 10, sound: false };
  });
  const ui = await importFreshUi();

  ui.showBedsideSetup();
  const cta = byClass(dom.app, 'btn--primary');
  dom.fireEvent(cta, 'click'); // "Bonne nuit" : arme le chevet, lance la nuit

  // La nuit avance de 30 minutes simulees (largement au-dela de l'heure de
  // reveil et de l'aube) via le seul ticker du chevet, sans aucun geste.
  fake.tick(30 * 60000);

  // On ne doit JAMAIS se retrouver sur l'ecran live : ni t-step (etape en
  // cours), ni hold-btn portant le libelle d'une etape de preparation.
  assert.equal(byClass(dom.app, 't-step'), null, 'le direct a demarre tout seul au reveil');

  // On doit etre sur l'ecran de proposition de reveil (ou son eventuel
  // relance apres re-proposition), qui exige un geste tenu explicite.
  const wakingScreen = byClass(dom.app, 'screen--waking');
  assert.ok(wakingScreen, 'l\'ecran de proposition de reveil n\'est pas affiche apres l\'aube');

  // Meme une fois le geste de reveil confirme, la session live n'est PAS
  // lancee automatiquement : l'ecran "bonjour" exige un tap supplementaire
  // explicite (bedside_morning_cta) avant d'atteindre l'Apercu puis le direct.
  const wakeBtn = wakingScreen;
  dom.fireEvent(wakeBtn, 'pointerdown');
  fake.tick(600);
  assert.equal(byClass(dom.app, 't-step'), null, 'le reveil confirme a lance le direct sans le tap supplementaire');
});

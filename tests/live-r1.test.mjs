// S1 étape 2 · R1 dans le DOM RENDU, pas seulement dans les chaînes sources
// de copy.js. Milo (R1) : environ 49 littéraux français vivent hors de
// copy.js et n'ont jamais été inspectés par tests/copy.test.mjs, qui ne lit
// que COPY et UI. Ce fichier lit ce que l'utilisateur voit réellement à
// l'écran, écran par écran, à plusieurs instants (dont l'état "suggested"
// et "nudge" où une régression de type compte à rebours serait la plus
// tentante à introduire).
import test from 'node:test';
import assert from 'node:assert/strict';
import { installTinyDom, allText, byClass } from './tiny-dom.mjs';
import { installFakeClock, resetClock } from '../js/clock.js';
import { defaultState } from '../js/store.js';
import { resetLiveForTests } from '../js/live/controller.js';

// live/controller.js est importé de façon statique par ui.js (jamais
// réinstancié malgré le suffixe de requête ci-dessous, cf. son commentaire
// sur resetLiveForTests) : sans ce reset, une session laissée ouverte par
// un cas de test bloquerait silencieusement le suivant.
test.afterEach(() => { resetClock(); resetLiveForTests(); });

// Même liste que tests/copy.test.mjs (R1), appliquée ici au texte rendu.
const FORBIDDEN = [
  /il (te )?reste/i,
  /min(utes)? restantes?/i,
  /compte [aà] rebours/i,
  /encore \d+ ?min/i,
  /dans \d+ ?min/i,
  /\d+ ?min(utes)? de retard/i,
  /retard de \d+/i,
  /tu as perdu/i,
];

function assertClean(text, where) {
  for (const re of FORBIDDEN) {
    assert.ok(!re.test(text), `${where} contient une formulation interdite (${re}) : "${text}"`);
  }
}

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

test('R1 · l\'Aperçu ne contient aucune formulation interdite', async () => {
  const dom = installTinyDom();
  installFakeClock(Date.parse('2026-08-05T07:00:00'));
  const state = seed(dom);
  const ui = await importFreshUi();
  ui.showPreview(state.activeProfileId);
  assertClean(allText(dom.app), 'Aperçu');
});

test('R1 · l\'écran live ne contient aucune formulation interdite, à l\'état normal', async () => {
  const dom = installTinyDom();
  installFakeClock(Date.parse('2026-08-05T07:00:00'));
  const state = seed(dom);
  const ui = await importFreshUi();
  ui.showPreview(state.activeProfileId);
  const cta = byClass(dom.app, 'btn--primary');
  dom.fireEvent(cta, 'click');
  assertClean(allText(dom.app), 'live (état normal)');
});

test('R1 · l\'écran live ne contient aucune formulation interdite à l\'état "suggested"', async () => {
  const dom = installTinyDom();
  const fake = installFakeClock(Date.parse('2026-08-05T07:00:00'));
  const state = seed(dom);
  const ui = await importFreshUi();
  ui.showPreview(state.activeProfileId);
  dom.fireEvent(byClass(dom.app, 'btn--primary'), 'click');

  // L'étape "wakeup" par défaut dure 5 min (store.js DEFAULT_STEPS) : on
  // dépasse largement pour forcer l'état "suggested" affiché par renderLive.
  fake.tick(6 * 60000);
  assertClean(allText(dom.app), 'live (état "suggested", 6 min ecoulees sur une etape de 5)');
});

test('R1 · l\'écran live ne contient aucune formulation interdite à l\'état "nudge"', async () => {
  const dom = installTinyDom();
  const fake = installFakeClock(Date.parse('2026-08-05T07:00:00'));
  const state = seed(dom);
  const ui = await importFreshUi();
  ui.showPreview(state.activeProfileId);
  dom.fireEvent(byClass(dom.app, 'btn--primary'), 'click');

  // nudgeThreshold = max(dur*1.6, dur+4) ; pour dur=5, seuil = 9 min.
  fake.tick(15 * 60000);
  assertClean(allText(dom.app), 'live (état "nudge", tres en retard sur l\'etape)');
});

test('R1 · l\'écran de départ (leave) ne contient aucune formulation interdite', async () => {
  const dom = installTinyDom();
  const fake = installFakeClock(Date.parse('2026-08-05T07:00:00'));
  const state = seed(dom);
  const ui = await importFreshUi();
  ui.showPreview(state.activeProfileId);
  dom.fireEvent(byClass(dom.app, 'btn--primary'), 'click');

  // Confirme toutes les étapes jusqu'au départ.
  for (let i = 0; i < state.profiles.find((p) => p.id === state.activeProfileId).steps.length + 1; i++) {
    const btn = byClass(dom.app, 'hold-btn');
    if (!btn) break;
    dom.fireEvent(btn, 'pointerdown');
    fake.tick(700);
  }
  assertClean(allText(dom.app), 'écran de départ');
});

test('R1 · le mode chevet (nuit, proposition de réveil) ne contient aucune formulation interdite', async () => {
  const dom = installTinyDom();
  const wakeTs = Date.parse('2026-08-05T07:00:00');
  const fake = installFakeClock(wakeTs - 20 * 60000);
  const state = seed(dom, (s) => {
    s.bedside = { wakeTime: '07:00', profileId: s.activeProfileId, lightLeadMin: 10, sound: false };
  });
  const ui = await importFreshUi();
  ui.showBedsideSetup();
  dom.fireEvent(byClass(dom.app, 'btn--primary'), 'click');

  assertClean(allText(dom.app), 'chevet (nuit, avant l\'aube)');
  fake.tick(15 * 60000); // franchit l'aube et l'heure de reveil
  assertClean(allText(dom.app), 'chevet (proposition de réveil)');
});

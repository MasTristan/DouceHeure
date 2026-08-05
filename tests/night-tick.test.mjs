// J1 découpe étape 5 · night/controller.js::nightTick() ne doit démarrer la
// sonnerie (startRinging) qu'une seule fois par réveil, et ne doit jamais
// toucher une session live (elle n'en connaît même pas l'existence : les
// deux sous-systèmes sont indépendants, cf. CLAUDE.md §6 "Scène Nuit par
// l'horloge").
import test from 'node:test';
import assert from 'node:assert/strict';
import { installTinyDom, byClass } from './tiny-dom.mjs';
import { installFakeClock, resetClock } from '../js/clock.js';
import { defaultState } from '../js/store.js';
import { resetNightForTests } from '../js/night/controller.js';

test.afterEach(() => { resetClock(); resetNightForTests(); });

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

test('nightTick : plusieurs ticks après l\'heure de réveil ne relancent pas la sonnerie et ne touchent jamais le live', async () => {
  const dom = installTinyDom();
  const wakeTs = Date.parse('2026-08-05T07:00:00');
  const fake = installFakeClock(wakeTs - 5 * 60000); // 5 min avant le reveil
  const state = seed(dom, (s) => {
    s.bedside = { wakeTime: '07:00', profileId: s.activeProfileId, lightLeadMin: 10, sound: false };
  });
  const ui = await importFreshUi();
  ui.showBedsideSetup();
  dom.fireEvent(byClass(dom.app, 'btn--primary'), 'click'); // "Bonne nuit"

  // Un seul tick franchit l'heure de réveil : la sonnerie démarre une fois,
  // l'écran de proposition de réveil apparaît.
  fake.tick(6 * 60000);
  const wakingAfterFirst = byClass(dom.app, 'screen--waking');
  assert.ok(wakingAfterFirst, 'l\'écran de proposition de réveil n\'apparaît pas après le premier tick de réveil');

  // Dix ticks supplémentaires, largement après le réveil : la sonnerie ne
  // redémarre jamais une deuxième fois (pas de nouvel écran, pas de retour
  // à l'écran de nuit), et aucune étape de préparation (t-step, propre au
  // live) n'apparaît jamais : les deux sous-systèmes restent indépendants.
  for (let i = 0; i < 10; i++) {
    fake.tick(30000);
    assert.ok(byClass(dom.app, 'screen--waking'), `l'écran de réveil a disparu au tick ${i}`);
    assert.equal(byClass(dom.app, 't-step'), null, `le live est apparu au tick ${i} sans aucun geste`);
  }
});

// night/controller.js est un singleton (import statique de ui.js, jamais
// réinstancié) : ce deuxième cas, dans le même fichier, laisse le premier
// chevet armé sans jamais l'arrêter explicitement. Sans resetNightForTests
// dans test.afterEach, startNight() no-op ici (if (night) return;) et
// l'écran de nuit n'apparaît jamais.
test('un second armement de chevet, dans un autre cas de test, repart bien d\'un état frais', async () => {
  const dom = installTinyDom();
  const fake = installFakeClock(Date.parse('2026-08-05T22:00:00'));
  const state = seed(dom, (s) => {
    s.bedside = { wakeTime: '07:00', profileId: s.activeProfileId, lightLeadMin: 10, sound: false };
  });
  const ui = await importFreshUi();
  ui.showBedsideSetup();
  dom.fireEvent(byClass(dom.app, 'btn--primary'), 'click'); // "Bonne nuit"

  assert.ok(byClass(dom.app, 'screen--night'), 'l\'écran de nuit n\'apparaît pas au second armement de chevet');
  fake.tick(30000);
});

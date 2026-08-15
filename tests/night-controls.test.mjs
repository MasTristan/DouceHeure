// J4 (S5 article 4) · Le mode chevet est actionnable autrement qu'au doigt.
//
// Le défaut que ces tests protègent est le plus dur du produit : une
// personne aveugle pouvait armer le chevet le soir et se retrouver, en
// pleine nuit, devant un écran qui ne lui disait ni l'heure qu'il est, ni
// à quelle heure elle serait réveillée, et dont le seul réglage
// s'obtenait par un glissement de doigt sans équivalent.
//
// Contrairement aux vérifications structurelles de
// confirm-control-wiring, ceux-ci pilotent l'écran réel.

import test from 'node:test';
import assert from 'node:assert/strict';
import { installTinyDom, byClass, findWhere, findAllWhere, allText } from './tiny-dom.mjs';
import { installFakeClock, resetClock } from '../js/clock.js';
import { defaultState } from '../js/store.js';
import { resetNightForTests, startNight } from '../js/night/controller.js';
import { resetLiveForTests } from '../js/live/controller.js';
import { UI } from '../js/copy.js';
import '../js/night/view.js';

test.afterEach(() => { resetClock(); resetNightForTests(); resetLiveForTests(); });

function nightScreen(dom) {
  const state = defaultState();
  state.onboarded = true;
  state.bedside = { wakeTime: '07:00', profileId: state.activeProfileId, lightLeadMin: 20, sound: true };
  dom.localStorage.setItem('douce-heure:v1', JSON.stringify(state));
  startNight(state.bedside);
  return state;
}

const slider = (dom) => findWhere(dom.app, (n) => n.getAttribute?.('role') === 'slider');

test('l\'heure et l\'heure de reveil sont du CONTENU, lisible', () => {
  const dom = installTinyDom();
  installFakeClock(Date.parse('2026-08-05T23:40:00'));
  nightScreen(dom);

  const texte = allText(dom.app);
  assert.match(texte, /23:40/, 'l\'heure courante doit etre lisible');
  assert.match(texte, /07:00/, 'l\'heure de reveil doit etre lisible');

  // Le <main> ne doit pas se declarer bouton : ca masquerait tout ce qui
  // precede aux lecteurs d'ecran.
  const main = findWhere(dom.app, (n) => n.tagName === 'MAIN');
  assert.notEqual(main.getAttribute('role'), 'button',
    'un ecran-bouton n\'expose plus son contenu');
});

test('le reglage de luminosite est focusable, nomme, et annonce sa valeur', () => {
  const dom = installTinyDom();
  installFakeClock(Date.parse('2026-08-05T23:40:00'));
  nightScreen(dom);

  const s = slider(dom);
  assert.ok(s, 'aucun reglage de luminosite atteignable');
  assert.equal(s.getAttribute('tabindex'), '0');
  assert.equal(s.getAttribute('aria-label'), UI.bedside_brightness);
  assert.equal(s.getAttribute('aria-valuemin'), '0');
  assert.equal(s.getAttribute('aria-valuemax'), '100');
  assert.ok(s.getAttribute('aria-valuenow'), 'la valeur courante n\'est pas annoncee');
});

test('les fleches du clavier reglent la luminosite et l\'annonce suit', () => {
  const dom = installTinyDom();
  installFakeClock(Date.parse('2026-08-05T23:40:00'));
  nightScreen(dom);

  const s = slider(dom);
  const before = Number(s.getAttribute('aria-valuenow'));

  // Bas = assombrir. La valeur annoncee doit baisser.
  dom.fireEvent(s, 'keydown', { key: 'ArrowDown' });
  const darker = Number(s.getAttribute('aria-valuenow'));
  assert.ok(darker < before, `la luminosite doit baisser (${before} -> ${darker})`);

  // Le voile a reellement suivi, pas seulement l'annonce.
  const veil = byClass(dom.app, 'night-veil');
  assert.ok(veil.style.background.includes('rgba(0,0,0,'), 'le voile doit etre repeint');

  dom.fireEvent(s, 'keydown', { key: 'ArrowUp' });
  assert.equal(Number(s.getAttribute('aria-valuenow')), before, 'haut doit revenir a la valeur precedente');
});

test('la luminosite reste bornee aux deux extremites', () => {
  const dom = installTinyDom();
  installFakeClock(Date.parse('2026-08-05T23:40:00'));
  nightScreen(dom);
  const s = slider(dom);

  for (let i = 0; i < 40; i++) dom.fireEvent(s, 'keydown', { key: 'ArrowDown' });
  assert.equal(Number(s.getAttribute('aria-valuenow')), 0,
    'au plus sombre, l\'ecran ne doit pas devenir plus noir que noir');

  for (let i = 0; i < 40; i++) dom.fireEvent(s, 'keydown', { key: 'ArrowUp' });
  assert.equal(Number(s.getAttribute('aria-valuenow')), 100,
    'au plus clair, la luminosite plafonne');
});

test('la sortie du chevet a une commande explicite, pas seulement un appui tenu', () => {
  const dom = installTinyDom();
  installFakeClock(Date.parse('2026-08-05T23:40:00'));
  nightScreen(dom);

  const quit = findWhere(dom.app, (n) => n.tagName === 'BUTTON' && n.textContent === UI.bedside_quit_action);
  assert.ok(quit, 'aucune commande de sortie atteignable au clavier ou au lecteur d\'ecran');

  // Elle ouvre la feuille, elle ne quitte pas d'un seul coup : quitter le
  // chevet en pleine nuit est destructeur, ca se confirme (DEC-03).
  dom.fireEvent(quit, 'click');
});

test('les controles n\'ont pas de duree en dur : leurs chaines viennent de copy.js', () => {
  const dom = installTinyDom();
  installFakeClock(Date.parse('2026-08-05T23:40:00'));
  nightScreen(dom);

  const labels = findAllWhere(dom.app, (n) => n.classList.contains('night-control'))
    .map((n) => n.textContent);
  assert.ok(labels.length >= 2, 'les deux controles doivent exister');
  for (const label of labels) {
    assert.ok(
      label.includes(UI.bedside_brightness) || label.includes(UI.bedside_quit_action),
      `chaine hors copy.js : "${label}"`,
    );
  }
});

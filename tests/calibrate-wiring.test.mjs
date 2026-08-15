// J2 · Le calibrage est réellement câblé, et le réglage qu'il remplace a
// bien disparu (DEC-12).
//
// Un module pur et testé qui n'est appelé nulle part ne corrige rien.
// Ces tests pilotent les écrans réels sous tiny-dom.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installTinyDom, byClass, findWhere, findAllWhere } from './tiny-dom.mjs';
import { resetClock } from '../js/clock.js';
import { defaultState, loadState } from '../js/store.js';
import { UI } from '../js/copy.js';
import { showOnboarding } from '../js/screens/onboarding.js';
import { showHome } from '../js/screens/home.js';
import { registerScreens } from '../js/ui/nav.js';

registerScreens({ home: showHome });

test.afterEach(() => { resetClock(); });

function seed(dom) {
  const state = defaultState();
  dom.localStorage.setItem('douce-heure:v1', JSON.stringify(state));
  return state;
}

const timeInputs = (dom) => findAllWhere(dom.app, (n) => n.classList.contains('time-input'));
const byText = (dom, text) => findWhere(dom.app, (n) => n.textContent === text);

// Déroule l'onboarding jusqu'au bout, en renseignant les deux heures
// d'horloge, sans jamais toucher à une durée (il n'y en a plus).
function completeOnboarding(dom, { wake, arrival }) {
  showOnboarding();
  // Écran 1 : prénom, puis Continuer.
  dom.fireEvent(byClass(dom.app, 'btn--primary'), 'click');
  // Écran 2 : lever habituel puis arrivée, dans cet ordre.
  const [wakeInput, arrivalInput] = timeInputs(dom);
  wakeInput.value = wake;
  dom.fireEvent(wakeInput, 'change', { target: { value: wake } });
  arrivalInput.value = arrival;
  dom.fireEvent(arrivalInput, 'change', { target: { value: arrival } });
  dom.fireEvent(byClass(dom.app, 'btn--primary'), 'click');
  // Écran 3 : geste et voix, puis on termine.
  dom.fireEvent(byText(dom, UI.ob3_cta), 'click');
}

test('l\'onboarding demande deux heures d\'horloge, et aucune duree', () => {
  const dom = installTinyDom();
  seed(dom);
  showOnboarding();
  dom.fireEvent(byClass(dom.app, 'btn--primary'), 'click');

  assert.ok(byText(dom, UI.ob2_wake_label), 'l\'heure de lever habituelle doit etre demandee');
  assert.ok(byText(dom, UI.ob2_arrival_label), 'l\'heure d\'arrivee doit etre demandee');
  assert.equal(timeInputs(dom).length, 2, 'deux heures d\'horloge, pas une de plus');

  const sliders = findAllWhere(dom.app, (n) => n.classList.contains('dur-slider'));
  assert.equal(sliders.length, 0, 'aucune duree ne doit etre demandee pendant l\'onboarding');
});

test('l\'onboarding calibre reellement le deroule sur le budget declare', () => {
  const dom = installTinyDom();
  const before = seed(dom);
  const baseTotal = before.profiles
    .find((p) => p.id === before.activeProfileId).steps
    .filter((s) => s.active).reduce((a, s) => a + s.est, 0);

  // Deux heures pleines entre le lever et l'arrivee : nettement plus que
  // le deroule par defaut, donc le calibrage doit l'etirer.
  completeOnboarding(dom, { wake: '07:00', arrival: '09:00' });

  const state = loadState();
  const profile = state.profiles.find((p) => p.id === state.activeProfileId);
  const total = profile.steps.filter((s) => s.active).reduce((a, s) => a + s.est, 0);

  assert.equal(profile.defaults.wakeTime, '07:00', 'l\'heure de lever doit etre retenue pour les recalibrages');
  assert.ok(total > baseTotal,
    `le deroule doit s'etirer au budget observe (avant ${baseTotal}, apres ${total})`);
  assert.ok(profile.steps.every((s) => typeof s.estBase === 'number'),
    'chaque etape doit garder son estimation de reference');
});

test('R3 · l\'onboarding n\'ecrit aucune mesure', () => {
  const dom = installTinyDom();
  seed(dom);
  completeOnboarding(dom, { wake: '06:15', arrival: '09:00' });
  const state = loadState();
  for (const profile of state.profiles) {
    for (const step of profile.steps) {
      assert.deepEqual(step.real, [], 'le calibrage est declaratif : rien ne doit entrer dans step.real');
    }
  }
});

test('un budget plus court que le deroule ne comprime pas le plan', () => {
  const dom = installTinyDom();
  const before = seed(dom);
  const baseTotal = before.profiles
    .find((p) => p.id === before.activeProfileId).steps
    .filter((s) => s.active).reduce((a, s) => a + s.est, 0);

  completeOnboarding(dom, { wake: '08:30', arrival: '09:00' });

  const state = loadState();
  const profile = state.profiles.find((p) => p.id === state.activeProfileId);
  const total = profile.steps.filter((s) => s.active).reduce((a, s) => a + s.est, 0);
  assert.equal(total, baseTotal, 'le plan reste honnete plutot que de presser quelqu\'un (R5)');
});

test('DEC-12 · le reglage de duree par etape a disparu du Studio', () => {
  const src = readFileSync('js/studio.js', 'utf8');
  assert.equal(/dur-slider/.test(src), false,
    'le Studio ne doit plus proposer de regler une duree : c\'est la question a laquelle le public vise ne peut pas repondre');
  assert.match(src, /calibrateSteps\(/,
    'le Studio doit recalibrer sur le lever habituel, sinon la fonctionnalite est simplement perdue');
});

test('DEC-12 · le Studio demande le lever habituel a la place', () => {
  const src = readFileSync('js/studio.js', 'utf8');
  assert.match(src, /UI\.studio_default_wake\b/,
    'le remplacement doit etre atteignable : une question posee, et non N reglages retires sans contrepartie');
});

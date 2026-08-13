// J1 découpe étape 6 · js/learned.js, extrait du rendu de showMornings
// (violait CLAUDE.md §4 : une règle de calcul vivait dans la couche de
// rendu). Fonctions pures : entrées, sortie, aucun DOM, aucune chaîne
// affichée (le rendu compose les phrases via copy.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { learnedSteps, learnedTravels } from '../js/learned.js';
import { defaultState } from '../js/store.js';

function freshState() {
  return defaultState();
}

test('learnedSteps : une etape mesuree moins de 3 fois est ignoree', () => {
  const state = freshState();
  const step = state.profiles[0].steps[0];
  step.real = [{ v: 5, day: 1 }, { v: 6, day: 1 }];
  assert.deepEqual(learnedSteps(state), []);
});

test('learnedSteps : une etape mesuree au moins 3 fois apparait, sans jour lent par defaut', () => {
  const state = freshState();
  const step = state.profiles[0].steps[0];
  step.real = [{ v: 5, day: 1 }, { v: 5, day: 2 }, { v: 5, day: 3 }];
  const out = learnedSteps(state);
  assert.equal(out.length, 1);
  assert.equal(out[0].label, step.label);
  assert.equal(out[0].slowDay, null);
});

test('learnedSteps : un jour ou l\'etape prend nettement plus de temps ressort comme jour lent', () => {
  const state = freshState();
  const step = state.profiles[0].steps[0];
  // Jour 1 : rapide et stable. Jour 3 : nettement plus lent, deux mesures.
  step.real = [
    { v: 5, day: 1 }, { v: 5, day: 1 }, { v: 5, day: 2 },
    { v: 12, day: 3 }, { v: 13, day: 3 },
  ];
  const out = learnedSteps(state);
  assert.equal(out[0].slowDay, 3);
});

test('learnedSteps : un jour lent isole (une seule mesure) ne ressort pas (bruit)', () => {
  const state = freshState();
  const step = state.profiles[0].steps[0];
  step.real = [{ v: 5, day: 1 }, { v: 5, day: 2 }, { v: 30, day: 3 }];
  const out = learnedSteps(state);
  assert.equal(out[0].slowDay, null, 'une seule mesure lente a fait ressortir un jour lent');
});

test('learnedTravels : un trajet mesure moins de 3 fois est ignore', () => {
  const state = freshState();
  state.destinations = [{ id: 'd1', label: 'Bureau', byTransport: { walk: { real: [{ v: 20 }, { v: 22 }] } } }];
  assert.deepEqual(learnedTravels(state), []);
});

test('learnedTravels : un trajet mesure au moins 3 fois apparait avec son transport et sa destination', () => {
  const state = freshState();
  state.destinations = [{
    id: 'd1', label: 'Bureau',
    byTransport: { walk: { real: [{ v: 20 }, { v: 22 }, { v: 19 }] } },
  }];
  const out = learnedTravels(state);
  assert.deepEqual(out, [{ transport: 'walk', destinationLabel: 'Bureau' }]);
});

test('learnedTravels : plusieurs transports pour la meme destination donnent plusieurs entrees', () => {
  const state = freshState();
  state.destinations = [{
    id: 'd1', label: 'Bureau',
    byTransport: {
      walk: { real: [{ v: 20 }, { v: 22 }, { v: 19 }] },
      transit: { real: [{ v: 10 }, { v: 11 }, { v: 12 }] },
    },
  }];
  assert.equal(learnedTravels(state).length, 2);
});

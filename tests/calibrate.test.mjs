// J2 (S3 §2) · Le calibrage par deux heures d'horloge.
//
// Le vice de conception que ces tests protègent : l'app demandait une
// durée à des gens qui ne savent pas évaluer une durée, et bâtissait son
// plan sur la réponse. La règle qui remplace ça tient en une phrase, et
// chaque partie de cette phrase a son test : le déroulé occupe le budget
// observé, uniquement vers le haut, sans jamais rien écrire dans
// step.real.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calibrateSteps, calibrationScale, observedBudget, isBudgetShorterThanPlan,
  baseEst, MAX_SCALE,
} from '../js/calibrate.js';
import { DEFAULT_STEPS, defaultState } from '../js/store.js';
import { TRANSPORT_BUFFER } from '../js/plan.js';

const steps = () => DEFAULT_STEPS.filter((s) => s.active).map((s) => ({ ...s, real: [] }));
const sumEst = (list) => list.filter((s) => s.active).reduce((a, s) => a + s.est, 0);

test('observedBudget : la duree entre le lever et l\'arrivee', () => {
  assert.equal(observedBudget('07:00', '09:00'), 120);
  assert.equal(observedBudget('06:30', '08:15'), 105);
});

test('observedBudget : un depart qui traverse minuit ne rend pas un budget negatif', () => {
  assert.equal(observedBudget('22:00', '00:30'), 150);
});

test('le deroule occupe le budget observe, trajet et transport deduits', () => {
  const list = steps();
  const base = sumEst(list);
  // 120 min entre le lever et l'arrivee, moins 20 de trajet et le buffer
  // de la marche : le budget de preparation vaut 96 min.
  const expected = (120 - 20 - TRANSPORT_BUFFER.walk) / base;
  const scale = calibrationScale({ steps: list, wakeTime: '07:00', arrival: '09:00', travel: 20, transportKey: 'walk' });
  assert.ok(Math.abs(scale - expected) < 1e-9, `echelle ${scale} attendue ${expected}`);

  const calibrated = calibrateSteps(list, { wakeTime: '07:00', arrival: '09:00', travel: 20, transportKey: 'walk' });
  // Arrondi a la minute par etape : on tolere une minute d'ecart par etape.
  assert.ok(Math.abs(sumEst(calibrated) - (120 - 20 - TRANSPORT_BUFFER.walk)) <= calibrated.length);
});

test('jamais vers le bas : un budget trop court garde le deroule honnete', () => {
  const list = steps();
  const before = sumEst(list);
  // 40 minutes en tout : bien moins que le deroule par defaut.
  const calibrated = calibrateSteps(list, { wakeTime: '08:20', arrival: '09:00', travel: 20, transportKey: 'walk' });
  assert.equal(sumEst(calibrated), before,
    'comprimer le plan pour coller a un budget trop court reviendrait a presser quelqu\'un (R5)');
  assert.equal(calibrationScale({ steps: list, wakeTime: '08:20', arrival: '09:00', travel: 20, transportKey: 'walk' }), 1);
});

test('un budget absurde est plafonne plutot que suivi', () => {
  const list = steps();
  const scale = calibrationScale({ steps: list, wakeTime: '02:00', arrival: '09:00', travel: 20, transportKey: 'walk' });
  assert.equal(scale, MAX_SCALE, 'une heure de lever tapee a cote ne doit pas produire un plan de sept heures');
});

test('le calibrage est idempotent : le recalculer ne fait pas deriver le plan', () => {
  const opts = { wakeTime: '06:30', arrival: '09:00', travel: 20, transportKey: 'walk' };
  const once = calibrateSteps(steps(), opts);
  const twice = calibrateSteps(once, opts);
  const thrice = calibrateSteps(twice, opts);
  assert.deepEqual(twice.map((s) => s.est), once.map((s) => s.est));
  assert.deepEqual(thrice.map((s) => s.est), once.map((s) => s.est));
});

test('changer d\'heure de lever recalibre depuis la reference, pas depuis le resultat precedent', () => {
  const tot = { arrival: '09:00', travel: 20, transportKey: 'walk' };
  const tard = calibrateSteps(steps(), { ...tot, wakeTime: '07:30' });
  // On passe par une heure tres matinale, puis on revient a la premiere.
  const detour = calibrateSteps(calibrateSteps(tard, { ...tot, wakeTime: '05:30' }), { ...tot, wakeTime: '07:30' });
  assert.deepEqual(detour.map((s) => s.est), tard.map((s) => s.est),
    'sans estBase, chaque changement d\'heure s\'empilerait sur le precedent');
});

test('estBase est pose au premier calibrage et ne bouge plus', () => {
  const list = steps();
  const original = list.map((s) => s.est);
  const once = calibrateSteps(list, { wakeTime: '06:00', arrival: '09:00', travel: 20, transportKey: 'walk' });
  assert.deepEqual(once.map((s) => s.estBase), original);
  const twice = calibrateSteps(once, { wakeTime: '05:00', arrival: '09:00', travel: 20, transportKey: 'walk' });
  assert.deepEqual(twice.map((s) => s.estBase), original, 'la reference doit survivre a tout recalibrage');
});

test('baseEst : une etape d\'avant J2 utilise son est comme reference', () => {
  assert.equal(baseEst({ est: 15 }), 15);
  assert.equal(baseEst({ est: 29, estBase: 15 }), 15);
});

test('R3 · le calibrage n\'ecrit RIEN dans step.real', () => {
  const list = steps();
  list[1].real.push({ v: 22, day: 1, type: 'work' });
  const calibrated = calibrateSteps(list, { wakeTime: '06:00', arrival: '09:00', travel: 20, transportKey: 'walk' });
  for (const [i, s] of calibrated.entries()) {
    assert.deepEqual(s.real, list[i].real,
      'le calibrage est une meilleure estimation declarative, jamais une mesure fabriquee');
  }
  assert.equal(calibrated[1].real.length, 1);
});

test('les etapes inactives ne sont pas calibrees', () => {
  const list = DEFAULT_STEPS.map((s) => ({ ...s, real: [] }));
  const inactive = list.filter((s) => !s.active);
  assert.ok(inactive.length, 'le jeu de test doit contenir une etape inactive');
  const calibrated = calibrateSteps(list, { wakeTime: '06:00', arrival: '09:00', travel: 20, transportKey: 'walk' });
  for (const s of calibrated.filter((x) => !x.active)) {
    const before = list.find((x) => x.key === s.key);
    assert.equal(s.est, before.est, 'calibrer une etape inactive reviendrait a la compter dans un budget qu\'elle ne consomme pas');
  }
});

test('le calibrage ne modifie pas la liste qu\'on lui donne', () => {
  const list = steps();
  const before = list.map((s) => s.est);
  calibrateSteps(list, { wakeTime: '05:30', arrival: '09:00', travel: 20, transportKey: 'walk' });
  assert.deepEqual(list.map((s) => s.est), before, 'fonction pure : aucune mutation de l\'entree');
});

test('isBudgetShorterThanPlan : vrai seulement quand le budget est plus court', () => {
  const list = steps();
  assert.equal(isBudgetShorterThanPlan({ steps: list, wakeTime: '08:20', arrival: '09:00', travel: 20 }), true);
  assert.equal(isBudgetShorterThanPlan({ steps: list, wakeTime: '07:00', arrival: '09:00', travel: 20 }), false);
});

test('sans heure de lever, rien ne change (etat d\'avant J2)', () => {
  const list = steps();
  const before = list.map((s) => s.est);
  const calibrated = calibrateSteps(list, { wakeTime: null, arrival: '09:00', travel: 20, transportKey: 'walk' });
  assert.deepEqual(calibrated.map((s) => s.est), before);
});

test('le profil par defaut porte un champ wakeTime, a null tant qu\'on n\'a rien demande', () => {
  const state = defaultState();
  for (const p of state.profiles) {
    assert.ok('wakeTime' in p.defaults, 'le calibrage a besoin d\'un endroit ou vivre');
    assert.equal(p.defaults.wakeTime, null);
  }
});

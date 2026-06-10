import test from 'node:test';
import assert from 'node:assert/strict';
import { predict, predictTravel, safetyMargin } from '../js/predict.js';

const ctx = { day: 1, type: 'work' };

test('predict sans mesure : estimation initiale, variance 0, confidence 0', () => {
  const p = predict({ est: 12, real: [] }, ctx);
  assert.deepEqual(p, { dur: 12, variance: 0, confidence: 0 });
});

test('predict converge vers la moyenne réelle avec le nombre de mesures', () => {
  const real = Array.from({ length: 5 }, () => ({ v: 20, day: 1, type: 'work' }));
  const p = predict({ est: 10, real }, ctx);
  assert.equal(p.dur, 20);
  assert.equal(p.confidence, 1);
});

test('predict pondere entre estimation et mesures quand il y en a peu', () => {
  const real = [{ v: 20, day: 1, type: 'work' }, { v: 20, day: 1, type: 'work' }];
  const p = predict({ est: 10, real }, ctx);
  // w = 2/5 -> 10*0.6 + 20*0.4 = 14
  assert.equal(p.dur, 14);
});

test('predict segmente par contexte (jour ou type)', () => {
  const real = [
    { v: 30, day: 1, type: 'work' }, { v: 30, day: 1, type: 'work' },
    { v: 10, day: 6, type: 'other' }, { v: 10, day: 6, type: 'other' },
  ];
  const lundi = predict({ est: 20, real }, { day: 1, type: 'work' });
  const samedi = predict({ est: 20, real }, { day: 6, type: 'other' });
  assert.ok(lundi.dur > samedi.dur);
});

test('predictTravel sans mesure : fallback declaratif, confidence 0', () => {
  const p = predictTravel(null, 'bike', ctx, 25);
  assert.deepEqual(p, { dur: 25, variance: 0, confidence: 0 });
  const p2 = predictTravel({ byTransport: {} }, 'bike', ctx, 25);
  assert.equal(p2.confidence, 0);
});

test('predictTravel apprend des trajets reels, segmente par transport', () => {
  const dest = {
    byTransport: {
      bike: { real: Array.from({ length: 5 }, () => ({ v: 18, day: 1 })) },
      car: { real: [{ v: 40, day: 1 }] },
    },
  };
  const bike = predictTravel(dest, 'bike', ctx, 30);
  assert.equal(bike.dur, 18);
  assert.equal(bike.confidence, 1);
  const transit = predictTravel(dest, 'transit', ctx, 30);
  assert.equal(transit.confidence, 0);
});

test('safetyMargin : formule verrouillee', () => {
  assert.equal(safetyMargin(0, 0), 3);
  assert.equal(safetyMargin(5, 0.5), Math.round(3 + 4 + 4));
  // Composante variance plafonnee a 10
  assert.equal(safetyMargin(100, 0), 13);
});

test('safetyMargin : le boost destination inconnue reste plafonne', () => {
  // boost 1.5 mais min(.., 10) tient toujours
  assert.equal(safetyMargin(100, 0, 1.5), 13);
  assert.equal(safetyMargin(5, 0, 1.5), Math.round(3 + 6));
});

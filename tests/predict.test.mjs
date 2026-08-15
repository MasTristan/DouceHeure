import test from 'node:test';
import assert from 'node:assert/strict';
import { predict, predictTravel, safetyMargin, PRIOR_SPREAD_RATIO } from '../js/predict.js';

const ctx = { day: 1, type: 'work' };

// J3 article 2 · Le contrat a changé, volontairement. Avant, `predict`
// sans mesure rendait variance 0, donc la marge était MINIMALE au moment
// où l'app est la plus ignorante : 7 minutes au premier matin. L'ignorance
// s'exprime maintenant comme une dispersion a priori.
test('predict sans mesure : estimation initiale, et une dispersion a priori NON nulle', () => {
  const p = predict({ est: 12, real: [] }, ctx);
  assert.equal(p.dur, 12);
  assert.equal(p.confidence, 0);
  assert.equal(p.variance, 12 * PRIOR_SPREAD_RATIO);
  assert.ok(p.variance > 0,
    'une marge minimale au moment de l\'ignorance maximale est exactement le defaut que J3 corrige');
});

test('la dispersion a priori decroit a mesure que la confiance monte', () => {
  const step = (n) => ({ est: 20, real: Array.from({ length: n }, () => ({ v: 20, day: 1, type: 'work' })) });
  // Mesures parfaitement constantes : toute la dispersion restante vient
  // de l'a priori, donc elle doit decroitre de facon monotone.
  const variances = [0, 1, 2, 3, 4, 5].map((n) => predict(step(n), ctx).variance);
  for (let i = 1; i < variances.length; i++) {
    assert.ok(variances[i] <= variances[i - 1],
      `la dispersion doit decroitre avec la confiance : ${variances.join(' > ')}`);
  }
  assert.equal(variances.at(-1), 0, 'a confiance pleine, l\'a priori ne pese plus rien');
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

test('predictTravel sans mesure : fallback declaratif, dispersion a priori', () => {
  const p = predictTravel(null, 'bike', ctx, 25);
  assert.equal(p.dur, 25);
  assert.equal(p.confidence, 0);
  assert.equal(p.variance, 25 * PRIOR_SPREAD_RATIO);
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

// J3 · Coefficients calibres par balayage contre ADR-002. Ce test les
// verrouille : les changer sans repasser par le harnais de calibration
// doit casser la construction.
test('safetyMargin : formule verrouillee', () => {
  assert.equal(safetyMargin(0, 0), 1);
  assert.equal(safetyMargin(5, 0.5), Math.round(1 + 5 * 0.55 + 4));
  assert.equal(safetyMargin(100, 0), 11, 'la composante variance reste plafonnee');
});

test('safetyMargin croit avec la dispersion et avec le retard chronique', () => {
  assert.ok(safetyMargin(8, 0) > safetyMargin(2, 0), 'plus la dispersion est grande, plus la marge l\'est');
  assert.ok(safetyMargin(4, 1) > safetyMargin(4, 0), 'le retard chronique reste personnalise');
});

// J3 (DEC-12) · varBoost a disparu : il gonflait la composante variance
// d'une destination jamais mesuree, mais multipliait une variance nulle,
// donc ne faisait rien precisement dans le cas pour lequel il existait.
test('DEC-12 · safetyMargin n\'accepte plus de troisieme argument', () => {
  assert.equal(safetyMargin.length, 2, 'varBoost doit avoir disparu de la signature');
  assert.equal(safetyMargin(5, 0, 1.5), safetyMargin(5, 0),
    'un troisieme argument ne doit plus rien changer');
});

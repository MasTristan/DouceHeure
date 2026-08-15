// J2 · Le harnais de calibration (S4 article 5, avancé en J2).
//
// POURQUOI IL ARRIVE MAINTENANT ET PAS EN J3. Le critère de sortie de J2
// est « un testeur qui n'a jamais vu l'app arrive à l'heure au premier
// essai » : il se vérifie sur un iPhone, avec une vraie personne, et il
// n'est pas automatisable. Mais la CAUSE que J2 traite, elle, est
// chiffrée, et sans harnais rien n'empêche une modification future de la
// réintroduire en silence. On ne peut pas tester la promesse ; on peut
// tester le mécanisme qui la rend possible.
//
// Ce fichier fait tourner le code de production sur une population
// simulée reproductible (`tests/tools/simulate.mjs`) et fixe des seuils
// qui font échouer la construction.
//
// LES CHIFFRES NE SONT PAS CEUX DE R1, et il faut le dire. La réunion
// d'ouverture citait 50 % de matins en retard au jour 1 ; ce simulateur
// en trouve 71 %. Le générateur de R1 n'a jamais été versionné : celui-ci
// est une re-dérivation, pas la même expérience. La conclusion
// qualitative est identique et plus dure : la totalité de l'échec du
// premier jour vient du biais de déclaration.

import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRng, makeUser, simulateMorning, declaredWakeTime, summarize, summarizeSteady } from './tools/simulate.mjs';
import { calibrateSteps } from '../js/calibrate.js';

const USERS = 300;
const MORNINGS = 20;

function run({ calibrated, slack = 5, stepBias = 1.4, seed = 1 }) {
  const rng = makeRng(seed);
  const byDay = Array.from({ length: MORNINGS }, () => []);
  for (let u = 0; u < USERS; u++) {
    const user = makeUser(rng, { stepBias });
    if (calibrated) {
      const profile = user.state.profiles[0];
      profile.steps = calibrateSteps(profile.steps, {
        wakeTime: declaredWakeTime(user, slack),
        arrival: user.arrival,
        travel: user.declaredTravel,
        transportKey: user.transport,
      });
    }
    for (let d = 0; d < MORNINGS; d++) {
      byDay[d].push(simulateMorning(user, { day: (d % 5) + 1, type: 'work' }, rng));
    }
  }
  return byDay;
}

test('le defaut existe : sans calibrage, un matin sur deux au moins est en retard au jour 1', () => {
  const lateRate = summarize(run({ calibrated: false })[0]).lateRate;
  assert.ok(lateRate > 0.5,
    `le defaut que J2 corrige doit rester visible dans le harnais (mesure : ${(lateRate * 100).toFixed(0)}%)`);
});

test('le calibrage divise le retard du jour 1 par plus de quatre', () => {
  const before = summarize(run({ calibrated: false })[0]).lateRate;
  const after = summarize(run({ calibrated: true })[0]).lateRate;
  assert.ok(after < before / 4,
    `jour 1 : ${(before * 100).toFixed(0)}% sans calibrage, ${(after * 100).toFixed(0)}% avec`);
  assert.ok(after < 0.15,
    `le jour 1 doit passer sous 15% de matins en retard (mesure : ${(after * 100).toFixed(0)}%)`);
});

test('le calibrage tient sur toute la premiere semaine, pas seulement au jour 1', () => {
  const byDay = run({ calibrated: true });
  for (let d = 0; d < 5; d++) {
    const rate = summarize(byDay[d]).lateRate;
    assert.ok(rate < 0.15, `jour ${d + 1} : ${(rate * 100).toFixed(0)}% de matins en retard`);
  }
});

test('le calibrage tient quel que soit le biais de declaration', () => {
  // Le pire cas : quelqu'un qui met presque le double de ce qu'il croit.
  for (const stepBias of [1.0, 1.4, 1.8]) {
    const after = summarize(run({ calibrated: true, stepBias })[0]).lateRate;
    assert.ok(after < 0.15,
      `biais ${stepBias} : ${(after * 100).toFixed(0)}% de matins en retard au jour 1`);
  }
});

test('le calibrage ne coute rien en regime etabli : il agit sur la premiere semaine, puis s\'efface', () => {
  // Une fois les vraies durees apprises, `est` ne pese plus rien dans la
  // prediction : les deux regimes doivent converger vers le meme plan.
  // Si ce test casse, c'est que le calibrage a fui au-dela de sa fenetre.
  const withOut = summarizeSteady(run({ calibrated: false }));
  const withIt = summarizeSteady(run({ calibrated: true }));
  assert.ok(Math.abs(withIt.meanRiseLead - withOut.meanRiseLead) < 3,
    `lever en regime etabli : ${withOut.meanRiseLead.toFixed(0)} sans, ${withIt.meanRiseLead.toFixed(0)} avec`);
  assert.ok(Math.abs(withIt.meanAdvance - withOut.meanAdvance) < 3,
    `avance en regime etabli : ${withOut.meanAdvance.toFixed(1)} sans, ${withIt.meanAdvance.toFixed(1)} avec`);
});

// Ce test ECHOUERA quand J3 aura fait son travail, et c'est voulu : il
// consigne l'ecart qui reste a combler, pour qu'on ne puisse pas declarer
// la cible atteinte sans l'avoir mesuree. ADR-002 vise 90 % de matins a
// l'heure pour 10 minutes d'avance moyenne au plus.
test('ADR-002 · la cible n\'est PAS encore tenue, et voici de combien', () => {
  const steady = summarizeSteady(run({ calibrated: true }));
  assert.ok(steady.lateRate < 0.1,
    `la part de ponctualite est deja tenue : ${((1 - steady.lateRate) * 100).toFixed(0)}% a l'heure ou en avance`);
  assert.ok(steady.meanAdvance > 10,
    'si ce test echoue, la cible d\'avance moyenne d\'ADR-002 est atteinte : mettre a jour S4 et durcir le seuil');
});

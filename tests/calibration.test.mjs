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

function run({ calibrated, slack = 5, stepBias = 1.4, seed = 1, withDestination = false }) {
  const rng = makeRng(seed);
  const byDay = Array.from({ length: MORNINGS }, () => []);
  for (let u = 0; u < USERS; u++) {
    const user = makeUser(rng, { stepBias, withDestination });
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

// Ce seuil etait a 50 % quand ce fichier a ete ecrit, en J2. J3 article 2
// (la variance a priori) a lui aussi attaque le jour 1, par un autre
// chemin : le defaut residuel est donc plus petit, et c'est un progres,
// pas une regression. Le seuil suit, mais le test reste : sans calibrage,
// le jour 1 doit rester nettement moins bon qu'avec.
test('le defaut existe : sans calibrage, le jour 1 reste massivement en retard', () => {
  const lateRate = summarize(run({ calibrated: false })[0]).lateRate;
  assert.ok(lateRate > 0.3,
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

// ─── J3 · La cible d'ADR-002 ──────────────────────────────────────
//
// « 90 % des matins a l'heure ou en avance, pour une avance moyenne
// inferieure ou egale a 10 minutes. » Ces seuils font echouer la
// construction : toute modification de predict, predictTravel,
// safetyMargin ou buildPlan passe par ici avant fusion (S4 article 5).

test('ADR-002 · au moins 90 % des matins a l\'heure ou en avance', () => {
  const steady = summarizeSteady(run({ calibrated: true, withDestination: true }));
  assert.ok(steady.lateRate <= 0.10,
    `${((1 - steady.lateRate) * 100).toFixed(0)}% a l'heure ou en avance, cible 90%`);
});

test('ADR-002 · avance moyenne inferieure ou egale a 10 minutes', () => {
  const steady = summarizeSteady(run({ calibrated: true, withDestination: true }));
  assert.ok(steady.meanAdvance <= 10,
    `avance moyenne ${steady.meanAdvance.toFixed(1)} min, cible 10. `
    + 'Le moteur convergeait vers 17 min avant J3 : ne pas relacher ce seuil sans ADR.');
});

// La moitie oubliee de la cible : on n'achete pas la ponctualite a
// n'importe quel prix. Avant J3, le moteur faisait lever 110 minutes
// avant l'heure d'arrivee pour arriver 17 minutes en avance.
test('ADR-002 · le prix quotidien du plan a baisse, en minutes de sommeil', () => {
  const steady = summarizeSteady(run({ calibrated: true, withDestination: true }));
  assert.ok(steady.meanRiseLead < 106,
    `lever ${steady.meanRiseLead.toFixed(0)} min avant l'arrivee (110 avant J3)`);
});

// Sans destination, le trajet n'est JAMAIS mesure : l'app reste ignorante
// a vie sur ce terme, et le paie en marge. C'est le parcours par defaut du
// produit, et il est moins bon. Ce test le consigne au lieu de le taire.
test('sans destination, la cible d\'avance n\'est pas tenue, et c\'est documente', () => {
  const steady = summarizeSteady(run({ calibrated: true, withDestination: false }));
  assert.ok(steady.lateRate <= 0.10, 'la ponctualite reste tenue sans destination');
  assert.ok(steady.meanAdvance > 10,
    'si ce test echoue, le parcours sans destination tient aussi la cible : durcir le seuil et mettre a jour S4');
  assert.ok(steady.meanAdvance < 13,
    `l'ecart doit rester borne (mesure : ${steady.meanAdvance.toFixed(1)} min)`);
});

// J3 article 3 · La raison d'etre de l'estimateur robuste.
test('un matin aberrant ne contamine pas le moteur pendant huit jours', () => {
  const rng = makeRng(1);
  const ABERRANT = 9;
  const byDay = Array.from({ length: 20 }, () => []);
  for (let u = 0; u < USERS; u++) {
    const user = makeUser(rng, { withDestination: true });
    const p = user.state.profiles[0];
    p.steps = calibrateSteps(p.steps, {
      wakeTime: declaredWakeTime(user, 5), arrival: user.arrival,
      travel: user.declaredTravel, transportKey: user.transport,
    });
    for (let d = 0; d < 20; d++) {
      byDay[d].push(simulateMorning(user, { day: (d % 5) + 1, type: 'work' }, rng, d === ABERRANT));
    }
  }
  const rise = (d) => byDay[d].reduce((a, r) => a + r.riseLead, 0) / byDay[d].length;
  const before = rise(ABERRANT - 1);
  const worst = Math.max(rise(ABERRANT + 1), rise(ABERRANT + 3), rise(ABERRANT + 5));
  assert.ok(worst - before < 5,
    `un seul matin aberrant deplace le lever de ${(worst - before).toFixed(1)} min `
    + '(9,9 min avec une moyenne simple, avant J3)');
});

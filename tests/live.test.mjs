// S1 étape 3 · Machine à états pure du guidage en direct, extraite de
// js/ui.js (liveStatus, confirmNext). Testée exactement comme plan.js :
// aucun DOM, entrées/sortie explicites.
import test from 'node:test';
import assert from 'node:assert/strict';
import { currentStep, nextStepIdx, liveStatus, computeConfirm } from '../js/live.js';

function sequence() {
  return [
    { key: 'wakeup', label: 'Réveil', dur: 5, at: 420 },
    { key: 'shower', label: 'Douche', dur: 15, at: 425 },
    { key: 'bag', label: 'Sac', dur: 6, at: 440 },
    { key: 'ready', label: 'Prêt', dur: 4, at: 446, fixed: true },
    { key: 'leave', label: "C'est l'heure", dur: 0, at: 450, fixed: true },
  ];
}

function makeLive(overrides = {}) {
  return {
    sequence: sequence(),
    current: 0,
    startedAt: 0,
    leaveMin: 450,
    polluted: false,
    ...overrides,
  };
}

// ─── currentStep / nextStepIdx ───────────────────────────────────

test('currentStep renvoie l\'étape à l\'index courant', () => {
  const live = makeLive({ current: 2 });
  assert.equal(currentStep(live).key, 'bag');
});

test('nextStepIdx renvoie l\'index suivant non sauté', () => {
  const live = makeLive({ current: 0 });
  assert.equal(nextStepIdx(live), 1);
});

test('nextStepIdx saute les étapes marquées skipped', () => {
  const live = makeLive({ current: 0 });
  live.sequence[1].skipped = true;
  assert.equal(nextStepIdx(live), 2);
});

test('nextStepIdx renvoie -1 en bout de séquence', () => {
  const live = makeLive({ current: 4 });
  assert.equal(nextStepIdx(live), -1);
});

// ─── liveStatus ───────────────────────────────────────────────────

test('liveStatus : ni suggested ni nudge avant la durée de l\'étape', () => {
  const live = makeLive({ current: 0, startedAt: 0 });
  const s = liveStatus(live, 2 * 60000, 421); // 2 min ecoulees sur une etape de 5
  assert.equal(s.suggested, false);
  assert.equal(s.nudge, false);
});

test('liveStatus : suggested des que la duree predite est atteinte', () => {
  const live = makeLive({ current: 0, startedAt: 0 });
  const s = liveStatus(live, 5 * 60000, 425); // exactement 5 min, dur=5
  assert.equal(s.suggested, true);
});

test('liveStatus : jamais suggested sur la derniere etape de la sequence', () => {
  const live = makeLive({ current: 4, startedAt: 0 }); // 'leave', dur=0
  const s = liveStatus(live, 10 * 60000, 460);
  assert.equal(s.suggested, false, 'la derniere etape ne doit jamais proposer d\'avancer plus loin');
});

test('liveStatus : nudge seulement bien au-dela de la duree (max(dur*1.6, dur+4))', () => {
  const live = makeLive({ current: 0, startedAt: 0 }); // dur=5 -> seuil nudge = max(8, 9) = 9
  assert.equal(liveStatus(live, 8 * 60000, 428).nudge, false);
  assert.equal(liveStatus(live, 9 * 60000, 429).nudge, true);
});

test('liveStatus : slip replie dans [-720, 720] au passage de minuit', () => {
  const live = makeLive({ current: 0, startedAt: 0, leaveMin: 1430 }); // 23h50
  // projectLeave avec nowMin proche de minuit peut produire un slip brut hors bornes
  const s = liveStatus(live, 0, 10); // 00h10, largement apres minuit
  assert.ok(s.slip >= -720 && s.slip <= 720, `slip hors bornes : ${s.slip}`);
});

test('liveStatus est pure : n\'écrit rien dans live ni dans sequence', () => {
  const live = makeLive({ current: 0, startedAt: 0 });
  const before = JSON.stringify(live);
  liveStatus(live, 6 * 60000, 426);
  assert.equal(JSON.stringify(live), before, 'liveStatus a modifie son argument');
});

// ─── computeConfirm : le cœur de R2/R3 ───────────────────────────

test('computeConfirm : avance normalement et décrit une mesure valide', () => {
  const live = makeLive({ current: 0, startedAt: 0 });
  const r = computeConfirm(live, 6 * 60000); // 6 min ecoulees
  assert.equal(r.ended, false);
  assert.deepEqual(r.measurement, { stepKey: 'wakeup', v: 6 });
  assert.equal(r.nextCurrent, 1);
  assert.equal(r.nextStartedAt, 6 * 60000);
  assert.equal(r.reachedLeave, false);
});

test('computeConfirm : mesure au moins 1 minute même si l\'écart est nul (jamais 0)', () => {
  const live = makeLive({ current: 0, startedAt: 0 });
  const r = computeConfirm(live, 0);
  assert.equal(r.measurement.v, 1);
});

test('computeConfirm : étape polluée (F6) ne décrit aucune mesure (R3)', () => {
  const live = makeLive({ current: 0, startedAt: 0, polluted: true });
  const r = computeConfirm(live, 6 * 60000);
  assert.equal(r.measurement, null, 'une etape polluee ne doit jamais produire de mesure');
  assert.equal(r.ended, false);
  assert.equal(r.nextCurrent, 1, 'l\'avancement doit continuer malgre la pollution');
});

test('computeConfirm : confirmer l\'étape "leave" termine la session sans mesure', () => {
  const live = makeLive({ current: 4, startedAt: 0 }); // 'leave'
  const r = computeConfirm(live, 60000);
  assert.equal(r.ended, true);
  assert.equal(r.measurement, null, "l'etape leave n'a pas de duree a mesurer");
});

test('computeConfirm : confirmer la derniere étape avant "leave" signale reachedLeave', () => {
  const live = makeLive({ current: 3, startedAt: 0 }); // 'ready', suivant = 'leave'
  const r = computeConfirm(live, 4 * 60000);
  assert.equal(r.ended, false);
  assert.equal(r.reachedLeave, true);
  assert.equal(r.nextCurrent, 4);
});

test('computeConfirm : des étapes sautées sont ignorées pour trouver la suivante', () => {
  const live = makeLive({ current: 0, startedAt: 0 });
  live.sequence[1].skipped = true; // 'shower' sautee
  const r = computeConfirm(live, 60000);
  assert.equal(r.nextCurrent, 2, 'l\'etape sautee aurait du etre ignoree');
});

test('computeConfirm : fin de séquence sans "leave" explicite termine quand même (garde-fou)', () => {
  const live = makeLive({ current: 3, startedAt: 0 });
  live.sequence = live.sequence.slice(0, 4); // pas de 'leave' du tout, cas degenere
  const r = computeConfirm(live, 60000);
  assert.equal(r.ended, true);
});

test('computeConfirm est pure : n\'écrit rien dans live ni dans sequence', () => {
  const live = makeLive({ current: 0, startedAt: 0 });
  const before = JSON.stringify(live);
  computeConfirm(live, 6 * 60000);
  assert.equal(JSON.stringify(live), before, 'computeConfirm a modifie son argument');
});

// ─── L'invariant central, formulé directement (CLAUDE.md §6) ────

test('INVARIANT : rien dans ce module ne fait avancer une étape sans un appel explicite à computeConfirm', () => {
  // liveStatus, currentStep et nextStepIdx sont de purs getters : aucun
  // d'eux ne modifie `live.current`, quel que soit le temps fourni.
  const live = makeLive({ current: 0, startedAt: 0 });
  for (const elapsedMin of [0, 1, 5, 9, 40, 600, 100000]) {
    liveStatus(live, elapsedMin * 60000, 420 + elapsedMin);
    assert.equal(live.current, 0, `liveStatus(${elapsedMin} min) a fait avancer l'etape courante`);
  }
});

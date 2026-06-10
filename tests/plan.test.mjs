import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPlan, projectLeave, shouldRescue, rescueThreshold, rescueCandidates, TRANSPORT_BUFFER } from '../js/plan.js';
import { safetyMargin } from '../js/predict.js';

const ctx = { day: 1, type: 'work' };

function steps() {
  return [
    { key: 'wakeup', label: 'Réveil', est: 5, active: true, fixed: true, kind: 'core', real: [] },
    { key: 'shower', label: 'Douche', est: 15, active: true, fixed: false, kind: 'comfort', real: [] },
    { key: 'bag', label: 'Sac', est: 6, active: true, fixed: false, kind: 'core', real: [] },
    { key: 'ready', label: 'Prêt', est: 4, active: true, fixed: true, kind: 'core', real: [] },
  ];
}

test('buildPlan : depart = arrivee - trajet - buffer - marge', () => {
  const plan = buildPlan(steps(), '09:00', 20, 'walk', 0, ctx);
  const margin = safetyMargin(0, 0);
  assert.equal(plan.leaveMin, 540 - 20 - TRANSPORT_BUFFER.walk - margin);
  // Placement a rebours : la premiere etape commence a leave - somme des durees
  assert.equal(plan.startMin, plan.leaveMin - (5 + 15 + 6 + 4));
  // Derniere entree : leave a l'heure de depart
  const leave = plan.sequence.at(-1);
  assert.equal(leave.key, 'leave');
  assert.equal(leave.at, plan.leaveMin);
});

test('buildPlan : une arrivee confirmee modifie la prediction du prochain plan (F5)', () => {
  const dest = { id: 'd1', label: 'Bureau', byTransport: { bike: { real: [] } } };
  const before = buildPlan(steps(), '09:00', 30, 'bike', 0, ctx, dest);
  dest.byTransport.bike.real = Array.from({ length: 5 }, () => ({ v: 12, day: 1 }));
  const after = buildPlan(steps(), '09:00', 30, 'bike', 0, ctx, dest);
  assert.equal(after.travelDur, 12);
  assert.ok(after.leaveMin > before.leaveMin);
});

test('buildPlan : destination inconnue gonfle la marge, sans jamais l\'afficher', () => {
  // Une seule etape avec un peu de variance, pour rester sous le plafond.
  const varied = () => steps().map((s) => s.key === 'shower'
    ? { ...s, real: [{ v: 19, day: 1, type: 'work' }, { v: 11, day: 1, type: 'work' }] }
    : s);
  const noDest = buildPlan(varied(), '09:00', 20, 'walk', 0, ctx);
  const dest = { id: 'd1', label: 'Salle', byTransport: {} };
  const withDest = buildPlan(varied(), '09:00', 20, 'walk', 0, ctx, dest);
  assert.ok(withDest.margin > noDest.margin);
  // R4 : la marge ne fuit dans aucun label affichable
  for (const s of withDest.sequence) {
    assert.ok(!String(s.label).includes(String(withDest.margin)));
    assert.ok(!/marge/i.test(String(s.label)));
  }
});

test('projectLeave ignore les etapes sautees', () => {
  const plan = buildPlan(steps(), '09:00', 20, 'walk', 0, ctx);
  const full = projectLeave(plan.sequence, 0, 480);
  plan.sequence[1].skipped = true;
  const lighter = projectLeave(plan.sequence, 0, 480);
  assert.equal(full - lighter, 15);
});

test('rescue : seuil interne = max(6, marge), jamais en dessous de 6', () => {
  assert.equal(rescueThreshold(3), 6);
  assert.equal(rescueThreshold(11), 11);
});

test('shouldRescue se declenche au seuil, pas avant', () => {
  assert.equal(shouldRescue(500, 495, 3), false);
  assert.equal(shouldRescue(501, 495, 3), true);
  // Passage de minuit
  assert.equal(shouldRescue(5, 1435, 3), true);
});

test('rescueCandidates : jamais de fixed ni de core', () => {
  const plan = buildPlan(steps(), '09:00', 20, 'walk', 0, ctx);
  const candidates = rescueCandidates(plan.sequence, 0);
  assert.deepEqual(candidates.map((s) => s.key), ['shower']);
  for (const c of candidates) {
    assert.equal(c.kind, 'comfort');
    assert.equal(c.fixed, false);
  }
});

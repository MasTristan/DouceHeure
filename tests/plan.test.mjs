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
  // La marge du plan est celle que buildPlan a calculee, pas une valeur
  // recalculee ici : depuis J3 article 2, un plan sans mesure porte une
  // dispersion a priori, donc safetyMargin(0, 0) n'est plus la bonne
  // reference. Ce qui compte et qui est verifie, c'est la COMPOSITION.
  assert.equal(plan.leaveMin, 540 - 20 - TRANSPORT_BUFFER.walk - plan.margin);
  assert.ok(plan.margin > safetyMargin(0, 0),
    'un plan sans aucune mesure doit porter plus que la marge plancher (J3 article 2)');
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

// J3 (DEC-12) · L'ancien test verifiait qu'une destination DECLAREE mais
// jamais mesuree gonflait la marge davantage qu'une absence de
// destination. Ce comportement venait de varBoost et il n'avait pas de
// sens : ne pas savoir, c'est ne pas savoir, qu'on ait nomme le lieu ou
// non. L'invariant qui le remplace est celui qui compte vraiment.
test('buildPlan : un trajet mesure reduit la marge, un trajet inconnu la maintient', () => {
  const varied = () => steps().map((s) => s.key === 'shower'
    ? { ...s, real: [{ v: 19, day: 1, type: 'work' }, { v: 11, day: 1, type: 'work' }] }
    : s);
  const unknown = { id: 'd1', label: 'Salle', byTransport: {} };
  const known = { id: 'd1', label: 'Salle', byTransport: { walk: { real: Array.from({ length: 5 }, () => ({ v: 20, day: 1 })) } } };

  const planUnknown = buildPlan(varied(), '09:00', 20, 'walk', 0, ctx, unknown);
  const planKnown = buildPlan(varied(), '09:00', 20, 'walk', 0, ctx, known);
  assert.ok(planKnown.margin < planUnknown.margin,
    'apprendre le trajet doit rendre des minutes, c\'est toute la promesse de F5');

  // Nommer un lieu sans l'avoir mesure ne change rien : c'est la meme ignorance.
  const planNoDest = buildPlan(varied(), '09:00', 20, 'walk', 0, ctx);
  assert.equal(planUnknown.margin, planNoDest.margin);

  // R4 : la marge ne fuit dans aucun label affichable.
  for (const s of planKnown.sequence) {
    assert.ok(!String(s.label).includes(String(planKnown.margin)));
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

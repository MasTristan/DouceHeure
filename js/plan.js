// Construction du plan de préparation, à rebours depuis l'heure d'arrivée.

import { toMin } from './time.js';
import { predict, safetyMargin } from './predict.js';

// Buffer par mode de transport (cf. spec §7.5).
export const TRANSPORT_BUFFER = {
  walk:      4,
  bike:      6,
  car:       10,
  transit:   14
};

export function buildPlan(steps, arrival, travel, transportKey, latenessScore, ctx) {
  const active = steps.filter((s) => s.active);
  const predicted = active.map((s) => {
    const p = predict(s, ctx);
    return { ...s, dur: p.dur, variance: p.variance, confidence: p.confidence };
  });

  const totalVar = predicted.reduce((a, s) => a + s.variance, 0);
  const margin = safetyMargin(totalVar, latenessScore);
  const transportBuffer = TRANSPORT_BUFFER[transportKey] ?? 0;

  const arrivalMin = toMin(arrival);
  const leaveMin = arrivalMin - travel - transportBuffer - margin;

  // Placement à rebours depuis leaveMin.
  const sequence = predicted.map((s) => ({ ...s, at: 0 }));
  let cursor = leaveMin;
  for (let i = sequence.length - 1; i >= 0; i--) {
    cursor -= sequence[i].dur;
    sequence[i].at = cursor;
  }
  const startMin = cursor;

  // Étape finale 'leave' à leaveMin (durée 0).
  sequence.push({
    key: 'leave',
    label: 'C\'est le moment de partir',
    emoji: '🚪',
    dur: 0,
    variance: 0,
    confidence: 1,
    at: leaveMin,
    fixed: true,
    active: true
  });

  return { sequence, leaveMin, startMin, arrivalMin, margin };
}

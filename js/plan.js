// Construction du plan de préparation, à rebours depuis l'heure d'arrivée.
// Contient aussi la logique de rattrapage (F3) : c'est du calcul de plan.
// Fonctions pures, aucun DOM.

import { toMin } from './time.js';
import { predict, predictTravel, safetyMargin } from './predict.js';

// Buffer par mode de transport.
export const TRANSPORT_BUFFER = {
  walk:    4,
  bike:    6,
  car:     10,
  transit: 14,
};

// destination : entité destinations[] (F5) ou null. Quand des trajets réels
// existent, leur prédiction remplace la durée déclarative (spec v2 §8.3).
export function buildPlan(steps, arrival, travel, transportKey, latenessScore, ctx, destination = null) {
  const active = steps.filter((s) => s.active);
  const predicted = active.map((s) => {
    const p = predict(s, ctx);
    return { ...s, dur: p.dur, variance: p.variance, confidence: p.confidence };
  });

  const trip = predictTravel(destination, transportKey, ctx, travel);

  // J3 article 1 (S4) · Composer les variances, pas les écarts-types.
  // Additionner des écarts-types surestime la dispersion de leur somme
  // d'un facteur 2,3 sur un profil réaliste. Conséquence mesurée : le
  // terme de variance de safetyMargin était saturé à son plafond 99,8 %
  // du temps, donc la marge « adaptative » était en réalité une
  // constante, et l'était depuis l'origine.
  const totalVar = Math.sqrt(
    predicted.reduce((a, s) => a + s.variance ** 2, 0) + trip.variance ** 2,
  );
  const margin = safetyMargin(totalVar, latenessScore);
  const transportBuffer = TRANSPORT_BUFFER[transportKey] ?? 0;

  const arrivalMin = toMin(arrival);
  const leaveMin = arrivalMin - trip.dur - transportBuffer - margin;

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
    label: 'C\'est l\'heure',
    icon: 'door',
    emoji: null,
    dur: 0,
    variance: 0,
    confidence: 1,
    at: leaveMin,
    fixed: true,
    active: true,
    kind: 'core',
  });

  return { sequence, leaveMin, startMin, arrivalMin, margin, travelDur: trip.dur, travelConfidence: trip.confidence };
}

// Heure de départ projetée : maintenant + durées des étapes restantes
// (hors étape courante, dont le temps passé est déjà dans nowMin).
export function projectLeave(sequence, currentIdx, nowMin) {
  const remaining = sequence
    .slice(currentIdx + 1)
    .filter((s) => s.key !== 'leave' && !s.skipped)
    .reduce((a, s) => a + s.dur, 0);
  return nowMin + remaining;
}

// F3 · Rattrapage. Seuil interne, JAMAIS affiché (R4).
export function rescueThreshold(margin) {
  return Math.max(6, margin);
}

// Vrai si la projection dépasse le départ planifié du seuil interne.
// Gère le passage de minuit en repliant l'écart dans [-720, 720].
export function shouldRescue(projectedLeaveMin, plannedLeaveMin, margin) {
  let slip = projectedLeaveMin - plannedLeaveMin;
  if (slip > 720) slip -= 1440;
  if (slip < -720) slip += 1440;
  return slip >= rescueThreshold(margin);
}

// Étapes restantes proposables à la coupe : confort uniquement,
// jamais les fixed ni les core (spec v2 §7.6).
export function rescueCandidates(sequence, currentIdx) {
  return sequence
    .slice(currentIdx + 1)
    .filter((s) => s.key !== 'leave' && !s.skipped && !s.fixed && s.kind === 'comfort');
}

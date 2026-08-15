// J2 (S3 §2) · Le calibrage par deux heures d'horloge.
//
// L'app demandait « combien de temps prend ta douche » à des personnes en
// cécité temporelle et bâtissait son plan sur la réponse. Le harnais
// (tests/calibration.test.mjs) est sans appel : la totalité de l'échec du
// premier jour vient de ce biais de déclaration, pas du moteur.
//
// On ne demande donc plus jamais une durée, mais deux heures d'horloge que
// la personne connait : son lever habituel et son arrivée. Leur différence
// est un budget observé, pas une estimation introspective. R1 fait déjà
// cette distinction : une heure cible est autorisée, un décompte non.
//
// R3 EST INTACTE. Rien n'est écrit dans `step.real` : on ajuste `est`,
// l'estimation déclarative, avec une déclaration meilleure que la
// précédente. C'est la différence entre mieux estimer et inventer.
//
// Fonctions pures, aucun DOM.

import { toMin } from './time.js';
import { TRANSPORT_BUFFER } from './plan.js';

// Au-delà, ce n'est plus un matin lent, c'est une heure tapée à côté.
// L'apprentissage corrigerait en une semaine, mais la première semaine est
// précisément celle qu'on essaie de sauver.
export const MAX_SCALE = 2.5;

// L'estimation de RÉFÉRENCE d'une étape. `est` est la valeur calibrée, qui
// se réécrit ; `estBase` ne bouge jamais. Sans cette distinction, chaque
// recalibrage s'empilerait sur le précédent et le plan dériverait.
export function baseEst(step) {
  return typeof step.estBase === 'number' ? step.estBase : step.est;
}

// Temps disponible entre le lever habituel et l'arrivée, replié sur 24 h
// pour les départs qui traversent minuit.
export function observedBudget(wakeTime, arrival) {
  const wake = toMin(wakeTime);
  const arrive = toMin(arrival);
  if (!Number.isFinite(wake) || !Number.isFinite(arrive)) return null;
  const span = arrive - wake;
  return span <= 0 ? span + 1440 : span;
}

// Ce qui reste du budget observé une fois le trajet et son buffer retirés,
// et le déroulé de référence auquel le comparer. null si une heure manque :
// le profil garde alors les estimations de son archétype.
function budgetAndBaseline({ steps, wakeTime, arrival, travel = 0, transportKey = 'walk' }) {
  const baseline = (steps || [])
    .filter((s) => s.active && s.key !== 'leave')
    .reduce((a, s) => a + baseEst(s), 0);
  const span = observedBudget(wakeTime, arrival);
  if (!baseline || span === null) return null;
  return { baseline, prepBudget: span - (Number(travel) || 0) - (TRANSPORT_BUFFER[transportKey] ?? 0) };
}

// UNIQUEMENT VERS LE HAUT (S3 §2). Qui déclare se lever 40 minutes avant de
// devoir arriver ne se voit pas attribuer un plan de 40 minutes : comprimer
// le déroulé pour coller à un budget trop court reviendrait à presser
// quelqu'un, ce que le produit refuse (R5).
export function calibrationScale(opts) {
  const b = budgetAndBaseline(opts);
  if (!b || !(b.prepBudget > 0)) return 1;
  return Math.min(Math.max(b.prepBudget / b.baseline, 1), MAX_SCALE);
}

// Budget déclaré plus court que le déroulé : le plan n'a pas été comprimé,
// et la personne a le droit de le savoir. Surface autorisée : l'Aperçu
// (ADR-003).
export function isBudgetShorterThanPlan(opts) {
  const b = budgetAndBaseline(opts);
  return b ? b.prepBudget < b.baseline : false;
}

// Rend une NOUVELLE liste d'étapes, mises à l'échelle depuis `estBase`,
// donc idempotent. Les étapes inactives sont recopiées telles quelles :
// les calibrer les compterait dans un budget qu'elles ne consomment pas.
export function calibrateSteps(steps, opts) {
  const scale = calibrationScale({ steps, ...opts });
  return (steps || []).map((s) => {
    const base = baseEst(s);
    return s.active && s.key !== 'leave'
      ? { ...s, estBase: base, est: Math.max(2, Math.round(base * scale)) }
      : { ...s, estBase: base };
  });
}

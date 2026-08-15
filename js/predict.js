// Moteur d'apprentissage on-device et marge de sécurité invisible.
// Règles : R3 (n'apprendre que du réel), R4 (marge jamais affichée).
// Fonctions pures, aucun DOM.
//
// Les trois articles de J3 (S4) vivent ici : composition correcte des
// variances (dans plan.js), variance a priori, estimateur robuste. Les
// constantes ci-dessous sont calibrées par balayage contre ADR-002, pas
// choisies à l'intuition, et vérifiées par tests/calibration.test.mjs.

import { MAX_HISTORY } from './store.js';

// Sur 48 combinaisons balayées, 14 tenaient la cible. Celle-ci a été
// retenue sur un principe : le terme de retard chronique garde tout son
// poids, parce qu'il est la seule part de la marge qui s'adapte à la
// personne plutôt qu'aux statistiques d'une étape. Ce qui a été rendu,
// ce sont deux minutes de plancher fixe, la part qui ne dépendait de rien.
const MARGIN_FLOOR = 1;
const VAR_WEIGHT = 0.55;
const LATE_WEIGHT = 8;
// Garde-fou contre une dispersion pathologique. Avant J3 il était atteint
// 99,8 % du temps, ce qui faisait de la marge « adaptative » une constante.
const VAR_CAP = 10;

// J3 article 2 · Sans mesure, `predict` rendait variance 0 : la marge était
// minimale au moment où l'app est la plus ignorante. L'ignorance s'exprime
// maintenant comme une dispersion a priori proportionnelle à l'estimation,
// qui s'efface à mesure que la confiance monte. R3 intacte : on n'invente
// aucune mesure, on dit qu'on ne sait pas encore.
export const PRIOR_SPREAD_RATIO = 0.35;

// J3 article 3 · Moyenne tronquée symétrique : une valeur extrême est
// écartée au lieu d'être diluée. Une moyenne simple laissait un seul matin
// aberrant gonfler le lever de 10 minutes pendant toute la profondeur du
// FIFO. Ne tronquer que le haut a été mesuré aussi : plus optimiste donc
// plus tard, ce n'est pas de la robustesse.
function centerAndSpread(values) {
  const kept = values.length >= 4 ? [...values].sort((a, b) => a - b).slice(1, -1) : values;
  const center = kept.reduce((a, b) => a + b, 0) / kept.length;
  if (kept.length < 2) return { center, spread: 0 };
  return { center, spread: Math.sqrt(kept.reduce((a, v) => a + (v - center) ** 2, 0) / kept.length) };
}

// Coeur commun aux deux prédictions : mélange l'estimation déclarative et
// le centre des mesures réelles, avec un poids qui croit avec leur nombre.
// `segment` choisit les mesures pertinentes ; un segment de moins de deux
// points retombe sur tout l'historique plutôt que de prédire sur un
// souvenir unique. L'écart-type n'est pas arrondi : il est composé au carré
// dans buildPlan, et arrondir avant d'élever au carré coutait jusqu'à une
// demi-minute par étape.
function blend(real, fallback, segment) {
  const prior = fallback * PRIOR_SPREAD_RATIO;
  if (real.length === 0) return { dur: fallback, variance: prior, confidence: 0 };
  let pool = real.filter(segment);
  if (pool.length < 2) pool = real;
  const { center, spread } = centerAndSpread(pool.map((r) => r.v));
  const w = Math.min(real.length / 5, 1);
  return {
    dur: Math.round(fallback * (1 - w) + center * w),
    variance: spread * w + prior * (1 - w),
    confidence: w,
  };
}

// Segmentation contextuelle : même jour OU même type.
export function predict(step, ctx) {
  return blend(step.real || [], step.est, (r) => r.day === ctx.day || r.type === ctx.type);
}

// Trajet réel (F5, spec v2 §8.3) : même logique, segmentée par jour seul,
// le transport étant déjà séparé dans le stockage. `fallback` est la durée
// déclarative utilisée tant qu'on n'a rien mesuré.
export function predictTravel(destination, transport, ctx, fallback) {
  const real = destination?.byTransport?.[transport]?.real || [];
  return blend(real, fallback, (r) => r.day === ctx.day);
}

// Marge de sécurité invisible (R4) : SOUSTRAITE de l'heure de départ,
// jamais affichée ni nommée.
//
// J3 (DEC-12) · `varBoost` a disparu. Il gonflait la composante variance
// d'une destination jamais mesurée, mais multipliait une variance nulle :
// il ne faisait rien précisément dans le cas pour lequel il existait. La
// variance a priori couvre le même besoin, et fonctionne.
export function safetyMargin(totalVariance, latenessScore) {
  return Math.round(
    MARGIN_FLOOR + Math.min(totalVariance * VAR_WEIGHT, VAR_CAP) + latenessScore * LATE_WEIGHT,
  );
}

// B1 · N'écrit que des durées réellement mesurées entre deux confirmations
// (R3), au fil de l'eau plutôt qu'au bilan de fin de session : sans ça,
// fermer l'app pendant le trajet (ce que l'écran Trajet invite à faire)
// perdait silencieusement toutes les mesures de la préparation.
// realDurs : tableau { stepKey, v }.
export function recordDurations(state, realDurs, ctx) {
  const profileId = ctx.profileId ?? state.activeProfileId;
  const profile = state.profiles?.find((p) => p.id === profileId);
  const steps = profile?.steps || [];
  for (const { stepKey, v } of realDurs || []) {
    const step = steps.find((s) => s.key === stepKey);
    if (!step) continue;
    step.real.push({ v, day: ctx.day, type: ctx.type });
    if (step.real.length > 8) step.real.shift(); // FIFO max 8
  }
  return state;
}

// Le bilan déclaratif ne conditionne plus l'écriture des durées : il ne met
// à jour que le ressenti de ponctualité, latenessScore et l'historique.
export function recordOutcome(state, status, ctx) {
  state.history.push({
    ts: Date.now(),
    status,
    day: ctx.day,
    type: ctx.type,
    profileId: ctx.profileId ?? state.activeProfileId ?? null,
  });
  if (state.history.length > MAX_HISTORY) state.history.shift(); // FIFO

  const target = status === 'late' ? 1 : status === 'ontime' ? 0.4 : 0.15;
  state.latenessScore = state.latenessScore * 0.6 + target * 0.4;
  return state;
}

// Moteur d'apprentissage on-device et marge de sécurité invisible.
// Règles : R3 (n'apprendre que du réel), R4 (marge jamais affichée).
// Fonctions pures, aucun DOM.

import { MAX_HISTORY } from './store.js';

function meanAndSpread(values) {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const spread = values.length < 2
    ? 0
    : Math.sqrt(values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length);
  return { mean, spread };
}

// Renvoie { dur, variance, confidence } pour une étape dans un contexte donné.
export function predict(step, ctx) {
  const real = step.real || [];
  if (real.length === 0) {
    return { dur: step.est, variance: 0, confidence: 0 };
  }

  // Segmentation contextuelle : même jour OU même type.
  let pool = real.filter((r) => r.day === ctx.day || r.type === ctx.type);
  if (pool.length < 2) pool = real;

  const { mean, spread } = meanAndSpread(pool.map((r) => r.v));
  const w = Math.min(real.length / 5, 1);
  const dur = Math.round(step.est * (1 - w) + mean * w);
  return { dur, variance: Math.round(spread), confidence: w };
}

// Prédiction du trajet réel (F5, spec v2 §8.3) : même logique que predict(),
// segmentée par jour, pondérée par le nombre de mesures.
// fallback = durée déclarative utilisée tant qu'on n'a rien mesuré.
export function predictTravel(destination, transport, ctx, fallback) {
  const real = destination?.byTransport?.[transport]?.real || [];
  if (real.length === 0) {
    return { dur: fallback, variance: 0, confidence: 0 };
  }

  let pool = real.filter((r) => r.day === ctx.day);
  if (pool.length < 2) pool = real;

  const { mean, spread } = meanAndSpread(pool.map((r) => r.v));
  const w = Math.min(real.length / 5, 1);
  const dur = Math.round(fallback * (1 - w) + mean * w);
  return { dur, variance: Math.round(spread), confidence: w };
}

// Marge de sécurité invisible (R4).
// SOUSTRAITE de l'heure de départ, JAMAIS affichée ni nommée à l'utilisateur.
// varBoost : gonflement de la composante variance pour une destination encore
// inconnue (spec v2 §8.2, +50 %), plafonné par le min(.., 10) existant.
export function safetyMargin(totalVariance, latenessScore, varBoost = 1) {
  const fromVar = Math.min(totalVariance * 0.8 * varBoost, 10);
  const fromLate = latenessScore * 8;
  return Math.round(3 + fromVar + fromLate);
}

// B1 · Injecte uniquement des durées réellement mesurées entre deux
// confirmations (R3). Appelée au fil de l'eau, à chaque confirmation, et non
// plus seulement au bilan de fin de session : sans ça, fermer l'app pendant
// le trajet (ce que l'écran Trajet invite explicitement à faire) perdait
// silencieusement toutes les mesures de la préparation.
// realDurs : tableau { stepKey, v }, une ou plusieurs mesures.
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

// Le bilan déclaratif ne conditionne plus l'écriture des durées (voir
// recordDurations ci-dessus) : il ne met à jour que le ressenti de
// ponctualité, latenessScore et l'historique.
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

// Conservée pour composer les deux d'un coup là où c'est légitime (tests,
// scénarios hors session live). Le guidage live n'appelle plus cette forme :
// il appelle recordDurations au fil de l'eau et recordOutcome au bilan.
export function onFeedback(state, status, realDurs, ctx) {
  recordDurations(state, realDurs, ctx);
  recordOutcome(state, status, ctx);
  return state;
}

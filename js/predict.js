// Moteur d'apprentissage on-device et marge de sécurité invisible.
// Règles : R3 (n'apprendre que du réel), R4 (marge jamais affichée).
// Fonctions pures, aucun DOM.

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

// Met à jour latenessScore et injecte uniquement des durées réellement mesurées.
// realDurs : tableau { stepKey, v } collecté en live.
export function onFeedback(state, status, realDurs, ctx) {
  state.history.push({
    ts: Date.now(),
    status,
    day: ctx.day,
    type: ctx.type,
    profileId: ctx.profileId ?? state.activeProfileId ?? null,
  });

  const target = status === 'late' ? 1 : status === 'ontime' ? 0.4 : 0.15;
  state.latenessScore = state.latenessScore * 0.6 + target * 0.4;

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

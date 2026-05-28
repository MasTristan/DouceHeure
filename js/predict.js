// Moteur d'apprentissage on-device et marge de sécurité invisible.
// Règles : R3 (n'apprendre que du réel), R4 (marge jamais affichée).

// Renvoie { dur, variance, confidence } pour une étape dans un contexte donné.
export function predict(step, ctx) {
  const real = step.real || [];
  if (real.length === 0) {
    return { dur: step.est, variance: 0, confidence: 0 };
  }

  // Segmentation contextuelle : même jour OU même type.
  let pool = real.filter((r) => r.day === ctx.day || r.type === ctx.type);
  if (pool.length < 2) pool = real;

  const values = pool.map((r) => r.v);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.length < 2
    ? 0
    : Math.sqrt(values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length);

  const w = Math.min(real.length / 5, 1);
  const dur = Math.round(step.est * (1 - w) + mean * w);
  return { dur, variance: Math.round(variance), confidence: w };
}

// Marge de sécurité invisible (R4).
// SOUSTRAITE de l'heure de départ, JAMAIS affichée ni nommée à l'utilisateur.
export function safetyMargin(totalVariance, latenessScore) {
  const fromVar = Math.min(totalVariance * 0.8, 10);
  const fromLate = latenessScore * 8;
  return Math.round(3 + fromVar + fromLate);
}

// Met à jour latenessScore et injecte uniquement des durées réellement mesurées.
// realDurs : tableau { stepKey, v } collecté en live.
export function onFeedback(state, status, realDurs, ctx) {
  state.history.push({ ts: Date.now(), status, day: ctx.day, type: ctx.type });

  const target = status === 'late' ? 1 : status === 'ontime' ? 0.4 : 0.15;
  state.latenessScore = state.latenessScore * 0.6 + target * 0.4;

  for (const { stepKey, v } of realDurs || []) {
    const step = state.steps.find((s) => s.key === stepKey);
    if (!step) continue;
    step.real.push({ v, day: ctx.day, type: ctx.type });
    if (step.real.length > 8) step.real.shift(); // FIFO max 8
  }
  return state;
}

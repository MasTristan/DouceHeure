// Utilitaires temps. Fonctions pures, pas d'effet de bord.

// 'HH:MM' -> minutes depuis minuit (0..1439)
export function toMin(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + m;
}

// minutes -> 'HH:MM', wrap modulo 24h, gère négatifs et > 1440.
export function fromMin(min) {
  const total = ((Math.round(min) % 1440) + 1440) % 1440;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

// F1 · Mode chevet : logique temporelle du réveil. Aucun DOM ici.
// Le rendu (horloge, voile, gestes) vit dans ui.js.
// La cible de réveil est un timestamp absolu recalculé à chaque tick :
// aucune dérive possible, y compris si l'onglet a été gelé (spec v2 §5.4).

export const WAKE_RISE_SECONDS = 90;     // montée du son de réveil
export const SNOOZE_SILENT_MIN = 5;      // re-proposition lumineuse, jamais sonore (R5)
export const MISSED_WAKE_WINDOW_MIN = 60;

// Prochain timestamp absolu correspondant à 'HH:MM' (aujourd'hui si encore
// devant nous, sinon demain).
export function nextWakeTimestamp(wakeTime, now = Date.now()) {
  const [h, m] = String(wakeTime).split(':').map(Number);
  const d = new Date(now);
  d.setHours(h, m, 0, 0);
  if (d.getTime() <= now) d.setDate(d.getDate() + 1);
  return d.getTime();
}

// Phase de la nuit par rapport au timestamp de réveil armé.
// 'night' : avant l'aube logicielle.
// 'dawn'  : interpolation Nuit -> Aube, progress 0..1.
// 'wake'  : heure atteinte, le son monte.
export function bedsidePhase(wakeTs, lightLeadMin, now = Date.now()) {
  const dawnStart = wakeTs - lightLeadMin * 60000;
  if (now < dawnStart) return { phase: 'night', progress: 0 };
  if (now < wakeTs) {
    return { phase: 'dawn', progress: (now - dawnStart) / (wakeTs - dawnStart) };
  }
  return { phase: 'wake', progress: 1 };
}

// L'app a été tuée pendant la nuit : au lancement dans la fenêtre
// [wakeTs, wakeTs + 60 min], on propose directement de commencer le matin.
export function missedWake(bedside, now = Date.now()) {
  if (!bedside?.armedWakeTs) return false;
  return now >= bedside.armedWakeTs
    && now <= bedside.armedWakeTs + MISSED_WAKE_WINDOW_MIN * 60000;
}

// Arme le chevet pour la nuit : fige le timestamp absolu de réveil.
export function armBedside(bedside, now = Date.now()) {
  bedside.armedWakeTs = nextWakeTimestamp(bedside.wakeTime, now);
  return bedside.armedWakeTs;
}

export function disarmBedside(bedside) {
  if (bedside) delete bedside.armedWakeTs;
}

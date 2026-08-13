// Machine à états pure du guidage en direct (S1 étape 3, S1-socle-de-
// confiance.md). Répond à « quel est l'état de la session » et « que se
// passe-t-il quand l'utilisateur confirme », jamais à « faut-il avancer
// maintenant ». Aucun DOM, aucun effet de bord (pas de rendu, pas d'audio,
// pas de persistance) : testée comme plan.js.
//
// L'invariant à préserver ici, mot pour mot (CLAUDE.md §6) : « l'horloge
// sert UNIQUEMENT à savoir si on est dans les temps. Elle ne change JAMAIS
// l'étape courante. Seul un geste de confirmation accompli avance. »
// computeConfirm() est le SEUL point de ce module qui décrit un changement
// d'étape, et il n'est jamais appelé par le temps qui passe : uniquement
// par un geste de confirmation accompli (R2), côté appelant (ui.js).

import { projectLeave } from './plan.js';

export function currentStep(live) {
  return live.sequence[live.current];
}

// Prochaine étape non sautée après l'étape courante, ou -1 s'il n'y en a
// plus (fin de séquence).
export function nextStepIdx(live) {
  for (let i = live.current + 1; i < live.sequence.length; i++) {
    if (!live.sequence[i].skipped) return i;
  }
  return -1;
}

// Statut de la session à l'instant `now` (ms epoch) et `nowMin` (minutes
// depuis minuit, pour la projection de l'heure de départ). Pure : ne
// modifie ni ne lit rien d'autre que ses arguments.
export function liveStatus(live, now, nowMin) {
  const step = currentStep(live);
  const elapsedMin = (now - live.startedAt) / 60000;
  const suggested = elapsedMin >= step.dur && live.current < live.sequence.length - 1;
  const nudgeThreshold = Math.max(step.dur * 1.6, step.dur + 4);
  const nudge = step.dur > 0 && elapsedMin >= nudgeThreshold;

  const projected = projectLeave(live.sequence, live.current, nowMin);
  let slip = projected - live.leaveMin;
  if (slip > 720) slip -= 1440;
  if (slip < -720) slip += 1440;

  return { step, suggested, nudge, slip, elapsedMin, projected };
}

// Décrit ce qui doit se passer quand un geste de confirmation accompli
// survient (R2). Ne modifie PAS `live` : renvoie une description que
// l'appelant applique (écriture de la mesure, effets, rendu). C'est la
// séparation qui rend l'invariant testable : rien dans ce module ne peut
// faire avancer une étape autrement qu'en réponse à cet appel explicite.
//
// R3 : `measurement` vaut null quand rien ne doit être écrit (étape
// polluée par un imprévu, ou étape 'leave' qui n'a pas de durée à mesurer).
export function computeConfirm(live, now) {
  const step = currentStep(live);
  const realDur = Math.max(1, Math.round((now - live.startedAt) / 60000));
  const measurement = (step.key !== 'leave' && !live.polluted)
    ? { stepKey: step.key, v: realDur }
    : null;

  const next = nextStepIdx(live);
  if (next === -1 || step.key === 'leave') {
    return { ended: true, measurement };
  }

  return {
    ended: false,
    measurement,
    nextCurrent: next,
    nextStartedAt: now,
    reachedLeave: live.sequence[next].key === 'leave',
  };
}

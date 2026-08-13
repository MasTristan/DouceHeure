// Contexte temporel courant, lu via l'horloge injectable (ADR-004). Deux
// petites fonctions partagées par ui.js et live/controller.js : elles
// vivent à part pour qu'aucun des deux n'ait à importer l'autre juste
// pour ça (ce qui recréerait le cycle que la découpe élimine).

import { clock } from './clock.js';

export function ctxNow() {
  const d = new Date(clock.now());
  const day = d.getDay();
  const type = day >= 1 && day <= 5 ? 'work' : 'other';
  return { day, type };
}

export function nowMinutes() {
  const d = new Date(clock.now());
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
}

// J1 découpe étape 5 (Nour, R1 §1.3-1.4) · Registre interne au sous-système
// night, même principe que live/registry.js : controller.js et view.js
// s'appellent nécessairement en croix (startNight/nightTick -> renderNight
// -> stopNight -> ... -> renderNight). Une table de fonctions plutôt qu'un
// cycle d'imports statiques entre eux.
//
// setup.js n'a pas besoin de ce registre : il importe startNight
// directement (controller.js ne dépend jamais de setup.js en retour, donc
// aucun cycle).
export const nightNav = {};

export function registerNight(map) {
  Object.assign(nightNav, map);
}

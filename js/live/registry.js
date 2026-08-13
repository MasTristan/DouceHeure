// J1 découpe étape 4 (Nour, R1 §1.3-1.4) · Registre interne au sous-système
// live, même principe que ui/nav.js : controller.js, view.js, drawer.js et
// leave.js s'appellent nécessairement en croix (confirmNext -> renderLive
// -> renderLeave -> stopLiveSession -> closeDrawer -> ... -> renderLive).
// Une table de fonctions plutôt qu'un cycle d'imports statiques entre eux.
//
// Règle appliquée uniformément, pas au cas par cas : tout appel d'une
// fonction définie dans un AUTRE fichier de live/ passe par liveNav, même
// quand un import direct serait techniquement sûr. Un import() dynamique
// n'est jamais utilisé ici (cf. tests/imports.test.mjs et le refus de
// Nour, R1 §1.3, sur ce point précis).
export const liveNav = {};

export function registerLive(map) {
  Object.assign(liveNav, map);
}

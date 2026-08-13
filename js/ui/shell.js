// J1 découpe étape 1 (Nour, R1 §1.4) · L'état partagé le plus simple :
// l'élément racine et l'écran actuellement affiché. Privatisés ici, exposés
// par des fonctions plutôt que par des variables exportées, pour que le
// reste de l'app ne puisse jamais les muter en dehors de ce module.

import * as audio from '../audio.js';
import * as haptics from '../haptics.js';
import * as speech from '../speech.js';

// Recherché à chaque appel plutôt que capturé une fois au chargement du
// module : ce module n'est PAS réimporté à chaque session (contrairement à
// ui.js, qui l'est dans les tests via un suffixe de requête à chaque
// import). Une capture unique au chargement figerait `root` sur le premier
// `document` jamais vu par ce processus, un piège invisible en production
// (un seul `document` de toute façon) mais silencieusement cassant en test.
function getRoot() {
  return document.getElementById('app');
}

// Suivi de l'écran courant, pour ne jouer l'animation d'entrée qu'au
// changement d'écran (pas à chaque re-rendu du même écran, ex. le live
// re-rendu toutes les 5 s par son ticker).
let currentScreen = null;

export function render(node, screenKey) {
  if (screenKey && screenKey !== currentScreen) {
    node.classList.add('screen--enter');
    currentScreen = screenKey;
  }
  getRoot().replaceChildren(node);
}

// Remet le suivi à zéro (retour à l'accueil "frais") : le prochain écran,
// quel qu'il soit, est traité comme un changement et joue l'animation.
export function resetScreen() {
  currentScreen = null;
}

// Bascule directe, sans passer par render() : utilisée par les écrans qui
// se re-rendent souvent sans vouloir rejouer l'animation d'entrée à chaque
// fois (mode chevet, dont le ticker tourne toutes les 30 s).
export function setScreen(key) {
  currentScreen = key;
}

export function isScreen(key) {
  return currentScreen === key;
}

export function applySettings(state) {
  document.body.classList.toggle('readable', !!state.settings.readable);
  audio.setEnabled(state.settings.sound !== false);
  haptics.setEnabled(state.settings.haptics !== false);
  speech.configure(state.settings.voice);
}

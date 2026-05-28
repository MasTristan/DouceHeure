// Orchestration et démarrage.

import { loadState, saveState } from './store.js';
import * as audio from './audio.js';
import { showHome } from './ui.js';

// Service Worker pour le cache hors-ligne.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  });
}

// État initial : charge (et crée si besoin) la persistance.
const state = loadState();
audio.setEnabled(state.sound !== false);
saveState(state);

// Premier rendu.
showHome();

// Toggle son global, accessible depuis la console et un futur menu réglages.
window.douceHeure = {
  toggleSound() {
    const s = loadState();
    s.sound = !s.sound;
    saveState(s);
    audio.setEnabled(s.sound);
    return s.sound;
  }
};

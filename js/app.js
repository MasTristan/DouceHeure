// Orchestration et démarrage.

import { loadState, saveState, getActiveProfile, purgePendingSession } from './store.js';
import { purgeExpiredTrip } from './travel.js';
import * as audio from './audio.js';
import * as haptics from './haptics.js';
import * as speech from './speech.js';
import * as scene from './scene.js';
import { UI } from './copy.js';
import { showHome } from './screens/home.js';
import { showPreview } from './screens/preview.js';
import { showOnboarding } from './screens/onboarding.js';
import { showTrip } from './screens/trip.js';
import { showFeedback } from './screens/feedback.js';
import { showMornings } from './screens/mornings.js';
import { showSettings } from './screens/settings.js';
import { showSocial } from './screens/social.js';
import { showBedsideSetup } from './night/setup.js';
import { registerScreens } from './ui/nav.js';
// J1 découpe étape 7 : app.js est désormais le point de composition (la
// façade ui.js a disparu). live/view.js, live/drawer.js, live/leave.js et
// night/view.js ne sont importés nulle part ailleurs : sans cet import,
// leur auto-enregistrement dans liveNav/nightNav ne se produirait jamais,
// et live/controller.js et night/controller.js planteraient au premier
// appel à liveNav.renderLive()/nightNav.renderNight() (S1 §4).
import './live/controller.js';
import './live/view.js';
import './live/drawer.js';
import './live/leave.js';
import './night/controller.js';
import './night/view.js';

// J1 découpe étape 3 (Nour, R1 §1.3) : registre de navigation rempli une
// fois ici, au démarrage. Casse le cycle d'imports studio.js <-> ui.js
// (studio.js appelait jusqu'ici import('./ui.js').then(m => m.showHome())
// pour l'éviter ; il appelle désormais nav.home() directement).
// J1 découpe étape 4 : trip/feedback ajoutés pour que live/leave.js
// (departNow) et live/controller.js (endLive) puissent y naviguer sans
// importer ui.js (cycle interdit tant que ces écrans y restent).
// J1 découpe étape 5 : preview ajouté pour que night/view.js
// (renderGoodMorning) puisse y naviguer de la même façon.
// J1 découpe étape 6 : mornings/settings/social ajoutés, chaque écran
// plat naviguant désormais vers un autre uniquement via ce registre
// (jamais d'import direct entre deux fichiers de screens/, cycle garanti
// sinon : home -> preview/mornings/settings, settings -> social/home...).
registerScreens({
  home: showHome, trip: showTrip, feedback: showFeedback, preview: showPreview,
  mornings: showMornings, settings: showSettings, social: showSocial,
});

// Service Worker pour le cache hors-ligne. Toast discret quand une mise à
// jour est prête, jamais bloquant.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').then((reg) => {
      reg.addEventListener('updatefound', () => {
        const worker = reg.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            const t = document.createElement('div');
            t.className = 'toast';
            t.textContent = UI.toast_update;
            document.body.appendChild(t);
            setTimeout(() => t.remove(), 5000);
          }
        });
      });
    }).catch(() => {});
  });
}

// État initial : charge (migre v1 -> v2 au passage), purge un trajet périmé
// et un marqueur de session interrompue depuis trop longtemps (B1).
let state = loadState();
purgeExpiredTrip(state);
purgePendingSession(state);
saveState(state);

audio.setEnabled(state.settings.sound !== false);
haptics.setEnabled(state.settings.haptics !== false);
speech.configure(state.settings.voice);
document.body.classList.toggle('readable', !!state.settings.readable);

// Scène pilotée par l'horloge locale, débrayable en réglages.
scene.applyScene(scene.resolveScene(state.settings, new Date().getHours()));
scene.startCanvas();

// F8 · Pont Raccourcis : paramètres d'URL. Invalides : ignorés en silence.
// Jamais de lancement du live sans tap (R2) : go=1 ouvre seulement le preview.
function applyUrlParams() {
  let params;
  try {
    params = new URLSearchParams(location.search);
  } catch {
    return false;
  }
  if (![...params.keys()].length) return false;

  const chevet = params.get('chevet');
  if (chevet && /^\d{1,2}:\d{2}$/.test(chevet)) {
    showBedsideSetup(chevet.padStart(5, '0'));
    return true;
  }

  const rawProfile = params.get('profil');
  let profile = null;
  if (rawProfile) {
    const needle = rawProfile.trim().toLowerCase();
    profile = state.profiles.find((p) =>
      p.id === rawProfile || p.name.toLowerCase() === needle) || null;
    if (profile) {
      state.activeProfileId = profile.id;
      saveState(state);
    }
  }

  const arrivee = params.get('arrivee');
  const prefill = {};
  if (arrivee && /^\d{1,2}:\d{2}$/.test(arrivee)) {
    prefill.arrival = arrivee.padStart(5, '0');
  }

  if (params.get('go') === '1' || profile || prefill.arrival) {
    showPreview((profile || getActiveProfile(state))?.id, prefill);
    return true;
  }
  return false;
}

// Premier rendu : onboarding au tout premier lancement, sinon accueil.
if (!applyUrlParams()) {
  if (!state.onboarded) showOnboarding();
  else showHome();
}

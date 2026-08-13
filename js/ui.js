// Point de composition (S1 §4, DEC-02) : importe les sous-systèmes et les
// écrans pour leur auto-enregistrement dans les registres (ui/nav.js,
// live/registry.js, night/registry.js), et réexporte ce dont app.js a
// besoin pour démarrer l'app. Aucune règle de calcul ici, aucun rendu non
// plus : ce fichier ne fait plus que rassembler.
//
// J1 découpe étape 7 (S1-socle-de-confiance.md) : dernière étape prévue,
// qui fait disparaître cette façade au profit d'imports directs depuis
// app.js vers l'emplacement final de chaque module.

// Helpers DOM et coquille sans état métier (découpe étape 1).
export { el, wordmark, topbar, toast, announce, settingRow } from './ui/dom.js';
export { render, resetScreen, setScreen, isScreen, applySettings } from './ui/shell.js';
export { holdButton, isHoldActive } from './ui/gesture.js';

// Live (état + rendu du guidage, F2/F3/F4, découpe étape 4). ui.js importe
// les quatre modules pour leur auto-enregistrement dans liveNav ; seul
// startLive est utilisé directement, par screens/preview.js.
import './live/controller.js';
import './live/view.js';
import './live/drawer.js';
import './live/leave.js';

// Mode chevet (F1, découpe étape 5). Même principe.
export { showBedsideSetup } from './night/setup.js';
import './night/controller.js';
import './night/view.js';

// Les huit écrans plats (découpe étape 6). Chacun s'enregistre lui-même
// dans le registre de navigation (ui/nav.js) via app.js ; ce fichier les
// réexporte pour ce que app.js et les tests en attendent encore.
export { showOnboarding } from './screens/onboarding.js';
export { showHome } from './screens/home.js';
export { showPreview } from './screens/preview.js';
export { showTrip } from './screens/trip.js';
export { showFeedback } from './screens/feedback.js';
export { showMornings } from './screens/mornings.js';
export { showSettings } from './screens/settings.js';
export { showSocial } from './screens/social.js';

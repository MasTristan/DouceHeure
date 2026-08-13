// J1 découpe étape 5 (Nour, R1 §1.4) · États et transitions du mode
// chevet (F1, spec v2 §6). Piège connu et permanent (CLAUDE.md §6) :
// l'aube logicielle ne lance JAMAIS le live, et la scène Nuit n'est
// choisie que par ce module, jamais par l'horloge locale ni les réglages.

import { clock } from '../clock.js';
import { bedsidePhase, disarmBedside, SNOOZE_SILENT_MIN, WAKE_RISE_SECONDS } from '../bedside.js';
import { loadState, saveState } from '../store.js';
import * as audio from '../audio.js';
import * as haptics from '../haptics.js';
import * as scene from '../scene.js';
import * as wake from '../wakelock.js';
import { resetScreen } from '../ui/shell.js';
import { nav } from '../ui/nav.js';
import { nightNav, registerNight } from './registry.js';

// État du mode chevet (mémoire, pas persisté).
let night = null;
let nightTicker = null;

export function getNight() {
  return night;
}

// Même garde que startLive() (live/controller.js), même défaut d'origine
// (Nour, R1 §1.6).
export function startNight(bedside) {
  if (night) return;
  night = {
    bedside,
    wakeTs: bedside.armedWakeTs,
    veil: 0.55,
    ringing: false,
    snoozedAt: null,
    clockShift: 0,
  };
  scene.applyScene('night');
  scene.setLight(0, 0.5);
  wake.acquire();
  wake.bindVisibility();
  nightNav.renderNight();
  nightTicker = clock.setInterval(nightTick, 30000); // pas de rAF la nuit
}

export function stopNight(toHome) {
  clock.clearInterval(nightTicker);
  nightTicker = null;
  audio.stopWake();
  const s = loadState();
  if (s.bedside) { disarmBedside(s.bedside); saveState(s); }
  night = null;
  if (toHome) {
    wake.release();
    resetScreen();
    nav.home();
  }
}

// L'horloge ne sert ici qu'à savoir quelle phase de la nuit on traverse
// (dawn, wake) : elle ne déclenche jamais elle-même une avancée d'écran
// vers le live. Seul startRinging() propose l'écran de réveil, et seul un
// geste tenu sur cet écran (renderWakeProposal, js/night/view.js) confirme
// le lever (R2 étendu au réveil).
function nightTick() {
  if (!night) return;
  const { phase, progress } = bedsidePhase(night.wakeTs, night.bedside.lightLeadMin, clock.now());

  if (phase === 'dawn') {
    // L'aube logicielle : du quasi-noir à la pénombre chaude.
    scene.setLight(progress * 0.35, 0.6);
    night.veil = Math.max(0, 0.55 * (1 - progress));
  }

  if (phase === 'wake' && !night.ringing && !night.snoozedAt) {
    startRinging();
  }

  // Re-proposition silencieuse 5 min après "Pas encore" : lumière seulement (R5).
  if (night.snoozedAt && clock.now() - night.snoozedAt >= SNOOZE_SILENT_MIN * 60000) {
    night.snoozedAt = null;
    night.silentRepropose = true;
    nightNav.renderWakeProposal();
    return;
  }

  // Anti burn-in : décalage de 1 px toutes les 60 s (un tick sur deux).
  night.tickCount = (night.tickCount || 0) + 1;
  if (night.tickCount % 2 === 0) night.clockShift = (night.clockShift + 1) % 3;

  if (night.ringing) return; // l'écran de réveil gère son propre rendu
  nightNav.renderNight();
}

function startRinging() {
  night.ringing = true;
  const ok = night.bedside.sound ? audio.startWake(WAKE_RISE_SECONDS) : false;
  if (night.bedside.sound && !ok) {
    // Repli : contexte suspendu malgré tout -> lumière seule + vibration.
    haptics.buzz('arrive');
    night.soundFallback = true;
  }
  scene.setLight(0.5, 0.7);
  nightNav.renderWakeProposal();
}

registerNight({ getNight, stopNight });

// Réinitialisation réservée aux tests (miroir de resetClock()/js/clock.js
// et resetLiveForTests()/js/live/controller.js) : ce module est importé de
// façon STATIQUE par ui.js, donc jamais réinstancié malgré le suffixe de
// requête utilisé par les tests pour réimporter ui.js à chaque cas.
export function resetNightForTests() {
  clock.clearInterval(nightTicker);
  nightTicker = null;
  night = null;
}

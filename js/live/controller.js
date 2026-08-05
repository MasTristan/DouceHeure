// J1 découpe étape 4 (Nour, R1 §1.4) · États et transitions du Live
// (spec v2 §7). La décision d'avancement vit dans js/live.js (pure,
// testée sans DOM, S1 étape 3) : ce fichier applique cette décision
// (persistance, audio, rendu), il ne la recalcule jamais. Seul un geste
// de confirmation accompli (confirmNext) fait avancer l'étape courante
// (R2, "le bug de la douche" : voir CLAUDE.md §6).

import { clock } from '../clock.js';
import { ctxNow, nowMinutes } from '../now.js';
import { loadState, saveState, startPendingSession, clearPendingSession } from '../store.js';
import { recordDurations } from '../predict.js';
import { projectLeave, shouldRescue, rescueCandidates } from '../plan.js';
import {
  currentStep as pureCurrentStep, nextStepIdx as pureNextStepIdx,
  liveStatus as pureLiveStatus, computeConfirm,
} from '../live.js';
import { pick, UI } from '../copy.js';
import { toast, announce } from '../ui/dom.js';
import { nav } from '../ui/nav.js';
import * as haptics from '../haptics.js';
import * as audio from '../audio.js';
import * as speech from '../speech.js';
import * as scene from '../scene.js';
import * as wake from '../wakelock.js';
import { liveNav, registerLive } from './registry.js';

// État de session live (mémoire, pas persisté).
let live = null;
let liveTicker = null;

export function getLive() {
  return live;
}

// Garde contre un double appel (Nour, R1 §1.6) : deux taps rapides sur le
// CTA de l'Aperçu, avant que le premier rendu de l'écran live ne remplace
// ce bouton, appelaient startLive() deux fois. Le second clock.setInterval
// écrasait la référence liveTicker du premier, qui ne pouvait alors plus
// jamais être nettoyé par stopLiveSession() : un ticker fantôme tournait
// jusqu'à la fermeture de la page.
export function startLive(plan, meta) {
  if (live) return;
  const ctx = ctxNow();
  const state = loadState();
  live = {
    sequence: plan.sequence.map((s) => ({ ...s })),
    leaveMin: plan.leaveMin,
    arrivalMin: plan.arrivalMin,
    margin: plan.margin,
    startMin: plan.startMin,
    current: 0,
    startedAt: clock.now(),
    measurements: [],
    nudged: false,
    polluted: false,
    paused: false,
    rescueOffered: false,
    rescueVisible: false,
    confirmMode: state.settings.confirmMode,
    profileId: meta.profile.id,
    destinationId: meta.data.destinationId,
    transport: meta.data.transport,
    sentContactIds: new Set(),
    ctx,
  };
  // B1 : marqueur léger, purgé silencieusement après 8 h. Les mesures elles-
  // mêmes sont écrites au fil de l'eau par confirmNext, pas ici.
  startPendingSession(state, meta.profile.id, ctx);
  saveState(state);
  wake.acquire();
  wake.bindVisibility();
  scene.setLight(0.08, 0.5);
  if (state.settings.ambient) {
    audio.startAmbient();
    audio.setAmbientOpenness(0.08);
  }
  speakStep();
  liveNav.renderLive();
  liveTicker = clock.setInterval(() => liveNav.renderLive(), 5000);
}

// S1 étape 3 : la décision vit dans js/live.js (pure, testée sans DOM).
// Ces trois fonctions ne sont plus que des câblages vers l'état courant du
// module et l'horloge injectable, pour garder tous les appels existants
// inchangés ci-dessous.
function currentStep() {
  return pureCurrentStep(live);
}

export function nextStepIdx() {
  return pureNextStepIdx(live);
}

export function liveStatus() {
  return pureLiveStatus(live, clock.now(), nowMinutes());
}

// Position temporelle dans le plan -> lumière de scène (spec v2 §2).
export function updateLiveLight(slip) {
  const total = Math.max(1, live.sequence.length - 1);
  const progress = live.current / total;
  const tempo = Math.min(Math.max(-slip / 6, -1), 1);
  const { l, warm } = scene.sessionLight(progress, tempo);
  scene.setLight(l, warm);
  audio.setAmbientOpenness(l);
}

function speakStep() {
  const step = currentStep();
  if (!live.stepMessage || live.lastMessageStep !== live.current) {
    live.stepMessage = pick(step.key === 'leave' ? 'leave' : (step.key.startsWith('free') ? 'free' : step.key)) || pick('free');
    live.lastMessageStep = live.current;
  }
  announce(`${step.label}. ${live.stepMessage}`);
  speech.speak(`${step.label}. ${live.stepMessage}`);
}

// Seul un geste de confirmation accompli appelle cette fonction (R2).
// La décision (mesure à écrire ou non, prochaine étape, fin de session)
// vient de computeConfirm() (js/live.js, pure) : ici, on applique cette
// décision (persistance, audio, rendu), on ne la recalcule pas.
export function confirmNext() {
  if (!live || live.paused) return;
  const result = computeConfirm(live, clock.now());

  // R3 : mesure RÉELLE entre deux confirmations. Une étape polluée par un
  // imprévu (F6) n'écrit RIEN (result.measurement est alors null).
  if (result.measurement) {
    live.measurements.push(result.measurement);
    // B1 : écriture immédiate, pas d'attente d'un bilan de fin de session
    // qui peut ne jamais arriver (l'app peut être fermée depuis l'écran
    // Trajet, ce qu'elle invite elle-même à faire).
    const state = loadState();
    recordDurations(state, [result.measurement], live.ctx);
    saveState(state);
  }
  live.polluted = false;

  if (result.ended) {
    return endLive();
  }

  live.current = result.nextCurrent;
  live.startedAt = result.nextStartedAt;
  live.nudged = false;
  live.stepMessage = null;
  audio.cue(result.reachedLeave ? 'arrive' : 'confirm');
  if (result.reachedLeave) haptics.buzz('arrive');

  const { slip } = liveStatus();
  updateLiveLight(slip);
  maybeOfferRescue(slip);
  speakStep();
  liveNav.renderLive();
}

// F3 · Rattrapage : une proposition par session maximum (R5).
export function maybeOfferRescue(slip) {
  if (live.rescueOffered || live.rescueVisible) return;
  if (currentStep().key === 'leave') return;
  const projected = projectLeave(live.sequence, live.current, nowMinutes());
  if (!shouldRescue(projected, live.leaveMin, live.margin)) return;
  const candidates = rescueCandidates(live.sequence, live.current);
  if (!candidates.length) return;
  live.rescueVisible = true;
  live.rescueSelection = new Set(candidates.map((s) => s.key));
}

export function applyRescue(keep) {
  live.rescueVisible = false;
  live.rescueOffered = true; // ne revient pas de la session
  if (!keep) {
    for (const s of live.sequence) {
      if (live.rescueSelection.has(s.key)) s.skipped = true; // aucune mesure (R3)
    }
    const { slip } = liveStatus();
    updateLiveLight(slip); // la scène regagne en dorure
  }
  liveNav.renderLive();
}

// F6 · Imprévu : pause explicite. À la reprise, l'étape en cours est
// marquée polluée : aucune écriture à sa confirmation (R3).
export function pauseLive() {
  if (!live) return;
  live.paused = true;
  liveNav.closeDrawer();
  liveNav.renderLive();
}

export function resumeLive() {
  if (!live) return;
  live.paused = false;
  live.polluted = true;
  const { slip } = liveStatus();
  updateLiveLight(slip); // recalage sans drame
  toast(UI.wordmark, pick('pause_resumed'));
  liveNav.renderLive();
}

export function stopLiveSession() {
  clock.clearInterval(liveTicker);
  liveTicker = null;
  liveNav.closeDrawer();
  wake.release();
  audio.stopAmbient();
  speech.cancel();
  live = null;
  const state = loadState();
  clearPendingSession(state);
  saveState(state);
}

function endLive() {
  // Fin atteinte sans départ explicite : on passe au bilan directement.
  const session = {
    measurements: live.measurements,
    ctx: live.ctx,
    profileId: live.profileId,
    confirmedSteps: live.sequence
      .filter((s, i) => i < live.current && !s.skipped && s.key !== 'leave')
      .map((s) => ({ label: s.label, confirmed: true })),
  };
  stopLiveSession();
  nav.feedback(session);
}

export function abortLive() {
  stopLiveSession();
  scene.resetLight();
  toast(UI.wordmark, UI.live_quit_confirmed);
  nav.home();
}

registerLive({
  getLive, confirmNext, nextStepIdx, liveStatus, updateLiveLight,
  maybeOfferRescue, applyRescue, pauseLive, resumeLive, abortLive, stopLiveSession,
});

// Réinitialisation réservée aux tests (miroir de resetClock(), js/clock.js).
// En production, ui.js n'est chargé qu'une fois par page ; dans les tests,
// il est réimporté à chaque cas avec un suffixe de requête pour repartir
// d'un état frais (S1 étape 2). Ce module, lui, est importé de façon
// STATIQUE par ui.js : il n'est donc jamais réinstancié, et `live`
// resterait sinon figé par la première session créée dans le process de
// test, bloquant silencieusement toute session suivante (if (live) return;).
export function resetLiveForTests() {
  clock.clearInterval(liveTicker);
  liveTicker = null;
  live = null;
}

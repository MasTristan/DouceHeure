// J1 découpe étape 5 (Nour, R1 §1.4) · Rendu du mode chevet (F1, spec v2
// §6) : l'écran de nuit, la proposition de réveil, et le bonjour qui suit.

import { el, wordmark, toast } from '../ui/dom.js';
import { render, setScreen } from '../ui/shell.js';
import { pick, UI } from '../copy.js';
import { createConfirmControl } from '../confirm-control.js';
import { clock } from '../clock.js';
import { loadState, saveState, getProfile, getActiveProfile } from '../store.js';
import * as audio from '../audio.js';
import * as speech from '../speech.js';
import * as haptics from '../haptics.js';
import * as scene from '../scene.js';
import { nav } from '../ui/nav.js';
import { nightNav, registerNight } from './registry.js';

export function renderNight() {
  const night = nightNav.getNight();
  if (!night) return;
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const shift = night.clockShift - 1;

  // B3 : le geste de sortie du chevet (appui tenu 1 s) passe par la même
  // machine d'état que le reste de l'app (confirm-control.js), ce qui lui
  // offre gratuitement les chemins clavier et assistif. Le confirm() natif
  // reste hors périmètre de ce correctif (remonté en J1, DEC-03).
  const quitControl = createConfirmControl({
    holdMs: 1000,
    onConfirm: () => { if (confirm(UI.bedside_quit_confirm)) nightNav.stopNight(true); },
    now: clock.now, setTimeoutFn: clock.setTimeout, clearTimeoutFn: clock.clearTimeout,
  });

  const screen = el('main', {
    class: 'screen screen--night',
    role: 'button',
    tabindex: '0',
    'aria-label': UI.bedside_quit_confirm,
    onpointerdown: (e) => {
      // Appui tenu 1 s : quitter (avec confirmation). Tap : rien.
      night.swipeStart = e.clientY;
      night.veilStart = night.veil;
      quitControl.pointerDown();
    },
    onpointermove: (e) => {
      if (night.swipeStart == null) return;
      const delta = e.clientY - night.swipeStart;
      if (Math.abs(delta) > 12) quitControl.reset();
      // Swipe vertical : luminosité via le voile.
      night.veil = Math.min(0.92, Math.max(0, night.veilStart + delta / 400));
      const veilEl = document.querySelector('.night-veil');
      if (veilEl) veilEl.style.background = `rgba(0,0,0,${night.veil.toFixed(2)})`;
    },
    onpointerup: () => {
      night.swipeStart = null;
      quitControl.pointerUp();
    },
    onkeydown: (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      quitControl.keyDown(e);
    },
    onkeyup: (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      quitControl.keyUp();
    },
    onclick: () => quitControl.click(),
  }, [
    el('div', { style: 'flex:1' }),
    el('div', {
      class: 'night-clock',
      style: `transform: translate(${shift}px, ${shift}px)`,
    }, `${hh}:${mm}`),
    el('div', { class: 'spacer-sm' }),
    el('div', { class: 'night-wake-time t-meta' }, `${UI.bedside_wake_label} ${night.bedside.wakeTime}`),
    el('div', { style: 'flex:1' }),
    el('div', { class: 'night-hint t-meta' }, UI.bedside_night_hint),
    el('div', { class: 'night-veil', style: `background: rgba(0,0,0,${night.veil.toFixed(2)})` }),
  ]);
  render(screen, null);
  setScreen('night');
}

// L'écran de réveil : appui tenu 600 ms pour se lever (R2 étendu au réveil :
// le réveil n'avance JAMAIS seul vers le live).
export function renderWakeProposal() {
  const night = nightNav.getNight();
  if (!night) return;
  const state = loadState();

  function wakeConfirmed() {
    haptics.buzz('confirm');
    audio.stopWake();
    // Au premier geste, si le contexte était suspendu, le son est restauré.
    if (night.soundFallback) audio.unlock();
    renderGoodMorning(state);
  }

  // B3 : même principe qu'un holdButton ordinaire (R2 étendu au réveil),
  // avec en plus les chemins clavier et assistif hérités de la machine
  // d'état commune plutôt que d'un minuteur ad hoc borné au pointeur.
  const control = createConfirmControl({
    onConfirm: wakeConfirmed,
    now: clock.now, setTimeoutFn: clock.setTimeout, clearTimeoutFn: clock.clearTimeout,
  });

  const zone = el('main', {
    class: 'screen screen--night screen--waking' + (night.silentRepropose ? ' is-pulsing' : ''),
    role: 'button',
    tabindex: '0',
    'aria-label': UI.bedside_wake_hold,
    onpointerdown: () => control.pointerDown(),
    onpointerup: () => control.pointerUp(),
    onpointercancel: () => control.pointerCancel(),
    onkeydown: (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      control.keyDown(e);
    },
    onkeyup: (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      control.keyUp();
    },
    onclick: () => control.click(),
  }, [
    el('div', { style: 'flex:1' }),
    el('div', { class: 'night-clock night-clock--waking' },
      `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`),
    el('div', { style: 'flex:1' }),
    el('div', { class: 'night-hint t-meta' }, UI.bedside_wake_hold),
  ]);

  render(zone, null);
  setScreen('waking');
}

function renderGoodMorning(state) {
  const night = nightNav.getNight();
  scene.applyScene('dawn');
  scene.setLight(0.2, 0.6);
  const bsProfile = getProfile(state, night.bedside.profileId) || getActiveProfile(state);
  const greeting = `${pick('goodmorning')}${state.name ? ' ' + state.name + '.' : ''}`;
  speech.speak(greeting);

  const screen = el('main', { class: 'screen stagger' }, [
    wordmark(),
    el('div', { style: 'flex:1' }),
    el('h1', { class: 't-hero' }, greeting),
    el('div', { style: 'flex:1' }),
    el('button', {
      class: 'btn btn--primary',
      onclick: () => {
        const profileId = bsProfile?.id;
        nightNav.stopNight(false);
        const s = loadState();
        s.activeProfileId = profileId || s.activeProfileId;
        saveState(s);
        nav.preview(profileId);
      },
    }, UI.bedside_morning_cta),
    el('div', { class: 'spacer-sm' }),
    el('button', {
      class: 'btn btn--ghost',
      onclick: () => {
        // "Pas encore" : le son se tait, la lumière reste,
        // re-proposition silencieuse après 5 min (R5).
        audio.stopWake();
        night.snoozedAt = clock.now();
        night.ringing = false;
        night.silentRepropose = false;
        scene.applyScene('night');
        scene.setLight(0.35, 0.6);
        toast(UI.wordmark, pick('wake_again'));
        renderNight();
      },
    }, UI.bedside_not_yet),
  ]);
  render(screen, 'goodmorning');
}

registerNight({ renderNight, renderWakeProposal });

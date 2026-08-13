// J1 découpe étape 4 (Nour, R1 §1.4) · Rendu du Live et de la pause
// (spec v2 §7.3, §7.6). Aucune règle de calcul ici (S1 §4) : la décision
// vient de js/live.js (pur) via live/controller.js, ce fichier ne fait
// que rendre l'état qu'on lui rapporte.

import { el, wordmark, toast } from '../ui/dom.js';
import { render } from '../ui/shell.js';
import { holdButton, isHoldActive } from '../ui/gesture.js';
import { pick, UI } from '../copy.js';
import { rescueCandidates } from '../plan.js';
import { loadState } from '../store.js';
import * as haptics from '../haptics.js';
import * as audio from '../audio.js';
import * as speech from '../speech.js';
import { liveNav, registerLive } from './registry.js';

export function renderLive() {
  const live = liveNav.getLive();
  if (!live) return;
  if (isHoldActive()) return; // ne pas détruire un appui en cours
  const { step, suggested, nudge, slip } = liveNav.liveStatus();

  if (step.key === 'leave') return liveNav.renderLeave(slip);
  if (live.paused) return renderPause();

  const nIdx = liveNav.nextStepIdx();
  const next = nIdx >= 0 ? live.sequence[nIdx] : null;

  if (!live.stepMessage || live.lastMessageStep !== live.current) {
    live.stepMessage = pick(step.key.startsWith('free') ? 'free' : step.key) || pick('free');
    live.lastMessageStep = live.current;
  }
  const message = suggested ? pick('suggested') : live.stepMessage;
  if (suggested && !live.suggestedShown) {
    live.suggestedShown = live.current;
  }

  // Carte de rattrapage (F3) : non bloquante, au-dessus du geste.
  let rescueCard = null;
  if (live.rescueVisible) {
    const candidates = rescueCandidates(live.sequence, live.current);
    rescueCard = el('div', { class: 'rescue-card' }, [
      el('div', { class: 't-title' }, pick('rescue_title')),
      el('p', { class: 't-body t-body--sm', style: 'margin-top:4px' }, pick('rescue_body')),
      el('div', { class: 'spacer-sm' }),
      el('div', { class: 'rescue-card__list' }, candidates.map((s) =>
        el('button', {
          class: 'pill' + (live.rescueSelection.has(s.key) ? ' is-on' : ''),
          onclick: (e) => {
            if (live.rescueSelection.has(s.key)) live.rescueSelection.delete(s.key);
            else live.rescueSelection.add(s.key);
            e.currentTarget.classList.toggle('is-on');
          },
        }, s.label)
      )),
      el('div', { class: 'spacer-sm' }),
      el('div', { style: 'display:flex; gap:10px' }, [
        el('button', { class: 'btn btn--soft', style: 'flex:1', onclick: () => liveNav.applyRescue(false) }, UI.live_rescue_lighten),
        el('button', { class: 'btn btn--ghost', style: 'flex:1', onclick: () => liveNav.applyRescue(true) }, UI.live_rescue_keep),
      ]),
    ]);
  }

  const isNewStep = live.lastRenderedStep !== live.current;
  live.lastRenderedStep = live.current;

  const word = el('div', { class: 'live-word' + (isNewStep ? ' is-new' : '') + (suggested ? ' state-suggested' : '') }, [
    el('div', { class: 't-label' }, UI.live_current_label),
    el('div', { class: 'spacer-sm' }),
    el('h1', { class: 't-step' }, step.label),
    el('p', { class: 't-body', style: 'margin-top: 14px' }, message),
  ]);

  const hint = live.confirmMode === 'tap' ? UI.live_tap_hint : UI.live_hold_hint;

  const screen = el('main', { class: 'screen screen--live' }, [
    wordmark(),
    el('div', { style: 'flex:1' }),
    word,
    el('div', { style: 'flex:2' }),
    next ? el('div', { class: 't-meta', style: 'text-align:center' },
      `${UI.live_next_prefix} ${next.label}`) : null,
    el('div', { class: 'spacer-sm' }),
    rescueCard,
    rescueCard ? el('div', { class: 'spacer-sm' }) : null,
    holdButton({
      label: UI.live_confirm(next ? next.label.toLowerCase() : ''),
      onConfirm: () => liveNav.confirmNext(),
      mode: live.confirmMode,
      cls: suggested ? 'state-suggested' : '',
    }),
    el('div', { class: 'spacer-sm' }),
    el('div', { class: 't-meta', style: 'text-align:center' }, hint),
    el('div', { class: 'spacer-sm' }),
    el('div', { class: 'live-bottom-links' }, [
      el('button', { class: 'btn btn--ghost', onclick: () => liveNav.openDrawer() }, UI.live_drawer_open),
      el('button', { class: 'btn btn--ghost', onclick: () => liveNav.abortLive() }, UI.live_quit),
    ]),
  ]);
  render(screen, 'live');

  // Nudge : une pulsation lumineuse unique + haptique + vocal, une fois.
  if (nudge && !live.nudged) {
    live.nudged = true;
    const msg = pick('nudge');
    haptics.buzz('nudge');
    // Politesse : pas de son avant 7h si la nappe est coupée.
    const state = loadState();
    if (new Date().getHours() >= 7 || state.settings.ambient) audio.cue('nudge');
    speech.speak(msg);
    word.classList.add('state-nudge-pulse');
    toast(step.label, msg);
    liveNav.maybeOfferRescue(slip);
  }
}

function renderPause() {
  const screen = el('main', { class: 'screen screen--live screen--pause' }, [
    wordmark(),
    el('div', { style: 'flex:1' }),
    el('div', { class: 'live-word' }, [
      el('h1', { class: 't-step' }, UI.live_pause_title),
      el('p', { class: 't-body', style: 'margin-top: 14px' }, pick('pause')),
    ]),
    el('div', { style: 'flex:2' }),
    el('button', { class: 'btn btn--primary', onclick: () => liveNav.resumeLive() }, UI.live_pause_cta),
    el('div', { class: 'spacer-sm' }),
  ]);
  render(screen, 'live-pause');
}

registerLive({ renderLive });

// J1 découpe étape 4 (Nour, R1 §1.4) · Rendu du Live et de la pause
// (spec v2 §7.3, §7.6). Aucune règle de calcul ici (S1 §4) : la décision
// vient de js/live.js (pur) via live/controller.js, ce fichier ne fait
// que rendre l'état qu'on lui rapporte.
//
// J1 étape 9 (S2 §5, Iris) · L'écran live se MET À JOUR, il ne se
// reconstruit pas. Auparavant, le ticker rappelait renderLive toutes les
// 5 secondes et chaque appel refaisait tout l'arbre, jusqu'au
// root.replaceChildren() : le focus clavier était perdu et le curseur
// VoiceOver renvoyé en haut de page toutes les 5 secondes. Même les
// chemins clavier et assistif corrigés en J0 restaient inutilisables,
// puisque atteindre le bouton était une course contre le ticker.
//
// Le montage construit l'arbre une fois et garde les quelques nœuds qui
// changent ; la mise à jour n'écrit que leur contenu. Le bouton de
// confirmation, en particulier, n'est jamais remplacé pendant une session.

import { el, wordmark, toast } from '../ui/dom.js';
import { render, isScreen } from '../ui/shell.js';
import { holdButton, isHoldActive, setHoldLabel } from '../ui/gesture.js';
import { pick, UI } from '../copy.js';
import { rescueCandidates } from '../plan.js';
import { loadState } from '../store.js';
import * as haptics from '../haptics.js';
import * as audio from '../audio.js';
import * as speech from '../speech.js';
import { liveNav, registerLive } from './registry.js';

// L'écran live actuellement monté, et les nœuds que la mise à jour touche.
// null dès qu'on n'est plus sur le live (pause, départ, fin de session).
let mounted = null;

// Le montage est réutilisable tant qu'il appartient à la MÊME session,
// qu'il est toujours dans la page, et que le mode de confirmation n'a pas
// changé (un bouton de maintien et un bouton de tap sont deux composants
// différents, pas deux états d'un même bouton).
function canReuse(live) {
  return mounted !== null
    && mounted.live === live
    && mounted.confirmMode === live.confirmMode
    && isScreen('live')
    && mounted.screen.parentNode === document.getElementById('app');
}

export function renderLive() {
  const live = liveNav.getLive();
  if (!live) { mounted = null; return; }
  if (isHoldActive()) return; // ne pas perturber un appui en cours
  const { step, suggested, nudge, slip } = liveNav.liveStatus();

  if (step.key === 'leave') { mounted = null; return liveNav.renderLeave(slip); }
  if (live.paused) { mounted = null; return renderPause(); }

  const nIdx = liveNav.nextStepIdx();
  const next = nIdx >= 0 ? live.sequence[nIdx] : null;

  // Le message de l'étape est tiré UNE FOIS par étape, pas à chaque rendu.
  if (!live.stepMessage || live.lastMessageStep !== live.current) {
    live.stepMessage = pick(step.key.startsWith('free') ? 'free' : step.key) || pick('free');
    live.lastMessageStep = live.current;
  }
  // Idem pour le message de suggestion (défaut relevé par Camille) : il
  // était retiré au sort à chaque rendu, et comme son pool compte deux
  // entrées, les deux phrases alternaient strictement toutes les 5
  // secondes sous les yeux de l'utilisateur.
  if (suggested && live.suggestedMessageStep !== live.current) {
    live.suggestedMessage = pick('suggested');
    live.suggestedMessageStep = live.current;
  }
  const message = suggested ? live.suggestedMessage : live.stepMessage;
  if (suggested && !live.suggestedShown) {
    live.suggestedShown = live.current;
  }

  const isNewStep = live.lastRenderedStep !== live.current;
  live.lastRenderedStep = live.current;

  if (!canReuse(live)) mount(live);
  update({ live, step, next, message, suggested, isNewStep });

  // Nudge : une pulsation lumineuse unique + haptique + vocal, une fois.
  if (nudge && !live.nudged) {
    live.nudged = true;
    const msg = pick('nudge');
    haptics.buzz('nudge');
    // Politesse : pas de son avant 7h si la nappe est coupée.
    const state = loadState();
    if (new Date().getHours() >= 7 || state.settings.ambient) audio.cue('nudge');
    speech.speak(msg);
    mounted.word.classList.add('state-nudge-pulse');
    toast(step.label, msg);
    liveNav.maybeOfferRescue(slip);
  }
}

// Construit l'arbre une fois par session et mémorise les nœuds mutables.
// Les emplacements qui peuvent être vides (l'étape suivante, la carte de
// rattrapage) existent toujours : la forme de l'écran ne change pas, seul
// son contenu change. C'est ce qui garantit que le bouton de confirmation
// garde son identité pendant toute la session.
function mount(live) {
  const stepLabel = el('h1', { class: 't-step' });
  const messageNode = el('p', { class: 't-body', style: 'margin-top: 14px' });
  const word = el('div', { class: 'live-word' }, [
    el('div', { class: 't-label' }, UI.live_current_label),
    el('div', { class: 'spacer-sm' }),
    stepLabel,
    messageNode,
  ]);

  const nextLine = el('div', { class: 't-meta', style: 'text-align:center' });
  const rescueSlot = el('div', { class: 'rescue-slot' });
  const confirmBtn = holdButton({
    label: '',
    onConfirm: () => liveNav.confirmNext(),
    mode: live.confirmMode,
  });
  const hint = live.confirmMode === 'tap' ? UI.live_tap_hint : UI.live_hold_hint;

  const screen = el('main', { class: 'screen screen--live' }, [
    wordmark(),
    el('div', { style: 'flex:1' }),
    word,
    el('div', { style: 'flex:2' }),
    nextLine,
    el('div', { class: 'spacer-sm' }),
    rescueSlot,
    confirmBtn,
    el('div', { class: 'spacer-sm' }),
    el('div', { class: 't-meta', style: 'text-align:center' }, hint),
    el('div', { class: 'spacer-sm' }),
    el('div', { class: 'live-bottom-links' }, [
      el('button', { class: 'btn btn--ghost', onclick: () => liveNav.openDrawer() }, UI.live_drawer_open),
      el('button', { class: 'btn btn--ghost', onclick: () => liveNav.abortLive() }, UI.live_quit),
    ]),
  ]);

  mounted = {
    live, screen, word, stepLabel, messageNode, nextLine, rescueSlot, confirmBtn,
    confirmMode: live.confirmMode,
    rescueShown: false,
  };
  render(screen, 'live');
}

// N'écrit que ce qui change. Aucun nœud n'est remplacé ici, sauf le
// contenu de l'emplacement de rattrapage, et seulement quand il apparait
// ou disparait vraiment.
function update({ live, step, next, message, suggested, isNewStep }) {
  const m = mounted;

  m.stepLabel.textContent = step.label;
  m.messageNode.textContent = message;
  m.nextLine.textContent = next ? `${UI.live_next_prefix} ${next.label}` : '';

  m.word.classList.toggle('state-suggested', suggested);
  m.confirmBtn.classList.toggle('state-suggested', suggested);
  setHoldLabel(m.confirmBtn, UI.live_confirm(next ? next.label.toLowerCase() : ''));

  if (isNewStep) {
    // Retirer puis reposer la classe : sans ça, l'animation d'entrée ne
    // rejoue pas, puisque la classe est déjà là depuis l'étape d'avant.
    // La pulsation de relance appartient à l'étape précédente et doit
    // partir avec elle, sinon elle masque l'animation d'entrée (sa règle
    // vient plus loin dans la feuille de style).
    m.word.classList.remove('is-new', 'state-nudge-pulse');
    void m.word.offsetWidth; // force le recalcul avant de rejouer
    m.word.classList.add('is-new');
  }

  // Carte de rattrapage (F3) : non bloquante, au-dessus du geste. Montée
  // une seule fois à son apparition, pour que la sélection de l'utilisateur
  // ne soit pas balayée par le battement suivant du ticker.
  if (live.rescueVisible && !m.rescueShown) {
    m.rescueSlot.replaceChildren(buildRescueCard(live), el('div', { class: 'spacer-sm' }));
    m.rescueShown = true;
  } else if (!live.rescueVisible && m.rescueShown) {
    m.rescueSlot.replaceChildren();
    m.rescueShown = false;
  }
}

function buildRescueCard(live) {
  const candidates = rescueCandidates(live.sequence, live.current);
  return el('div', { class: 'rescue-card' }, [
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

// J1 découpe étape 6 · Bilan (R5) et carte du matin (spec v2 §11). Écran
// plat : aucune règle de calcul (S1 §4). showCardOffer reste privée à ce
// fichier : c'est un sous-écran du bilan, jamais atteint autrement.

import { el, wordmark, toast } from '../ui/dom.js';
import { render } from '../ui/shell.js';
import { pick, UI } from '../copy.js';
import { loadState, saveState } from '../store.js';
import { recordOutcome } from '../predict.js';
import { drawCard, shareCard } from '../card.js';
import * as scene from '../scene.js';
import { nav } from '../ui/nav.js';

export function showFeedback(session) {
  let selected = null;

  function submit() {
    if (!selected) return;
    const state = loadState();
    // B1 : les durées sont déjà écrites au fil de l'eau (confirmNext). Le
    // bilan déclaratif ne conditionne plus que le ressenti de ponctualité.
    recordOutcome(state, selected, { ...session.ctx, profileId: session.profileId });
    saveState(state);
    toast(UI.feedback_label, pick(`feedback_${selected}`));
    scene.resetLight();
    setTimeout(() => showCardOffer({ ...session, status: selected }), 600);
  }

  const options = [
    { key: 'early', label: UI.feedback_early_label },
    { key: 'ontime', label: UI.feedback_ontime_label },
    { key: 'late', label: UI.feedback_late_label },
  ];

  function renderF() {
    const screen = el('main', { class: 'screen stagger' }, [
      wordmark(),
      el('div', { class: 'spacer-md' }),
      el('div', { class: 't-label' }, UI.feedback_label),
      el('div', { class: 'spacer-sm' }),
      el('h1', { class: 't-display' }, UI.feedback_title),
      el('p', { class: 't-body', style: 'margin-top: 12px' }, UI.feedback_body),
      el('div', { class: 'spacer-md' }),
      el('div', { style: 'display:flex; flex-direction:column; gap:10px' },
        options.map((o) =>
          el('button', {
            class: 'feedback-option' + (selected === o.key ? ' is-selected' : ''),
            onclick: () => { selected = o.key; renderF(); },
          }, [
            el('div', {}, [
              el('div', { class: 'feedback-option__label' }, o.label),
              selected === o.key
                ? el('div', { class: 'feedback-option__sub t-body' }, pick(`feedback_${o.key}`))
                : null,
            ]),
          ])
        )
      ),
      el('div', { style: 'flex: 1' }),
      el('button', {
        class: 'btn btn--primary',
        disabled: selected ? null : true,
        onclick: submit,
      }, selected ? UI.feedback_cta_ready : UI.feedback_cta_idle),
    ]);
    render(screen, 'feedback');
  }

  renderF();
}

function showCardOffer(session) {
  const state = loadState();
  const canvas = drawCard({
    name: state.name,
    status: session.status,
    steps: session.confirmedSteps,
    light: 1,
  });
  canvas.className = 'card-preview';

  const screen = el('main', { class: 'screen stagger' }, [
    wordmark(),
    el('div', { class: 'spacer-md' }),
    el('h1', { class: 't-display' }, UI.card_title),
    el('p', { class: 't-body', style: 'margin-top: 10px' }, UI.card_body),
    el('div', { class: 'spacer-md' }),
    el('div', { class: 'card-preview-wrap' }, canvas),
    el('div', { style: 'flex:1' }),
    el('button', {
      class: 'btn btn--primary',
      onclick: async () => {
        const result = await shareCard(canvas);
        if (result === 'downloaded') toast(UI.card_title, UI.card_downloaded);
      },
    }, UI.card_share),
    el('div', { class: 'spacer-sm' }),
    el('button', { class: 'btn btn--ghost', onclick: () => nav.mornings() }, UI.card_skip),
  ]);
  render(screen, 'card-offer');
}

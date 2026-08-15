// J1 découpe étape 6 · Aperçu. Écran plat : le calcul du plan vient de
// buildPlan (plan.js), ce fichier ne fait que le rendre (S1 §4).

import { el, wordmark, topbar } from '../ui/dom.js';
import { render } from '../ui/shell.js';
import { askText } from '../ui/sheet.js';
import { UI } from '../copy.js';
import { fromMin } from '../time.js';
import { loadState, saveState, getActiveProfile, getProfile, commitPreviewDefaults } from '../store.js';
import { buildPlan, TRANSPORT_BUFFER } from '../plan.js';
import { addDestination, getDestination } from '../travel.js';
import { isBudgetShorterThanPlan } from '../calibrate.js';
import { icon, TRANSPORT_ICONS } from '../icons.js';
import * as audio from '../audio.js';
import * as speech from '../speech.js';
import * as haptics from '../haptics.js';
import { ctxNow } from '../now.js';
import { startLive } from '../live/controller.js';
import { nav } from '../ui/nav.js';

export function showPreview(profileId, prefill = {}) {
  const state = loadState();
  const ctx = ctxNow();
  const profile = getProfile(state, profileId) || getActiveProfile(state);
  if (!profile) return nav.home();
  const steps = profile.steps;

  const data = {
    arrival: prefill.arrival || profile.defaults.arrival || '09:00',
    transport: prefill.transport || profile.defaults.transport || 'walk',
    travel: prefill.travel ?? 20,
    destinationId: profile.defaults.destinationId || null,
  };

  function render2() {
    const destination = getDestination(state, data.destinationId);
    const plan = buildPlan(steps, data.arrival, data.travel, data.transport, state.latenessScore, ctx, destination);
    // R4 : la marge n'est jamais affichée ni nommée.

    const transportPills = Object.keys(TRANSPORT_BUFFER).map((k) =>
      el('button', {
        class: 'pill' + (data.transport === k ? ' is-on' : ''),
        onclick: () => { data.transport = k; haptics.buzz('tap'); render2(); },
      }, [icon(TRANSPORT_ICONS[k]), el('span', {}, UI['transport_' + k])])
    );

    const destPills = [
      el('button', {
        class: 'pill' + (!data.destinationId ? ' is-on' : ''),
        onclick: () => { data.destinationId = null; render2(); },
      }, UI.preview_destination_none),
      ...state.destinations.map((d) =>
        el('button', {
          class: 'pill' + (data.destinationId === d.id ? ' is-on' : ''),
          onclick: () => { data.destinationId = d.id; render2(); },
        }, d.label)
      ),
      el('button', {
        class: 'pill',
        onclick: async () => {
          const label = await askText({
            title: UI.preview_destination_prompt,
            placeholder: UI.preview_destination_placeholder,
            confirmLabel: UI.preview_destination_save,
          });
          if (!label) return;
          const dest = addDestination(state, label);
          data.destinationId = dest.id;
          saveState(state);
          render2();
        },
      }, UI.preview_destination_add),
    ];

    // Trajet appris : plus besoin de l'estimation déclarative.
    const travelKnown = plan.travelConfidence > 0;

    // J2 (S3 §2) · Le budget déclaré est plus court que le déroulé : le
    // plan n'a pas été comprimé, et la personne a le droit de le savoir.
    // L'Aperçu est une des trois surfaces où l'incertitude a le droit
    // d'exister (ADR-003), et cette phrase porte sur le PLAN, jamais sur
    // la prudence de l'app (R4).
    const budgetFloored = profile.defaults.wakeTime
      ? isBudgetShorterThanPlan({
          steps, wakeTime: profile.defaults.wakeTime, arrival: data.arrival,
          travel: data.travel, transportKey: data.transport,
        })
      : false;

    const timeline = plan.sequence.map((s) => {
      const isLeave = s.key === 'leave';
      const learned = s.confidence > 0 && s.real && s.real.length >= 2
        ? el('div', { class: 'timeline-item__learned' }, UI.preview_learned)
        : null;
      return el('div', { class: 'timeline-item' + (isLeave ? ' timeline-item--leave' : '') }, [
        el('div', { class: 'timeline-item__time' }, fromMin(s.at)),
        el('div', { class: 'timeline-item__emoji' }, s.emoji ? s.emoji : icon(s.icon)),
        el('div', { class: 'timeline-item__label' }, [el('div', {}, s.label), learned]),
      ]);
    });

    const screen = el('main', { class: 'screen stagger' }, [
      topbar(() => nav.home()),
      el('div', { class: 'spacer-md' }),
      el('h1', { class: 't-display' }, UI.preview_subtitle(fromMin(plan.startMin))),
      el('p', { class: 't-body', style: 'margin-top: 12px' }, UI.preview_body),
      el('div', { class: 'spacer-md' }),

      el('div', { class: 'card' }, [
        el('div', { class: 't-label' }, UI.preview_arrival_label),
        el('div', { class: 'spacer-sm' }),
        el('input', {
          class: 'time-input', type: 'time', value: data.arrival,
          onchange: (e) => { data.arrival = e.target.value || '09:00'; render2(); },
        }),
        el('div', { class: 'spacer-md' }),
        el('div', { class: 't-label' }, UI.preview_transport_label),
        el('div', { class: 'spacer-sm' }),
        el('div', { style: 'display:flex; gap:8px; flex-wrap:wrap' }, transportPills),
        el('div', { class: 'spacer-md' }),
        el('div', { class: 't-label' }, UI.preview_destination_label),
        el('div', { class: 'spacer-sm' }),
        el('div', { style: 'display:flex; gap:8px; flex-wrap:wrap' }, destPills),
        el('div', { class: 'spacer-md' }),
        el('div', { class: 't-label' }, UI.preview_travel_label),
        el('div', { class: 'spacer-sm' }),
        travelKnown
          ? el('div', { class: 't-body' }, UI.preview_travel_known)
          : el('input', {
              class: 'text-input', type: 'number', min: '0', max: '180',
              value: String(data.travel),
              onchange: (e) => { data.travel = Number(e.target.value) || 0; render2(); },
            }),
      ]),

      el('div', { class: 'spacer-md' }),
      budgetFloored ? el('p', { class: 't-body t-body--sm' }, UI.preview_budget_floor) : null,
      budgetFloored ? el('div', { class: 'spacer-sm' }) : null,
      el('div', { class: 't-label' }, UI.preview_sequence_label),
      el('div', { class: 'spacer-sm' }),
      el('div', { style: 'display:flex; flex-direction:column; gap:8px' }, timeline),

      el('div', { class: 'spacer-md' }),
      el('div', { class: 'callout callout--warning' }, [
        el('div', { class: 'callout__text' }, UI.preview_wakelock_notice),
      ]),

      el('div', { class: 'spacer-md' }),
      el('button', {
        class: 'btn btn--primary',
        onclick: () => {
          // Geste utilisateur : déverrouille audio et voix pour la session.
          audio.unlock();
          speech.unlock();
          // B7 : sans ça, confirmArrival() refuse d'écrire et F5 ne boucle jamais.
          commitPreviewDefaults(state, profile.id, { destinationId: data.destinationId, transport: data.transport });
          saveState(state);
          startLive(plan, { profile, data, state });
        },
      }, UI.preview_cta),
      el('div', { class: 'spacer-sm' }),
      el('button', { class: 'btn btn--ghost', onclick: () => nav.home() }, UI.preview_back),
    ]);
    render(screen, 'preview');
  }

  render2();
}

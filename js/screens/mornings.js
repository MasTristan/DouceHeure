// J1 découpe étape 6 · Tes matins (spec v2 §10). Écran plat : la
// constellation lit l'historique tel quel, et la section "ce que l'app a
// appris" délègue le calcul à js/learned.js (pur, S1 §4) et ne fait que
// composer les phrases affichées via copy.js.

import { el, topbar } from '../ui/dom.js';
import { render } from '../ui/shell.js';
import { UI } from '../copy.js';
import { loadState } from '../store.js';
import { learnedSteps, learnedTravels } from '../learned.js';
import { nav } from '../ui/nav.js';

export function showMornings() {
  const state = loadState();
  let filterProfileId = null;

  function renderM() {
    const all = state.history.slice(-90);
    const entries = (filterProfileId
      ? all.filter((h) => h.profileId === filterProfileId)
      : all).slice(-30);

    // La constellation : points de lumière, jamais de croix, jamais de streak.
    const dots = entries.map((h, i) => {
      const seed = (h.ts % 997) / 997;
      const x = 8 + ((i * 53 + seed * 41) % 84);
      const y = 12 + ((i * 31 + seed * 67) % 70);
      const color = h.status === 'early' ? 'var(--status-early)'
        : h.status === 'late' ? 'var(--status-late)' : 'var(--status-ok)';
      const r = h.status === 'late' ? 1.6 : 2.4; // un jour raté = plus discret
      const o = h.status === 'late' ? 0.45 : 0.9;
      return `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}" opacity="${o}"/>`;
    }).join('');

    const sky = el('div', {
      class: 'constellation',
      role: 'img',
      'aria-label': UI.mornings_count(state.history.length),
      html: `<svg viewBox="0 0 100 90" preserveAspectRatio="xMidYMid meet">${dots}</svg>`,
    });

    // Ce que l'app a appris : phrases en langage naturel, sans tableau,
    // sans exposer la marge (R4).
    const phrases = [
      ...learnedSteps(state).map((s) =>
        UI.mornings_learned_step(s.label, s.slowDay != null ? UI.jours[s.slowDay] : null)),
      ...learnedTravels(state).map((t) =>
        UI.mornings_learned_travel(UI['transport_' + t.transport] || t.transport, t.destinationLabel)),
    ];

    const profilePills = state.profiles.length > 1
      ? el('div', { style: 'display:flex; gap:8px; flex-wrap:wrap' }, [
          el('button', {
            class: 'pill' + (!filterProfileId ? ' is-on' : ''),
            onclick: () => { filterProfileId = null; renderM(); },
          }, UI.mornings_all_profiles),
          ...state.profiles.map((p) =>
            el('button', {
              class: 'pill' + (filterProfileId === p.id ? ' is-on' : ''),
              onclick: () => { filterProfileId = p.id; renderM(); },
            }, p.name)
          ),
        ])
      : null;

    const screen = el('main', { class: 'screen stagger' }, [
      topbar(() => nav.home()),
      el('div', { class: 'spacer-md' }),
      el('div', { class: 't-label' }, UI.mornings_label),
      el('div', { class: 'spacer-sm' }),
      el('h1', { class: 't-display' }, entries.length ? UI.mornings_title : UI.mornings_empty),
      el('div', { class: 'spacer-md' }),
      profilePills,
      profilePills ? el('div', { class: 'spacer-sm' }) : null,
      entries.length ? sky : null,
      el('div', { class: 'spacer-sm' }),
      // Le seul chiffre autorisé : il ne peut que monter.
      state.history.length ? el('div', { class: 't-meta', style: 'text-align:center' },
        UI.mornings_count(state.history.length)) : null,
      el('div', { class: 'spacer-md' }),
      el('div', { class: 'card' }, [
        el('div', { class: 't-label' }, UI.mornings_learned_title),
        el('div', { class: 'spacer-sm' }),
        phrases.length === 0
          ? el('p', { class: 't-body' }, UI.mornings_learned_empty)
          : el('div', { style: 'display:flex; flex-direction:column; gap:10px' },
              phrases.slice(0, 6).map((p) => el('p', { class: 't-body' }, p))),
      ]),
      el('div', { class: 'spacer-md' }),
      el('div', { class: 'callout callout--amber' }, [
        el('div', { class: 'callout__text' }, UI.mornings_privacy),
      ]),
      el('div', { class: 'spacer-md' }),
      el('button', { class: 'btn btn--primary', onclick: () => nav.home() }, UI.mornings_back),
    ]);
    render(screen, 'mornings');
  }

  renderM();
}

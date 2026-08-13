// J1 découpe étape 4 (Nour, R1 §1.4) · Le tiroir de séquence (spec v2 §7.4).
// Sauter une étape ici n'écrit jamais de mesure (R3) : seule une
// confirmation accomplie sur l'écran live en écrit une.

import { el } from '../ui/dom.js';
import { icon } from '../icons.js';
import { UI } from '../copy.js';
import * as haptics from '../haptics.js';
import { liveNav, registerLive } from './registry.js';

let drawerNode = null;

export function closeDrawer() {
  if (drawerNode) { drawerNode.remove(); drawerNode = null; }
}

export function openDrawer() {
  closeDrawer();
  const live = liveNav.getLive();
  if (!live) return;

  function rebuild() {
    if (!drawerNode) return;
    const upcoming = [];
    for (let i = live.current + 1; i < live.sequence.length; i++) {
      const s = live.sequence[i];
      if (s.key !== 'leave' && !s.skipped) upcoming.push({ step: s, idx: i });
    }
    const past = live.sequence.slice(0, live.current + 1).filter((s) => !s.skipped);

    const items = [
      ...past.map((s) => el('div', { class: 'drawer-item is-past' }, [
        s.emoji ? el('span', { class: 'drawer-item__emoji' }, s.emoji) : icon(s.icon),
        el('span', { class: 'drawer-item__label' }, s.label),
      ])),
      ...upcoming.map(({ step, idx }, pos) => el('div', { class: 'drawer-item' }, [
        step.emoji ? el('span', { class: 'drawer-item__emoji' }, step.emoji) : icon(step.icon),
        el('span', { class: 'drawer-item__label' }, step.label),
        el('div', { class: 'drawer-item__actions' }, [
          pos > 0 ? el('button', {
            class: 'drawer-move', 'aria-label': `Monter ${step.label}`,
            onclick: () => {
              const otherIdx = upcoming[pos - 1].idx;
              [live.sequence[idx], live.sequence[otherIdx]] = [live.sequence[otherIdx], live.sequence[idx]];
              haptics.buzz('tap');
              rebuild();
            },
          }, '↑') : null,
          pos < upcoming.length - 1 ? el('button', {
            class: 'drawer-move', 'aria-label': `Descendre ${step.label}`,
            onclick: () => {
              const otherIdx = upcoming[pos + 1].idx;
              [live.sequence[idx], live.sequence[otherIdx]] = [live.sequence[otherIdx], live.sequence[idx]];
              haptics.buzz('tap');
              rebuild();
            },
          }, '↓') : null,
          el('button', {
            class: 'drawer-skip',
            onclick: () => {
              step.skipped = true; // aucune mesure écrite (R3), plan recalé
              haptics.buzz('tap');
              const { slip } = liveNav.liveStatus();
              liveNav.updateLiveLight(slip);
              rebuild();
            },
          }, UI.live_drawer_skip),
        ]),
      ])),
    ];

    drawerNode.querySelector('.drawer__list').replaceChildren(...items);
  }

  const sheet = el('div', { class: 'studio-modal__sheet drawer' }, [
    el('div', { class: 'studio-modal__handle' }),
    el('div', { class: 't-label' }, UI.live_drawer_title),
    el('div', { class: 'spacer-sm' }),
    el('div', { class: 'drawer__list' }),
    el('div', { class: 'spacer-md' }),
    el('button', { class: 'btn btn--soft', onclick: () => liveNav.pauseLive() }, UI.live_drawer_pause),
    el('div', { class: 'spacer-sm' }),
    el('button', { class: 'btn btn--ghost', onclick: closeDrawer }, UI.live_drawer_close),
  ]);

  drawerNode = el('div', {
    class: 'studio-modal',
    onclick: (e) => { if (e.target === drawerNode) closeDrawer(); },
  }, sheet);
  document.body.appendChild(drawerNode);
  rebuild();
}

registerLive({ openDrawer, closeDrawer });

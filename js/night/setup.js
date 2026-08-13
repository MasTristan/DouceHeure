// J1 découpe étape 5 (Nour, R1 §1.4) · F1, mode chevet : l'écran de
// réglage avant "Bonne nuit" (spec v2 §6). Importe controller.js
// directement (pas de cycle : controller.js ne dépend jamais de ce
// fichier en retour), donc pas besoin du registre night/registry.js ici.

import { el, topbar, settingRow } from '../ui/dom.js';
import { render } from '../ui/shell.js';
import { icon } from '../icons.js';
import { UI } from '../copy.js';
import { clock } from '../clock.js';
import { loadState, saveState } from '../store.js';
import { armBedside } from '../bedside.js';
import * as audio from '../audio.js';
import * as speech from '../speech.js';
import { nav } from '../ui/nav.js';
import { startNight } from './controller.js';

export function showBedsideSetup(prefillTime) {
  const state = loadState();
  const data = {
    wakeTime: prefillTime || state.bedside?.wakeTime || '07:00',
    profileId: state.bedside?.profileId || state.activeProfileId,
    sound: state.bedside?.sound !== false,
  };

  function renderB() {
    const screen = el('main', { class: 'screen stagger' }, [
      topbar(() => nav.home()),
      el('div', { class: 'spacer-md' }),
      el('div', { class: 't-label' }, UI.bedside_label),
      el('div', { class: 'spacer-sm' }),
      el('h1', { class: 't-display' }, UI.bedside_title),
      el('div', { class: 'spacer-md' }),
      el('div', { class: 'card' }, [
        el('div', { class: 't-label' }, UI.bedside_wake_label),
        el('div', { class: 'spacer-sm' }),
        el('input', {
          class: 'time-input', type: 'time', value: data.wakeTime,
          onchange: (e) => { data.wakeTime = e.target.value || '07:00'; },
        }),
        el('div', { class: 'spacer-md' }),
        el('div', { class: 't-label' }, UI.bedside_profile_label),
        el('div', { class: 'spacer-sm' }),
        el('div', { style: 'display:flex; gap:8px; flex-wrap:wrap' }, state.profiles.map((p) =>
          el('button', {
            class: 'pill' + (data.profileId === p.id ? ' is-on' : ''),
            onclick: () => { data.profileId = p.id; renderB(); },
          }, [icon(p.icon), el('span', {}, p.name)])
        )),
        el('div', { class: 'spacer-md' }),
        settingRow(UI.bedside_sound_label, data.sound, (v) => { data.sound = v; renderB(); }),
      ]),
      el('div', { class: 'spacer-md' }),
      el('div', { class: 'callout callout--warning' }, [
        el('div', { class: 'callout__text' }, UI.bedside_honest),
      ]),
      el('div', { class: 'spacer-sm' }),
      el('div', { class: 'callout' }, [
        el('div', { class: 'callout__text' }, UI.bedside_honest2),
      ]),
      el('div', { style: 'flex:1' }),
      el('button', {
        class: 'btn btn--primary',
        onclick: () => {
          // CE tap débloque AudioContext et speechSynthesis pour demain matin.
          audio.unlock();
          speech.unlock();
          const s = loadState();
          s.bedside = { wakeTime: data.wakeTime, profileId: data.profileId, lightLeadMin: 10, sound: data.sound };
          armBedside(s.bedside, clock.now());
          saveState(s);
          startNight(s.bedside);
        },
      }, UI.bedside_cta),
      el('div', { class: 'spacer-sm' }),
      el('button', { class: 'btn btn--ghost', onclick: () => nav.home() }, UI.bedside_cancel),
    ]);
    render(screen, 'bedside-setup');
  }

  renderB();
}

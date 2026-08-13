// J1 découpe étape 6 · Onboarding (spec v2 §15). Écran plat : aucune
// règle de calcul (S1 §4).

import { el, wordmark, toast, settingRow } from '../ui/dom.js';
import { render } from '../ui/shell.js';
import { UI } from '../copy.js';
import { loadState, saveState, getActiveProfile, ARCHETYPES, makeProfileFromArchetype } from '../store.js';
import { TRANSPORT_BUFFER } from '../plan.js';
import { icon, TRANSPORT_ICONS } from '../icons.js';
import * as scene from '../scene.js';
import { applySettings } from '../ui/shell.js';
import { nav } from '../ui/nav.js';

export function showOnboarding() {
  const draft = {
    name: '',
    archetypeIdx: 1,
    arrival: '09:00',
    transport: 'walk',
    confirmMode: 'hold',
    voice: false,
  };

  function finish(skipped) {
    const s = loadState();
    s.onboarded = true;
    if (!skipped) {
      s.name = draft.name.trim().slice(0, 24);
      s.settings.confirmMode = draft.confirmMode;
      s.settings.voice.enabled = draft.voice;
      const profile = getActiveProfile(s);
      if (profile) {
        profile.defaults.arrival = draft.arrival;
        profile.defaults.transport = draft.transport;
      }
    }
    saveState(s);
    applySettings(s);
    nav.home();
    if (!skipped) toast(UI.wordmark, UI.ob_tooltip);
  }

  function screen3() {
    const sc = el('main', { class: 'screen stagger' }, [
      wordmark(),
      el('div', { class: 'spacer-lg' }),
      el('h1', { class: 't-display' }, UI.ob3_title),
      el('p', { class: 't-body', style: 'margin-top:12px' }, UI.ob3_body),
      el('div', { class: 'spacer-md' }),
      el('div', { class: 't-label' }, UI.ob3_confirm_label),
      el('div', { class: 'spacer-sm' }),
      el('div', { style: 'display:flex; flex-direction:column; gap:10px' }, [
        ['hold', UI.ob3_hold, UI.ob3_hold_sub],
        ['tap', UI.ob3_tap, UI.ob3_tap_sub],
      ].map(([key, label, sub]) =>
        el('button', {
          class: 'feedback-option' + (draft.confirmMode === key ? ' is-selected' : ''),
          onclick: () => { draft.confirmMode = key; screen3(); },
        }, [
          el('div', {}, [
            el('div', { class: 'feedback-option__label' }, label),
            el('div', { class: 'feedback-option__sub t-body' }, sub),
          ]),
        ])
      )),
      el('div', { class: 'spacer-md' }),
      el('div', { class: 'card' }, [
        settingRow(UI.ob3_voice_label, draft.voice, (v) => { draft.voice = v; screen3(); }),
      ]),
      el('div', { style: 'flex:1' }),
      el('button', { class: 'btn btn--primary', onclick: () => finish(false) }, UI.ob3_cta),
    ]);
    render(sc, 'ob3-' + draft.confirmMode + draft.voice);
  }

  function screen2() {
    const archetypes = [0, 1, 2]; // express, classique, temps pour soi
    const sc = el('main', { class: 'screen stagger' }, [
      wordmark(),
      el('div', { class: 'spacer-lg' }),
      el('h1', { class: 't-display' }, UI.ob2_title),
      el('p', { class: 't-body', style: 'margin-top:12px' }, UI.ob2_body),
      el('div', { class: 'spacer-md' }),
      el('div', { id: 'ob2-list', style: 'display:flex; flex-direction:column; gap:10px' }),
      el('div', { class: 'spacer-md' }),
      el('div', { class: 'card' }, [
        el('div', { class: 't-label' }, UI.ob2_arrival_label),
        el('div', { class: 'spacer-sm' }),
        el('input', {
          class: 'time-input', type: 'time', value: draft.arrival,
          onchange: (e) => { draft.arrival = e.target.value || '09:00'; },
        }),
        el('div', { class: 'spacer-md' }),
        el('div', { class: 't-label' }, UI.ob2_transport_label),
        el('div', { class: 'spacer-sm' }),
        el('div', { id: 'ob2-transport', style: 'display:flex; gap:8px; flex-wrap:wrap' }),
      ]),
      el('div', { style: 'flex:1' }),
      el('button', { class: 'btn btn--primary', onclick: screen3 }, UI.ob2_cta),
      el('div', { class: 'spacer-sm' }),
      el('button', { class: 'btn btn--ghost', onclick: () => finish(true) }, UI.ob_skip),
    ]);
    render(sc, 'ob2');
    rebuildArchetypes();
    rebuildTransport();

    function rebuildArchetypes() {
      const list = sc.querySelector('#ob2-list');
      if (!list) return;
      list.replaceChildren(...archetypes.map((i) =>
        el('button', {
          class: 'archetype-card' + (draft.archetypeIdx === i ? ' is-selected' : ''),
          onclick: () => {
            draft.archetypeIdx = i;
            const s = loadState();
            // Le profil actif devient l'archétype choisi.
            const fresh = makeProfileFromArchetype(ARCHETYPES[i], s.activeProfileId);
            const idx = s.profiles.findIndex((p) => p.id === s.activeProfileId);
            if (idx >= 0) s.profiles[idx] = fresh;
            saveState(s);
            rebuildArchetypes();
          },
        }, [
          icon(ARCHETYPES[i].icon, 'icon--lg'),
          el('div', {}, [
            el('div', { class: 'feedback-option__label' }, ARCHETYPES[i].name),
            el('div', { class: 't-body t-body--sm' }, `${ARCHETYPES[i].stepKeys.length} étapes`),
          ]),
        ])
      ));
    }

    function rebuildTransport() {
      const zone = sc.querySelector('#ob2-transport');
      if (!zone) return;
      zone.replaceChildren(...Object.keys(TRANSPORT_BUFFER).map((k) =>
        el('button', {
          class: 'pill' + (draft.transport === k ? ' is-on' : ''),
          onclick: () => { draft.transport = k; rebuildTransport(); },
        }, [icon(TRANSPORT_ICONS[k]), el('span', {}, UI['transport_' + k])])
      ));
    }
  }

  function screen1() {
    scene.setLight(0.15, 0.5);
    // La scène s'éclaire pendant la lecture de la promesse.
    setTimeout(() => scene.setLight(0.6, 0.6), 900);
    const sc = el('main', { class: 'screen stagger' }, [
      wordmark(),
      el('div', { style: 'flex:1' }),
      el('h1', { class: 't-hero' }, UI.ob1_headline),
      el('p', { class: 't-body', style: 'margin-top:16px' }, UI.ob1_subline),
      el('div', { class: 'spacer-lg' }),
      el('div', { class: 't-label' }, UI.ob1_name_label),
      el('div', { class: 'spacer-sm' }),
      el('input', {
        class: 'text-input', type: 'text', maxlength: '24', value: draft.name,
        oninput: (e) => { draft.name = e.target.value; },
      }),
      el('div', { style: 'flex:1' }),
      el('button', { class: 'btn btn--primary', onclick: screen2 }, UI.ob1_cta),
      el('div', { class: 'spacer-sm' }),
      el('button', { class: 'btn btn--ghost', onclick: () => finish(true) }, UI.ob_skip),
    ]);
    render(sc, 'ob1');
  }

  screen1();
}

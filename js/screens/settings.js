// J1 découpe étape 6 · Réglages. Écran plat : aucune règle de calcul
// (S1 §4).

import { el, topbar, toast, settingRow } from '../ui/dom.js';
import { render, isScreen, applySettings } from '../ui/shell.js';
import { askConfirm } from '../ui/sheet.js';
import { UI } from '../copy.js';
import { loadState, saveState, getActiveProfile } from '../store.js';
import { downloadExport, validateImport } from '../backup.js';
import * as speech from '../speech.js';
import * as scene from '../scene.js';
import { nav } from '../ui/nav.js';
import { showBedsideSetup } from '../night/setup.js';

export function showSettings() {
  function renderS() {
    const state = loadState();
    const set = (fn) => {
      const s = loadState();
      fn(s);
      saveState(s);
      applySettings(s);
      scene.applyScene(scene.resolveScene(s.settings, new Date().getHours()));
      renderS();
    };

    const sceneOptions = [
      ['auto', UI.settings_scene_auto], ['dawn', UI.settings_scene_dawn],
      ['day', UI.settings_scene_day], ['evening', UI.settings_scene_evening],
    ];

    const voices = speech.frenchVoices();
    const shortcutsUrl = `${location.origin}${location.pathname}?profil=${encodeURIComponent(getActiveProfile(state)?.name || '')}&arrivee=09:00&go=1`;

    const importInput = el('input', {
      type: 'file', accept: 'application/json,.json', class: 'visually-hidden',
      onchange: async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const text = await file.text();
        const result = validateImport(text);
        if (!result.ok) return toast(UI.settings_label, UI.settings_import_bad);
        const ok = await askConfirm({
          title: UI.settings_import_confirm,
          body: UI.settings_import_body,
          confirmLabel: UI.settings_import_yes,
          danger: true,
        });
        if (!ok) return;
        saveState(result.state);
        applySettings(result.state);
        toast(UI.settings_label, UI.settings_import_ok);
        renderS();
      },
    });

    const screen = el('main', { class: 'screen stagger' }, [
      topbar(() => nav.home()),
      el('div', { class: 'spacer-md' }),
      el('div', { class: 't-label' }, UI.settings_label),
      el('div', { class: 'spacer-sm' }),
      el('h1', { class: 't-display' }, UI.settings_title),
      el('div', { class: 'spacer-md' }),

      el('div', { class: 'card' }, [
        el('div', { class: 't-label' }, UI.settings_name),
        el('div', { class: 'spacer-sm' }),
        el('input', {
          class: 'text-input', type: 'text', maxlength: '24', value: state.name,
          onchange: (e) => set((s) => { s.name = e.target.value.trim().slice(0, 24); }),
        }),
        el('div', { class: 'spacer-md' }),
        el('div', { class: 't-label' }, UI.settings_scene),
        el('div', { class: 'spacer-sm' }),
        el('div', { style: 'display:flex; gap:8px; flex-wrap:wrap' }, sceneOptions.map(([k, label]) =>
          el('button', {
            class: 'pill' + (state.settings.scene === k ? ' is-on' : ''),
            onclick: () => set((s) => { s.settings.scene = k; }),
          }, label)
        )),
        el('div', { class: 'spacer-md' }),
        el('div', { class: 't-label' }, UI.settings_confirm),
        el('div', { class: 'spacer-sm' }),
        el('div', { style: 'display:flex; gap:8px' }, [
          ['hold', UI.settings_confirm_hold], ['tap', UI.settings_confirm_tap],
        ].map(([k, label]) =>
          el('button', {
            class: 'pill' + (state.settings.confirmMode === k ? ' is-on' : ''),
            onclick: () => set((s) => { s.settings.confirmMode = k; }),
          }, label)
        )),
      ]),

      el('div', { class: 'spacer-md' }),
      el('div', { class: 'card' }, [
        settingRow(UI.settings_sound, state.settings.sound, (v) => set((s) => { s.settings.sound = v; })),
        settingRow(UI.settings_ambient, state.settings.ambient, (v) => set((s) => { s.settings.ambient = v; })),
        settingRow(UI.settings_haptics, state.settings.haptics, (v) => set((s) => { s.settings.haptics = v; })),
        settingRow(UI.settings_readable, state.settings.readable, (v) => set((s) => { s.settings.readable = v; })),
      ]),

      el('div', { class: 'spacer-md' }),
      el('div', { class: 'card' }, [
        settingRow(UI.settings_voice, state.settings.voice.enabled, (v) => set((s) => { s.settings.voice.enabled = v; })),
        state.settings.voice.enabled ? el('div', {}, [
          el('div', { class: 'spacer-sm' }),
          el('div', { class: 't-label' }, UI.settings_voice_rate),
          el('div', { class: 'spacer-sm' }),
          el('input', {
            type: 'range', class: 'dur-slider', min: '0.8', max: '1.1', step: '0.05',
            value: String(state.settings.voice.rate),
            'aria-label': UI.settings_voice_rate,
            onchange: (e) => set((s) => { s.settings.voice.rate = Number(e.target.value) || 1; }),
          }),
          el('div', { class: 'spacer-sm' }),
          el('div', { class: 't-label' }, UI.settings_voice_pick),
          el('div', { class: 'spacer-sm' }),
          voices.length === 0
            ? el('p', { class: 't-body t-body--sm' }, UI.settings_voice_none)
            : el('div', { style: 'display:flex; gap:8px; flex-wrap:wrap' }, voices.slice(0, 6).map((v) =>
                el('button', {
                  class: 'pill' + (state.settings.voice.voiceURI === v.voiceURI ? ' is-on' : ''),
                  onclick: () => set((s) => { s.settings.voice.voiceURI = v.voiceURI; }),
                }, v.name.slice(0, 24))
              )),
        ]) : null,
      ]),

      el('div', { class: 'spacer-md' }),
      el('button', { class: 'btn btn--soft', onclick: () => nav.social() }, UI.settings_contacts),
      el('div', { class: 'spacer-sm' }),
      el('button', { class: 'btn btn--soft', onclick: () => showBedsideSetup() }, UI.bedside_title),

      el('div', { class: 'spacer-md' }),
      el('div', { class: 'card' }, [
        el('div', { class: 't-label' }, UI.settings_backup_label),
        el('div', { class: 'spacer-sm' }),
        el('button', { class: 'btn btn--soft', onclick: () => downloadExport(loadState()) }, UI.settings_export),
        el('div', { class: 'spacer-sm' }),
        el('button', { class: 'btn btn--soft', onclick: () => importInput.click() }, UI.settings_import),
        importInput,
      ]),

      el('div', { class: 'spacer-md' }),
      el('div', { class: 'card' }, [
        el('div', { class: 't-label' }, UI.settings_shortcuts_title),
        el('div', { class: 'spacer-sm' }),
        el('p', { class: 't-body t-body--sm' }, UI.settings_shortcuts_body),
        el('div', { class: 'spacer-sm' }),
        el('code', { class: 'url-sample' }, shortcutsUrl),
        el('div', { class: 'spacer-sm' }),
        el('button', {
          class: 'btn btn--soft',
          onclick: () => {
            navigator.clipboard?.writeText(shortcutsUrl)
              .then(() => toast(UI.settings_shortcuts_title, UI.settings_shortcuts_copied))
              .catch(() => {});
          },
        }, UI.settings_shortcuts_copy),
      ]),

      !matchMedia('(display-mode: standalone)').matches
        ? el('div', { class: 'spacer-md' })
        : null,
      !matchMedia('(display-mode: standalone)').matches
        ? el('div', { class: 'card' }, [
            el('div', { class: 't-label' }, UI.settings_install_title),
            el('div', { class: 'spacer-sm' }),
            el('p', { class: 't-body t-body--sm' }, UI.settings_install_step1),
            el('p', { class: 't-body t-body--sm' }, UI.settings_install_step2),
            el('p', { class: 't-body t-body--sm' }, UI.settings_install_step3),
          ])
        : null,

      el('div', { class: 'spacer-md' }),
      el('div', { class: 'callout callout--amber' }, [
        el('div', { class: 'callout__text' }, UI.settings_privacy),
      ]),
      el('div', { class: 'spacer-md' }),
      el('button', { class: 'btn btn--primary', onclick: () => nav.home() }, UI.settings_back),
    ]);
    render(screen, 'settings');
  }

  // Les voix iOS arrivent parfois après coup.
  if ('speechSynthesis' in window) {
    speechSynthesis.onvoiceschanged = () => { if (isScreen('settings')) renderS(); };
  }
  renderS();
}

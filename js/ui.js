// Rendu des écrans et navigation. Pas de calcul métier ici.
// Toute règle de calcul vit dans plan.js, predict.js, travel.js, bedside.js.

import { loadState, saveState, getActiveProfile, getProfile, nextDepartureProfile, ARCHETYPES, makeProfileFromArchetype, commitPreviewDefaults } from './store.js';
import { showStudio } from './studio.js';
import { fromMin } from './time.js';
import { buildPlan, TRANSPORT_BUFFER } from './plan.js';
import { recordOutcome } from './predict.js';
import { confirmArrival, tripStatus, addDestination, getDestination } from './travel.js';
import { disarmBedside, missedWake } from './bedside.js';
import { downloadExport, validateImport } from './backup.js';
import { drawCard, shareCard } from './card.js';
import * as audio from './audio.js';
import * as speech from './speech.js';
import * as haptics from './haptics.js';
import * as scene from './scene.js';
import { icon, TRANSPORT_ICONS } from './icons.js';
import { pick, UI } from './copy.js';
import { CHANNELS, MESSAGE_TEMPLATES } from './social.js';
import { clock } from './clock.js';
import { ctxNow, nowMinutes } from './now.js';
// J1 découpe étape 1 (Nour, R1 §1.4) : helpers DOM et coquille sans état
// métier, extraits dans leurs propres modules. ui.js les réexporte pour
// que rien en dehors de ce fichier n'ait à changer d'import pendant que la
// découpe se poursuit (ui.js reste la façade jusqu'à l'étape 7).
import { el, wordmark, topbar, toast, announce, settingRow } from './ui/dom.js';
import { render, resetScreen, setScreen, isScreen, applySettings } from './ui/shell.js';
import { holdButton, isHoldActive } from './ui/gesture.js';
// J1 découpe étape 4 (Nour, R1 §1.4) : tout l'état et le rendu du Live
// vivent désormais dans live/*. ui.js reste le point de composition qui
// les importe (pour leur auto-enregistrement dans liveNav) et déclenche
// la session depuis le CTA de l'Aperçu.
import { startLive } from './live/controller.js';
import './live/view.js';
import './live/drawer.js';
import './live/leave.js';
// J1 découpe étape 5 (Nour, R1 §1.4) : même principe pour le mode chevet
// (F1). showBedsideSetup est réexportée : app.js (F8, pont Raccourcis) et
// showHome (bouton du chevet) en ont besoin.
import { showBedsideSetup } from './night/setup.js';
import './night/controller.js';
import './night/view.js';

export {
  el, wordmark, topbar, toast, announce, settingRow, render, resetScreen, setScreen, isScreen,
  applySettings, holdButton, isHoldActive, showBedsideSetup,
};

// ─── ONBOARDING (spec v2 §15) ───────────────────────────────────

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
    showHome();
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

// ─── ACCUEIL v2 (spec v2 §9) ────────────────────────────────────

export function showHome() {
  const state = loadState();
  applySettings(state);
  scene.applyScene(scene.resolveScene(state.settings, new Date().getHours()));
  scene.resetLight();
  speech.cancel();
  audio.stopAmbient();

  const nextProfile = nextDepartureProfile(state, nowMinutes());
  const others = (state.profiles || []).filter((p) => p.id !== nextProfile?.id);
  const isEvening = scene.currentScene() === 'evening';
  const trip = tripStatus(state.pendingTrip);

  const title = state.name ? UI.home_title_with_name(state.name) : UI.home_title_anon;
  const children = [wordmark(), el('div', { class: 'spacer-lg' })];

  // Bannière "Bien arrivé ?" (F5) : trajet en attente confirmable.
  if (trip.status === 'open') {
    children.push(
      el('div', { class: 'card card--accent' }, [
        el('div', { class: 't-title' }, UI.home_arrived_banner),
        el('div', { class: 'spacer-sm' }),
        el('div', { style: 'display:flex; gap:10px' }, [
          el('button', {
            class: 'btn btn--primary', style: 'flex:1',
            onclick: () => {
              const s = loadState();
              const ok = confirmArrival(s);
              saveState(s);
              haptics.buzz('tap');
              if (ok) toast(UI.home_arrived_banner, pick('trip_arrived'));
              showHomeFresh();
            },
          }, UI.home_arrived_yes),
          el('button', {
            class: 'btn btn--ghost', style: 'flex:1',
            onclick: () => {
              // "Pas encore" : on laisse le trajet ouvert, purge automatique après 4h.
              const card = document.querySelector('.card--accent');
              if (card) card.remove();
            },
          }, UI.home_arrived_no),
        ]),
      ]),
      el('div', { class: 'spacer-md' }),
    );
  }

  // Réveil manqué (F1) : l'app a été tuée pendant la nuit.
  if (state.bedside && missedWake(state.bedside, clock.now())) {
    const bsProfile = getProfile(state, state.bedside.profileId) || nextProfile;
    children.push(
      el('div', { class: 'card card--accent' }, [
        el('div', { class: 't-title' }, UI.home_missed_wake),
        el('div', { class: 'spacer-sm' }),
        el('button', {
          class: 'btn btn--primary',
          onclick: () => {
            const s = loadState();
            disarmBedside(s.bedside);
            saveState(s);
            audio.unlock();
            speech.unlock();
            showPreview(bsProfile?.id);
          },
        }, UI.home_missed_wake_cta),
      ]),
      el('div', { class: 'spacer-md' }),
    );
  }

  children.push(
    el('h1', { class: 't-display' }, title),
    el('div', { class: 'spacer-lg' }),
  );

  // Carte principale : prochain départ.
  if (nextProfile) {
    const stepCount = nextProfile.steps.filter((s) => s.active).length;
    children.push(
      el('div', { class: 'card next-departure' }, [
        el('div', { class: 't-label' }, UI.home_next_label),
        el('div', { class: 'spacer-sm' }),
        el('div', { class: 'next-departure__head' }, [
          icon(nextProfile.icon, 'icon--lg'),
          el('div', {}, [
            el('div', { class: 't-title' }, nextProfile.name),
            el('div', { class: 't-meta' },
              `${stepCount} étapes` + (nextProfile.defaults.arrival ? ` · arrivée ${nextProfile.defaults.arrival}` : '')),
          ]),
        ]),
        el('div', { class: 'spacer-md' }),
        el('button', {
          class: 'btn btn--primary',
          onclick: () => {
            const s = loadState();
            s.activeProfileId = nextProfile.id;
            saveState(s);
            showPreview(nextProfile.id);
          },
        }, UI.home_next_cta),
      ]),
      el('div', { class: 'spacer-md' }),
    );
  }

  // Pills des autres départs.
  if (others.length) {
    children.push(
      el('div', { style: 'display:flex; gap:8px; flex-wrap:wrap' },
        others.map((p) =>
          el('button', {
            class: 'pill',
            onclick: () => {
              const s = loadState();
              s.activeProfileId = p.id;
              saveState(s);
              showPreview(p.id);
            },
          }, [icon(p.icon), el('span', {}, p.name)])
        )
      ),
      el('div', { class: 'spacer-md' }),
    );
  }

  // Le soir : carte "Préparer demain" (F1).
  if (isEvening) {
    children.push(
      el('div', { class: 'card card--accent' }, [
        el('div', { class: 't-label' }, UI.home_evening_label),
        el('div', { class: 'spacer-sm' }),
        el('div', { class: 't-title' }, UI.home_evening_title),
        el('p', { class: 't-body t-body--sm', style: 'margin-top:6px' }, UI.home_evening_sub),
        el('div', { class: 'spacer-md' }),
        el('button', { class: 'btn btn--soft', onclick: () => showBedsideSetup() }, UI.bedside_cta),
      ]),
      el('div', { class: 'spacer-md' }),
    );
  }

  children.push(
    el('div', { style: 'flex:1' }),
    el('div', { class: 'home-links' }, [
      el('button', { class: 'btn btn--soft', onclick: showMornings }, UI.home_mornings_link),
      el('button', { class: 'btn btn--soft', onclick: showStudio }, UI.home_studio_link),
      el('button', { class: 'btn btn--soft', onclick: showSettings }, UI.home_settings_link),
    ]),
  );

  render(el('main', { class: 'screen stagger' }, children), 'home');
}

function showHomeFresh() {
  resetScreen();
  showHome();
}

// ─── APERÇU ─────────────────────────────────────────────────────

export function showPreview(profileId, prefill = {}) {
  const state = loadState();
  const ctx = ctxNow();
  const profile = getProfile(state, profileId) || getActiveProfile(state);
  if (!profile) return showHome();
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
        onclick: () => {
          const label = prompt(UI.preview_destination_prompt);
          if (!label || !label.trim()) return;
          const dest = addDestination(state, label);
          data.destinationId = dest.id;
          saveState(state);
          render2();
        },
      }, UI.preview_destination_add),
    ];

    // Trajet appris : plus besoin de l'estimation déclarative.
    const travelKnown = plan.travelConfidence > 0;

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
      topbar(showHome),
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
      el('button', { class: 'btn btn--ghost', onclick: showHome }, UI.preview_back),
    ]);
    render(screen, 'preview');
  }

  render2();
}

// ─── TRAJET (F5) ────────────────────────────────────────────────

// J1 découpe étape 4 : exportée pour que live/leave.js (departNow) et
// live/controller.js (endLive) puissent y naviguer via le registre
// ui/nav.js, sans importer ui.js directement (cycle interdit).
export function showTrip(session) {
  const message = pick('trip_road');
  speech.speak(message);

  const screen = el('main', { class: 'screen' }, [
    wordmark(),
    el('div', { style: 'flex:1' }),
    el('h1', { class: 't-hero', style: 'text-align:center' }, message),
    el('div', { class: 'spacer-md' }),
    el('p', { class: 't-body', style: 'text-align:center' }, UI.trip_close_hint),
    el('div', { style: 'flex:1' }),
    el('button', {
      class: 'btn btn--primary',
      onclick: () => {
        const s = loadState();
        const ok = confirmArrival(s);
        saveState(s);
        haptics.buzz('tap');
        if (ok) toast(UI.trip_label, pick('trip_arrived'));
        showFeedback(session);
      },
    }, UI.trip_arrived_cta),
    el('div', { class: 'spacer-sm' }),
    el('button', { class: 'btn btn--ghost', onclick: () => showFeedback(session) }, UI.feedback_label),
  ]);
  render(screen, 'trip');
}

// ─── FEEDBACK (R5) ──────────────────────────────────────────────

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

// ─── CARTE DU MATIN (spec v2 §11) ───────────────────────────────

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
    el('button', { class: 'btn btn--ghost', onclick: showMornings }, UI.card_skip),
  ]);
  render(screen, 'card-offer');
}

// ─── TES MATINS (spec v2 §10) ───────────────────────────────────

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
    const phrases = [];
    for (const profile of state.profiles) {
      for (const step of profile.steps) {
        if ((step.real || []).length < 3) continue;
        const byDay = {};
        for (const r of step.real) (byDay[r.day] = byDay[r.day] || []).push(r.v);
        const overall = step.real.reduce((a, r) => a + r.v, 0) / step.real.length;
        let slowDay = null;
        for (const [day, vals] of Object.entries(byDay)) {
          if (vals.length >= 2 && vals.reduce((a, b) => a + b, 0) / vals.length > overall + 2) {
            slowDay = UI.jours[Number(day)];
          }
        }
        phrases.push(UI.mornings_learned_step(step.label, slowDay));
      }
    }
    for (const dest of state.destinations) {
      for (const [transport, entry] of Object.entries(dest.byTransport || {})) {
        if ((entry.real || []).length >= 3) {
          phrases.push(UI.mornings_learned_travel(UI['transport_' + transport] || transport, dest.label));
        }
      }
    }

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
      topbar(showHome),
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
      el('button', { class: 'btn btn--primary', onclick: showHome }, UI.mornings_back),
    ]);
    render(screen, 'mornings');
  }

  renderM();
}

// ─── RÉGLAGES ───────────────────────────────────────────────────

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
        if (!confirm(UI.settings_import_confirm)) return;
        saveState(result.state);
        applySettings(result.state);
        toast(UI.settings_label, UI.settings_import_ok);
        renderS();
      },
    });

    const screen = el('main', { class: 'screen stagger' }, [
      topbar(showHome),
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
      el('button', { class: 'btn btn--soft', onclick: showSocial }, UI.settings_contacts),
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
      el('button', { class: 'btn btn--primary', onclick: showHome }, UI.settings_back),
    ]);
    render(screen, 'settings');
  }

  // Les voix iOS arrivent parfois après coup.
  if ('speechSynthesis' in window) {
    speechSynthesis.onvoiceschanged = () => { if (isScreen('settings')) renderS(); };
  }
  renderS();
}

// ─── MES PROCHES (contacts réels, rattachés au départ) ──────────

export function showSocial() {
  let modalNode = null;

  function renderSocial() {
    const state = loadState();
    const contacts = state.contacts || [];

    function openModal(contact) {
      const draft = contact
        ? { ...contact }
        : { id: '', name: '', number: '', channel: 'sms', messageIdx: 0 };
      renderModal(draft);
    }

    function deleteContact(id) {
      const s = loadState();
      s.contacts = (s.contacts || []).filter((c) => c.id !== id);
      saveState(s);
      renderSocial();
    }

    const contactCards = contacts.map((c) => {
      const channel = CHANNELS.find((ch) => ch.key === c.channel) || CHANNELS[0];
      const msg = MESSAGE_TEMPLATES[c.messageIdx ?? 0]();
      const initials = c.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';
      const hue = c.name.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % 360;

      return el('div', { class: 'social-contact-card' }, [
        el('div', { class: 'social-card-header' }, [
          el('div', {
            class: 'social-avatar',
            style: `background: hsl(${hue}, 35%, 25%); color: hsl(${hue}, 60%, 75%);`,
          }, initials),
          el('div', { class: 'social-card-info' }, [
            el('div', { class: 'social-card-name' }, c.name),
            el('div', { class: 'social-card-meta' }, `${channel.label} · ${c.number}`),
          ]),
          el('button', { class: 'social-card-edit', onclick: () => openModal(c), 'aria-label': 'Modifier' }, '✎'),
          el('button', { class: 'social-card-delete', onclick: () => deleteContact(c.id), 'aria-label': 'Supprimer' }, '×'),
        ]),
        el('p', { class: 'social-card-preview' }, `« ${msg} »`),
      ]);
    });

    const screen = el('main', { class: 'screen stagger' }, [
      topbar(showSettings),
      el('div', { class: 'spacer-md' }),
      el('div', { class: 't-label' }, UI.social_label),
      el('div', { class: 'spacer-sm' }),
      el('h1', { class: 't-display' }, UI.social_title),
      el('div', { class: 'spacer-md' }),
      el('div', { class: 'callout callout--amber' }, [
        el('div', { class: 'callout__text' }, UI.social_privacy),
      ]),
      el('div', { class: 'spacer-md' }),
      contacts.length > 0 ? el('div', { class: 'social-contact-list' }, contactCards) : null,
      contacts.length > 0 ? el('div', { class: 'spacer-sm' }) : null,
      contacts.length < 5
        ? el('button', { class: 'social-add-btn', onclick: () => openModal(null) }, UI.social_add)
        : null,
      el('div', { style: 'flex: 1' }),
      el('div', { class: 'social-guardrail' }, [
        el('div', { class: 'social-guardrail__line' }),
        el('p', { class: 'social-guardrail__text' }, UI.social_guardrail),
      ]),
      el('div', { class: 'spacer-sm' }),
    ]);
    render(screen, 'social');
  }

  function renderModal(draft) {
    if (modalNode) modalNode.remove();
    const isNew = !draft.id;

    function closeModal() {
      if (!modalNode) return;
      const node = modalNode;
      modalNode = null;
      node.remove();
    }

    function save() {
      if (!draft.name.trim() || !draft.number.trim()) return;
      const s = loadState();
      s.contacts = s.contacts || [];
      if (isNew) {
        draft.id = Date.now().toString();
        s.contacts.push({ ...draft });
      } else {
        const idx = s.contacts.findIndex((c) => c.id === draft.id);
        if (idx >= 0) s.contacts[idx] = { ...draft };
      }
      saveState(s);
      closeModal();
      renderSocial();
    }

    const isTelegram = draft.channel === 'telegram';
    const nameInput = el('input', {
      class: 'text-input', type: 'text', placeholder: 'Prénom', value: draft.name,
      oninput: (e) => { draft.name = e.target.value; updateSaveBtn(); },
    });
    const numberInput = el('input', {
      class: 'text-input',
      type: isTelegram ? 'text' : 'tel',
      placeholder: isTelegram ? '@pseudo ou +33...' : '+33 6...',
      value: draft.number,
      oninput: (e) => { draft.number = e.target.value; updateSaveBtn(); },
    });
    const saveBtn = el('button', {
      class: 'btn btn--primary', style: 'flex:1',
      disabled: (!draft.name.trim() || !draft.number.trim()) ? true : null,
      onclick: save,
    }, isNew ? 'Ajouter' : 'Enregistrer');

    function updateSaveBtn() {
      saveBtn.disabled = !draft.name.trim() || !draft.number.trim();
    }

    const hasContactPicker = 'contacts' in navigator;
    async function pickContact() {
      try {
        const results = await navigator.contacts.select(['name', 'tel'], { multiple: false });
        if (!results?.length) return;
        const picked = results[0];
        if (picked.name?.[0]) {
          draft.name = picked.name[0].trim().split(/\s+/)[0];
          nameInput.value = draft.name;
        }
        if (picked.tel?.[0]) {
          draft.number = picked.tel[0].trim();
          numberInput.value = draft.number;
        }
        updateSaveBtn();
      } catch { /* annulé */ }
    }

    const sheet = el('div', { class: 'studio-modal__sheet' }, [
      el('div', { class: 'studio-modal__handle' }),
      el('div', { class: 't-label' }, isNew ? 'Nouveau proche' : 'Modifier'),
      el('div', { class: 'spacer-sm' }),
      hasContactPicker
        ? el('button', { class: 'social-picker-btn', onclick: pickContact }, 'Depuis mes contacts')
        : null,
      hasContactPicker ? el('div', { class: 'spacer-sm' }) : null,
      el('div', { class: 't-label', style: 'margin-bottom:6px' }, 'Prénom'),
      nameInput,
      el('div', { class: 'spacer-sm' }),
      el('div', { class: 't-label', style: 'margin-bottom:6px' }, 'Canal préféré'),
      el('div', { class: 'social-channel-grid' }, CHANNELS.map((ch) =>
        el('button', {
          class: 'pill' + (draft.channel === ch.key ? ' is-on' : ''),
          onclick: () => { draft.channel = ch.key; renderModal(draft); },
        }, ch.label)
      )),
      el('div', { class: 'spacer-sm' }),
      el('div', { class: 't-label', style: 'margin-bottom:6px' }, 'Numéro ou pseudo'),
      numberInput,
      el('div', { class: 'spacer-sm' }),
      el('div', { class: 't-label', style: 'margin-bottom:6px' }, 'Message envoyé'),
      el('div', { class: 'social-template-list' }, MESSAGE_TEMPLATES.map((tpl, i) =>
        el('button', {
          class: 'social-template-item' + (draft.messageIdx === i ? ' is-selected' : ''),
          onclick: () => { draft.messageIdx = i; renderModal(draft); },
        }, el('em', {}, `« ${tpl()} »`))
      )),
      el('div', { class: 'spacer-md' }),
      el('div', { style: 'display:flex;gap:10px' }, [
        el('button', { class: 'btn btn--ghost', style: 'flex:1', onclick: closeModal }, 'Annuler'),
        saveBtn,
      ]),
    ]);

    modalNode = el('div', {
      class: 'studio-modal',
      onclick: (e) => { if (e.target === modalNode) closeModal(); },
    }, sheet);

    document.body.appendChild(modalNode);
    setTimeout(() => nameInput.focus(), 60);
  }

  renderSocial();
}

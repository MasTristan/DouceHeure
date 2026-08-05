// Rendu des écrans et navigation. Pas de calcul métier ici.
// Toute règle de calcul vit dans plan.js, predict.js, travel.js, bedside.js.

import { loadState, saveState, getActiveProfile, getProfile, nextDepartureProfile, ARCHETYPES, makeProfileFromArchetype, commitPreviewDefaults, startPendingSession, clearPendingSession } from './store.js';
import { showStudio } from './studio.js';
import { fromMin } from './time.js';
import { buildPlan, projectLeave, shouldRescue, rescueCandidates, TRANSPORT_BUFFER } from './plan.js';
import { recordDurations, recordOutcome } from './predict.js';
import { startTrip, confirmArrival, tripStatus, addDestination, getDestination } from './travel.js';
import { bedsidePhase, armBedside, disarmBedside, missedWake, SNOOZE_SILENT_MIN, WAKE_RISE_SECONDS } from './bedside.js';
import { downloadExport, validateImport } from './backup.js';
import { drawCard, shareCard } from './card.js';
import * as audio from './audio.js';
import * as speech from './speech.js';
import * as haptics from './haptics.js';
import * as wake from './wakelock.js';
import * as scene from './scene.js';
import { icon, TRANSPORT_ICONS } from './icons.js';
import { pick, UI } from './copy.js';
import { CHANNELS, MESSAGE_TEMPLATES, sendSignal } from './social.js';
import { createConfirmControl } from './confirm-control.js';
import { clock } from './clock.js';
import {
  currentStep as pureCurrentStep, nextStepIdx as pureNextStepIdx,
  liveStatus as pureLiveStatus, computeConfirm,
} from './live.js';

const root = document.getElementById('app');

// État de session live (mémoire, pas persisté).
let live = null;
let liveTicker = null;

// État du mode chevet (mémoire).
let night = null;
let nightTicker = null;

// Suivi de l'écran courant pour ne jouer l'animation d'entrée qu'une fois.
let currentScreen = null;

// ─── Helpers DOM ────────────────────────────────────────────────

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null && v !== false) node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of [].concat(children)) {
    if (c == null || c === false) continue;
    node.appendChild(typeof c === 'string' || typeof c === 'number'
      ? document.createTextNode(String(c))
      : c);
  }
  return node;
}

function ctxNow() {
  const d = new Date(clock.now());
  const day = d.getDay();
  const type = day >= 1 && day <= 5 ? 'work' : 'other';
  return { day, type };
}

function nowMinutes() {
  const d = new Date(clock.now());
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
}

function wordmark() {
  return el('div', { class: 'wordmark' }, [
    el('span', { class: 'wordmark__dot' }),
    el('span', { class: 'wordmark__name' }, UI.wordmark),
  ]);
}

function topbar(onBack) {
  return el('div', { class: 'studio-topbar' }, [
    wordmark(),
    el('button', { class: 'studio-back-btn', onclick: onBack }, '← Retour'),
  ]);
}

function toast(title, body) {
  const t = el('div', { class: 'toast' }, [
    el('div', {}, [
      el('div', { class: 'toast__title' }, title),
      body ? el('div', { class: 'toast__body' }, body) : null,
    ]),
  ]);
  document.body.appendChild(t);
  setTimeout(() => {
    t.style.transition = 'opacity 220ms';
    t.style.opacity = '0';
    setTimeout(() => t.remove(), 240);
  }, 2600);
}

function render(node, screenKey) {
  if (screenKey && screenKey !== currentScreen) {
    node.classList.add('screen--enter');
    currentScreen = screenKey;
  }
  root.replaceChildren(node);
}

// Annonce pour lecteurs d'écran (aria-live, spec v2 §16).
function announce(text) {
  let region = document.getElementById('live-region');
  if (!region) {
    region = el('div', { id: 'live-region', class: 'visually-hidden', 'aria-live': 'polite' });
    document.body.appendChild(region);
  }
  region.textContent = text;
}

function applySettings(state) {
  document.body.classList.toggle('readable', !!state.settings.readable);
  audio.setEnabled(state.settings.sound !== false);
  haptics.setEnabled(state.settings.haptics !== false);
  speech.configure(state.settings.voice);
}

// ─── Le geste de confirmation : appui tenu (spec v2 §7.2, S2-le-geste.md) ──
// Un appui interrompu n'avance rien et n'écrit rien (R3). La décision de
// QUAND confirmer vit dans confirm-control.js (pur, testé sans DOM) : cette
// fonction ne fait que câbler de vrais événements dessus et gérer le rendu.
//
// Quatre chemins vers la même garantie (R2 : intentionnel, non ambigu) :
// maintien, clavier (B2 : keydown arme, keyup valide, repeat ignoré),
// assistif (B3 : deux activations click en moins de 8 s, pour VoiceOver et
// Switch Control, dont l'activation ne produit pas de maintien mesurable),
// et tap (option de motricité, DEC-08, pas une réponse d'accessibilité).

let holdActive = false;

function holdButton({ label, onConfirm, mode, cls = '' }) {
  if (mode === 'tap') {
    const control = createConfirmControl({
      mode: 'tap', onConfirm: () => { haptics.buzz('confirm'); onConfirm(); },
      now: clock.now, setTimeoutFn: clock.setTimeout, clearTimeoutFn: clock.clearTimeout,
    });
    return el('button', {
      class: `hold-btn hold-btn--tap ${cls}`,
      onclick: () => control.click(),
    }, [el('span', { class: 'hold-btn__label' }, label)]);
  }

  const btn = el('button', { class: `hold-btn ${cls}`, 'aria-label': label }, [
    el('span', { class: 'hold-btn__fill', 'aria-hidden': 'true' }),
    el('span', { class: 'hold-btn__label' }, label),
  ]);

  // Suit si un maintien ou un clavier est en attente de résolution, pour
  // savoir si un relâchement doit jouer l'animation d'annulation (jamais
  // après une confirmation déjà survenue : pas de "rebond" après succès).
  let holdPending = false;

  function fireConfirm() {
    holdPending = false;
    holdActive = false;
    btn.classList.remove('is-holding', 'is-armed');
    haptics.buzz('confirm');
    onConfirm();
  }

  const control = createConfirmControl({
    onConfirm: fireConfirm,
    onArm: () => {
      // B3 : chemin assistif armé, pas encore confirmé. Retour discret ;
      // le texte prononcé/annoncé définitif reste à écrire dans copy.js
      // (S2-le-geste.md §7, hors périmètre de ce correctif).
      haptics.buzz('tap');
      btn.classList.add('is-armed');
    },
    now: clock.now, setTimeoutFn: clock.setTimeout, clearTimeoutFn: clock.clearTimeout,
  });

  function cancelVisual() {
    if (!holdPending) return; // déjà confirmé ou jamais armé : rien à annuler
    holdPending = false;
    holdActive = false;
    btn.classList.remove('is-holding');
    btn.classList.add('is-spring');
    setTimeout(() => btn.classList.remove('is-spring'), 300);
  }

  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    btn.setPointerCapture(e.pointerId);
    holdActive = true;
    holdPending = true;
    // Remplissage radial depuis le point de contact.
    const rect = btn.getBoundingClientRect();
    btn.style.setProperty('--hold-x', `${((e.clientX - rect.left) / rect.width * 100).toFixed(1)}%`);
    btn.classList.add('is-holding');
    control.pointerDown();
  });
  btn.addEventListener('pointerup', () => { cancelVisual(); control.pointerUp(); });
  btn.addEventListener('pointercancel', () => { cancelVisual(); control.pointerCancel(); });

  // B2 : keydown arme (sauf répétition automatique), keyup valide.
  btn.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    if (!e.repeat) holdPending = true;
    control.keyDown(e);
  });
  btn.addEventListener('keyup', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    cancelVisual();
    control.keyUp();
  });

  // B3 : chemin assistif. Une activation atomique (click) qui n'a pas été
  // précédée d'un maintien mesurable (VoiceOver, Switch Control) passe par
  // le comptage à deux du contrôle plutôt que d'être ignorée ou d'avancer
  // seule, ce qui violerait R2 dans un sens ou dans l'autre.
  btn.addEventListener('click', () => control.click());

  return btn;
}

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
  currentScreen = null;
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

// ─── LIVE flagship (R1 + R2 + R3, spec v2 §7) ───────────────────

function startLive(plan, meta) {
  const ctx = ctxNow();
  const state = loadState();
  live = {
    sequence: plan.sequence.map((s) => ({ ...s })),
    leaveMin: plan.leaveMin,
    arrivalMin: plan.arrivalMin,
    margin: plan.margin,
    startMin: plan.startMin,
    current: 0,
    startedAt: clock.now(),
    measurements: [],
    nudged: false,
    polluted: false,
    paused: false,
    rescueOffered: false,
    rescueVisible: false,
    confirmMode: state.settings.confirmMode,
    profileId: meta.profile.id,
    destinationId: meta.data.destinationId,
    transport: meta.data.transport,
    sentContactIds: new Set(),
    ctx,
  };
  // B1 : marqueur léger, purgé silencieusement après 8 h. Les mesures elles-
  // mêmes sont écrites au fil de l'eau par confirmNext, pas ici.
  startPendingSession(state, meta.profile.id, ctx);
  saveState(state);
  wake.acquire();
  wake.bindVisibility();
  scene.setLight(0.08, 0.5);
  if (state.settings.ambient) {
    audio.startAmbient();
    audio.setAmbientOpenness(0.08);
  }
  speakStep();
  renderLive();
  liveTicker = clock.setInterval(renderLive, 5000);
}

// S1 étape 3 : la décision vit dans js/live.js (pure, testée sans DOM).
// Ces trois fonctions ne sont plus que des câblages vers l'état courant du
// module et l'horloge injectable, pour garder tous les appels existants
// inchangés ci-dessous.
function currentStep() {
  return pureCurrentStep(live);
}

function nextStepIdx() {
  return pureNextStepIdx(live);
}

function liveStatus() {
  return pureLiveStatus(live, clock.now(), nowMinutes());
}

// Position temporelle dans le plan -> lumière de scène (spec v2 §2).
function updateLiveLight(slip) {
  const total = Math.max(1, live.sequence.length - 1);
  const progress = live.current / total;
  const tempo = Math.min(Math.max(-slip / 6, -1), 1);
  const { l, warm } = scene.sessionLight(progress, tempo);
  scene.setLight(l, warm);
  audio.setAmbientOpenness(l);
}

function speakStep() {
  const step = currentStep();
  if (!live.stepMessage || live.lastMessageStep !== live.current) {
    live.stepMessage = pick(step.key === 'leave' ? 'leave' : (step.key.startsWith('free') ? 'free' : step.key)) || pick('free');
    live.lastMessageStep = live.current;
  }
  announce(`${step.label}. ${live.stepMessage}`);
  speech.speak(`${step.label}. ${live.stepMessage}`);
}

// Seul un geste de confirmation accompli appelle cette fonction (R2).
// La décision (mesure à écrire ou non, prochaine étape, fin de session)
// vient de computeConfirm() (js/live.js, pure) : ici, on applique cette
// décision (persistance, audio, rendu), on ne la recalcule pas.
function confirmNext() {
  if (!live || live.paused) return;
  const result = computeConfirm(live, clock.now());

  // R3 : mesure RÉELLE entre deux confirmations. Une étape polluée par un
  // imprévu (F6) n'écrit RIEN (result.measurement est alors null).
  if (result.measurement) {
    live.measurements.push(result.measurement);
    // B1 : écriture immédiate, pas d'attente d'un bilan de fin de session
    // qui peut ne jamais arriver (l'app peut être fermée depuis l'écran
    // Trajet, ce qu'elle invite elle-même à faire).
    const state = loadState();
    recordDurations(state, [result.measurement], live.ctx);
    saveState(state);
  }
  live.polluted = false;

  if (result.ended) {
    return endLive();
  }

  live.current = result.nextCurrent;
  live.startedAt = result.nextStartedAt;
  live.nudged = false;
  live.stepMessage = null;
  audio.cue(result.reachedLeave ? 'arrive' : 'confirm');
  if (result.reachedLeave) haptics.buzz('arrive');

  const { slip } = liveStatus();
  updateLiveLight(slip);
  maybeOfferRescue(slip);
  speakStep();
  renderLive();
}

// F3 · Rattrapage : une proposition par session maximum (R5).
function maybeOfferRescue(slip) {
  if (live.rescueOffered || live.rescueVisible) return;
  if (currentStep().key === 'leave') return;
  const projected = projectLeave(live.sequence, live.current, nowMinutes());
  if (!shouldRescue(projected, live.leaveMin, live.margin)) return;
  const candidates = rescueCandidates(live.sequence, live.current);
  if (!candidates.length) return;
  live.rescueVisible = true;
  live.rescueSelection = new Set(candidates.map((s) => s.key));
}

function applyRescue(keep) {
  live.rescueVisible = false;
  live.rescueOffered = true; // ne revient pas de la session
  if (!keep) {
    for (const s of live.sequence) {
      if (live.rescueSelection.has(s.key)) s.skipped = true; // aucune mesure (R3)
    }
    const { slip } = liveStatus();
    updateLiveLight(slip); // la scène regagne en dorure
  }
  renderLive();
}

// F6 · Imprévu : pause explicite. À la reprise, l'étape en cours est
// marquée polluée : aucune écriture à sa confirmation (R3).
function pauseLive() {
  if (!live) return;
  live.paused = true;
  closeDrawer();
  renderLive();
}

function resumeLive() {
  if (!live) return;
  live.paused = false;
  live.polluted = true;
  const { slip } = liveStatus();
  updateLiveLight(slip); // recalage sans drame
  toast(UI.wordmark, pick('pause_resumed'));
  renderLive();
}

// ─── Le tiroir de séquence (spec v2 §7.4) ───────────────────────

let drawerNode = null;

function closeDrawer() {
  if (drawerNode) { drawerNode.remove(); drawerNode = null; }
}

function openDrawer() {
  closeDrawer();
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
              const { slip } = liveStatus();
              updateLiveLight(slip);
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
    el('button', { class: 'btn btn--soft', onclick: pauseLive }, UI.live_drawer_pause),
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

// ─── Rendu du Live ──────────────────────────────────────────────

function renderLive() {
  if (!live) return;
  if (holdActive) return; // ne pas détruire un appui en cours
  const { step, suggested, nudge, slip } = liveStatus();

  if (step.key === 'leave') return renderLeave(slip);
  if (live.paused) return renderPause();

  const nIdx = nextStepIdx();
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
        el('button', { class: 'btn btn--soft', style: 'flex:1', onclick: () => applyRescue(false) }, UI.live_rescue_lighten),
        el('button', { class: 'btn btn--ghost', style: 'flex:1', onclick: () => applyRescue(true) }, UI.live_rescue_keep),
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
      onConfirm: confirmNext,
      mode: live.confirmMode,
      cls: suggested ? 'state-suggested' : '',
    }),
    el('div', { class: 'spacer-sm' }),
    el('div', { class: 't-meta', style: 'text-align:center' }, hint),
    el('div', { class: 'spacer-sm' }),
    el('div', { class: 'live-bottom-links' }, [
      el('button', { class: 'btn btn--ghost', onclick: openDrawer }, UI.live_drawer_open),
      el('button', { class: 'btn btn--ghost', onclick: abortLive }, UI.live_quit),
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
    maybeOfferRescue(slip);
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
    el('button', { class: 'btn btn--primary', onclick: resumeLive }, UI.live_pause_cta),
    el('div', { class: 'spacer-sm' }),
  ]);
  render(screen, 'live-pause');
}

// ─── Le départ (spec v2 §7.7) ───────────────────────────────────

function renderLeave(slip) {
  const state = loadState();
  const profile = getProfile(state, live.profileId);
  const arrivalTxt = UI.leave_arrival(fromMin(live.arrivalMin));

  scene.setLight(1, slip > 2 ? 0.5 : 0.8); // pleine lumière : délivrance (R5)
  audio.setAmbientOpenness(1);

  if (!live.leaveAnnounced) {
    live.leaveAnnounced = true;
    live.leaveMessage = pick('leave');
    announce(`${UI.leave_title}. ${live.leaveMessage}`);
    speech.speak(`${UI.leave_title}. ${live.leaveMessage}`);
  }

  // Checklist du profil : cochable, pas bloquante.
  live.checklist = live.checklist || (profile?.checklist || []).map((c) => ({ ...c, done: false }));
  const checklist = live.checklist.length
    ? el('div', { class: 'card' }, [
        el('div', { class: 't-label' }, UI.leave_checklist_label),
        el('div', { class: 'spacer-sm' }),
        el('div', { class: 'checklist' }, live.checklist.map((item) =>
          el('button', {
            class: 'checklist-item' + (item.done ? ' is-done' : ''),
            'aria-pressed': item.done ? 'true' : 'false',
            onclick: (e) => {
              item.done = !item.done;
              haptics.buzz('tap');
              e.currentTarget.classList.toggle('is-done');
              e.currentTarget.setAttribute('aria-pressed', item.done ? 'true' : 'false');
            },
          }, [
            el('span', { class: 'checklist-item__box', 'aria-hidden': 'true' }),
            el('span', {}, item.label),
          ])
        )),
      ])
    : null;

  const contacts = state.contacts || [];
  const contactsSection = contacts.length > 0 ? buildLeaveContacts(contacts) : null;

  const screen = el('main', { class: 'screen screen--live' }, [
    wordmark(),
    el('div', { class: 'spacer-md' }),
    el('div', { class: 't-label' }, UI.leave_label),
    el('div', { class: 'spacer-sm' }),
    el('h1', { class: 't-hero' }, UI.leave_title),
    el('p', { class: 't-body', style: 'margin-top: 10px' }, live.leaveMessage),
    el('p', { class: 't-meta', style: 'margin-top: 8px' }, arrivalTxt),
    el('div', { class: 'spacer-md' }),
    checklist,
    checklist ? el('div', { class: 'spacer-md' }) : null,
    contactsSection,
    contactsSection ? el('div', { class: 'spacer-md' }) : null,
    el('div', { style: 'flex: 1' }),
    el('button', { class: 'btn btn--primary', onclick: departNow }, UI.leave_cta),
    el('div', { class: 'spacer-sm' }),
    el('button', { class: 'btn btn--ghost', onclick: abortLive }, UI.live_quit),
  ]);
  render(screen, 'leave');
}

function buildLeaveContacts(contacts) {
  const miniCards = contacts.map((c) => {
    const isSent = live.sentContactIds.has(c.id);
    const msg = MESSAGE_TEMPLATES[c.messageIdx ?? 0]();
    const initials = c.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';
    const hue = c.name.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % 360;

    return el('div', { class: 'social-mini-card' + (isSent ? ' is-sent' : '') }, [
      el('div', {
        class: 'social-avatar social-avatar--sm',
        style: `background: hsl(${hue}, 35%, 25%); color: hsl(${hue}, 60%, 75%);`,
      }, initials),
      el('div', { class: 'social-mini-info' }, [
        el('div', { class: 'social-mini-name' }, c.name),
        el('em', { class: 'social-mini-msg' }, `« ${msg} »`),
      ]),
      isSent
        ? el('div', { class: 'social-mini-sent' }, UI.social_sent)
        : el('button', {
            class: 'social-mini-send',
            onclick: (e) => {
              sendSignal(c);
              live.sentContactIds.add(c.id);
              e.currentTarget.replaceWith(el('div', { class: 'social-mini-sent' }, UI.social_sent));
            },
          }, UI.social_send),
    ]);
  });

  return el('div', { class: 'social-leave-section' }, [
    el('div', { class: 't-label', style: 'margin-bottom: 10px' }, UI.leave_contacts_label),
    el('div', { class: 'social-leave-list' }, miniCards),
  ]);
}

// "Je pars" : enregistre le départ du trajet (F5) puis enchaîne sur le bilan.
function departNow() {
  const state = loadState();
  startTrip(state, live.destinationId, live.transport);
  saveState(state);
  haptics.buzz('arrive');
  audio.cue('arrive');

  const session = {
    measurements: live.measurements,
    ctx: live.ctx,
    profileId: live.profileId,
    confirmedSteps: live.sequence
      .filter((s, i) => i < live.current && !s.skipped && s.key !== 'leave')
      .map((s) => ({ label: s.label, confirmed: true })),
  };
  stopLiveSession();
  showTrip(session);
}

function stopLiveSession() {
  clock.clearInterval(liveTicker);
  liveTicker = null;
  closeDrawer();
  wake.release();
  audio.stopAmbient();
  speech.cancel();
  live = null;
  const state = loadState();
  clearPendingSession(state);
  saveState(state);
}

function endLive() {
  // Fin atteinte sans départ explicite : on passe au bilan directement.
  const session = {
    measurements: live.measurements,
    ctx: live.ctx,
    profileId: live.profileId,
    confirmedSteps: live.sequence
      .filter((s, i) => i < live.current && !s.skipped && s.key !== 'leave')
      .map((s) => ({ label: s.label, confirmed: true })),
  };
  stopLiveSession();
  showFeedback(session);
}

function abortLive() {
  stopLiveSession();
  scene.resetLight();
  toast(UI.wordmark, UI.live_quit_confirmed);
  showHome();
}

// ─── TRAJET (F5) ────────────────────────────────────────────────

function showTrip(session) {
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

function showFeedback(session) {
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

function settingRow(label, value, onToggle) {
  return el('div', { class: 'setting-row' }, [
    el('div', { class: 't-body', style: 'color: var(--text)' }, label),
    el('button', {
      class: 'toggle ' + (value ? 'is-on' : 'is-off'),
      role: 'switch',
      'aria-checked': value ? 'true' : 'false',
      'aria-label': label,
      onclick: () => onToggle(!value),
    }, [el('span', { class: 'toggle__thumb' })]),
  ]);
}

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
    speechSynthesis.onvoiceschanged = () => { if (currentScreen === 'settings') renderS(); };
  }
  renderS();
}

// ─── F1 · MODE CHEVET ───────────────────────────────────────────

export function showBedsideSetup(prefillTime) {
  const state = loadState();
  const data = {
    wakeTime: prefillTime || state.bedside?.wakeTime || '07:00',
    profileId: state.bedside?.profileId || state.activeProfileId,
    sound: state.bedside?.sound !== false,
  };

  function renderB() {
    const screen = el('main', { class: 'screen stagger' }, [
      topbar(showHome),
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
      el('button', { class: 'btn btn--ghost', onclick: showHome }, UI.bedside_cancel),
    ]);
    render(screen, 'bedside-setup');
  }

  renderB();
}

function startNight(bedside) {
  night = {
    bedside,
    wakeTs: bedside.armedWakeTs,
    veil: 0.55,
    ringing: false,
    snoozedAt: null,
    clockShift: 0,
  };
  scene.applyScene('night');
  scene.setLight(0, 0.5);
  wake.acquire();
  wake.bindVisibility();
  renderNight();
  nightTicker = clock.setInterval(nightTick, 30000); // pas de rAF la nuit
}

function stopNight(toHome) {
  clock.clearInterval(nightTicker);
  nightTicker = null;
  audio.stopWake();
  const s = loadState();
  if (s.bedside) { disarmBedside(s.bedside); saveState(s); }
  night = null;
  if (toHome) {
    wake.release();
    showHomeFresh();
  }
}

function nightTick() {
  if (!night) return;
  const { phase, progress } = bedsidePhase(night.wakeTs, night.bedside.lightLeadMin, clock.now());

  if (phase === 'dawn') {
    // L'aube logicielle : du quasi-noir à la pénombre chaude.
    scene.setLight(progress * 0.35, 0.6);
    night.veil = Math.max(0, 0.55 * (1 - progress));
  }

  if (phase === 'wake' && !night.ringing && !night.snoozedAt) {
    startRinging();
  }

  // Re-proposition silencieuse 5 min après "Pas encore" : lumière seulement (R5).
  if (night.snoozedAt && clock.now() - night.snoozedAt >= SNOOZE_SILENT_MIN * 60000) {
    night.snoozedAt = null;
    night.silentRepropose = true;
    renderWakeProposal();
    return;
  }

  // Anti burn-in : décalage de 1 px toutes les 60 s (un tick sur deux).
  night.tickCount = (night.tickCount || 0) + 1;
  if (night.tickCount % 2 === 0) night.clockShift = (night.clockShift + 1) % 3;

  if (night.ringing) return; // l'écran de réveil gère son propre rendu
  renderNight();
}

function startRinging() {
  night.ringing = true;
  const ok = night.bedside.sound ? audio.startWake(WAKE_RISE_SECONDS) : false;
  if (night.bedside.sound && !ok) {
    // Repli : contexte suspendu malgré tout -> lumière seule + vibration.
    haptics.buzz('arrive');
    night.soundFallback = true;
  }
  scene.setLight(0.5, 0.7);
  renderWakeProposal();
}

function renderNight() {
  if (!night) return;
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const shift = night.clockShift - 1;

  // B3 : le geste de sortie du chevet (appui tenu 1 s) passe par la même
  // machine d'état que le reste de l'app (confirm-control.js), ce qui lui
  // offre gratuitement les chemins clavier et assistif. Le confirm() natif
  // reste hors périmètre de ce correctif (remonté en J1, DEC-03).
  const quitControl = createConfirmControl({
    holdMs: 1000,
    onConfirm: () => { if (confirm(UI.bedside_quit_confirm)) stopNight(true); },
    now: clock.now, setTimeoutFn: clock.setTimeout, clearTimeoutFn: clock.clearTimeout,
  });

  const screen = el('main', {
    class: 'screen screen--night',
    role: 'button',
    tabindex: '0',
    'aria-label': UI.bedside_quit_confirm,
    onpointerdown: (e) => {
      // Appui tenu 1 s : quitter (avec confirmation). Tap : rien.
      night.swipeStart = e.clientY;
      night.veilStart = night.veil;
      quitControl.pointerDown();
    },
    onpointermove: (e) => {
      if (night.swipeStart == null) return;
      const delta = e.clientY - night.swipeStart;
      if (Math.abs(delta) > 12) quitControl.reset();
      // Swipe vertical : luminosité via le voile.
      night.veil = Math.min(0.92, Math.max(0, night.veilStart + delta / 400));
      const veilEl = document.querySelector('.night-veil');
      if (veilEl) veilEl.style.background = `rgba(0,0,0,${night.veil.toFixed(2)})`;
    },
    onpointerup: () => {
      night.swipeStart = null;
      quitControl.pointerUp();
    },
    onkeydown: (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      quitControl.keyDown(e);
    },
    onkeyup: (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      quitControl.keyUp();
    },
    onclick: () => quitControl.click(),
  }, [
    el('div', { style: 'flex:1' }),
    el('div', {
      class: 'night-clock',
      style: `transform: translate(${shift}px, ${shift}px)`,
    }, `${hh}:${mm}`),
    el('div', { class: 'spacer-sm' }),
    el('div', { class: 'night-wake-time t-meta' }, `${UI.bedside_wake_label} ${night.bedside.wakeTime}`),
    el('div', { style: 'flex:1' }),
    el('div', { class: 'night-hint t-meta' }, UI.bedside_night_hint),
    el('div', { class: 'night-veil', style: `background: rgba(0,0,0,${night.veil.toFixed(2)})` }),
  ]);
  render(screen, null);
  currentScreen = 'night';
}

// L'écran de réveil : appui tenu 600 ms pour se lever (R2 étendu au réveil :
// le réveil n'avance JAMAIS seul vers le live).
function renderWakeProposal() {
  if (!night) return;
  const state = loadState();

  function wakeConfirmed() {
    haptics.buzz('confirm');
    audio.stopWake();
    // Au premier geste, si le contexte était suspendu, le son est restauré.
    if (night.soundFallback) audio.unlock();
    renderGoodMorning(state);
  }

  // B3 : même principe qu'un holdButton ordinaire (R2 étendu au réveil),
  // avec en plus les chemins clavier et assistif hérités de la machine
  // d'état commune plutôt que d'un minuteur ad hoc borné au pointeur.
  const control = createConfirmControl({
    onConfirm: wakeConfirmed,
    now: clock.now, setTimeoutFn: clock.setTimeout, clearTimeoutFn: clock.clearTimeout,
  });

  const zone = el('main', {
    class: 'screen screen--night screen--waking' + (night.silentRepropose ? ' is-pulsing' : ''),
    role: 'button',
    tabindex: '0',
    'aria-label': UI.bedside_wake_hold,
    onpointerdown: () => control.pointerDown(),
    onpointerup: () => control.pointerUp(),
    onpointercancel: () => control.pointerCancel(),
    onkeydown: (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      control.keyDown(e);
    },
    onkeyup: (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      control.keyUp();
    },
    onclick: () => control.click(),
  }, [
    el('div', { style: 'flex:1' }),
    el('div', { class: 'night-clock night-clock--waking' },
      `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`),
    el('div', { style: 'flex:1' }),
    el('div', { class: 'night-hint t-meta' }, UI.bedside_wake_hold),
  ]);

  render(zone, null);
  currentScreen = 'waking';
}

function renderGoodMorning(state) {
  scene.applyScene('dawn');
  scene.setLight(0.2, 0.6);
  const bsProfile = getProfile(state, night.bedside.profileId) || getActiveProfile(state);
  const greeting = `${pick('goodmorning')}${state.name ? ' ' + state.name + '.' : ''}`;
  speech.speak(greeting);

  const screen = el('main', { class: 'screen stagger' }, [
    wordmark(),
    el('div', { style: 'flex:1' }),
    el('h1', { class: 't-hero' }, greeting),
    el('div', { style: 'flex:1' }),
    el('button', {
      class: 'btn btn--primary',
      onclick: () => {
        const profileId = bsProfile?.id;
        stopNight(false);
        const s = loadState();
        s.activeProfileId = profileId || s.activeProfileId;
        saveState(s);
        showPreview(profileId);
      },
    }, UI.bedside_morning_cta),
    el('div', { class: 'spacer-sm' }),
    el('button', {
      class: 'btn btn--ghost',
      onclick: () => {
        // "Pas encore" : le son se tait, la lumière reste,
        // re-proposition silencieuse après 5 min (R5).
        audio.stopWake();
        night.snoozedAt = clock.now();
        night.ringing = false;
        night.silentRepropose = false;
        scene.applyScene('night');
        scene.setLight(0.35, 0.6);
        toast(UI.wordmark, pick('wake_again'));
        renderNight();
      },
    }, UI.bedside_not_yet),
  ]);
  render(screen, 'goodmorning');
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

// Rendu des écrans et navigation. Pas de calcul métier ici.

import { loadState, saveState, getActiveSteps, getActiveProfile } from './store.js';
import { showStudio } from './studio.js';
import { fromMin } from './time.js';
import { buildPlan, TRANSPORT_BUFFER } from './plan.js';
import { onFeedback } from './predict.js';
import * as audio from './audio.js';
import * as wake from './wakelock.js';
import { pick, UI } from './copy.js';
import { CHANNELS, MESSAGE_TEMPLATES, sendSignal } from './social.js';

const root = document.getElementById('app');

// État de session live (mémoire, pas persisté).
let live = null;
let liveTicker = null;

// Suivi de l'écran courant pour ne jouer l'animation d'entrée qu'une fois.
let currentScreen = null;

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null) node.setAttribute(k, v);
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
  const d = new Date();
  const day = d.getDay();
  const type = day >= 1 && day <= 5 ? 'work' : 'other';
  return { day, type };
}

function wordmark() {
  return el('div', { class: 'wordmark' }, [
    el('span', { class: 'wordmark__dot' }),
    el('span', { class: 'wordmark__name' }, UI.wordmark),
  ]);
}

function toast(title, body, emoji) {
  const t = el('div', { class: 'toast' }, [
    emoji ? el('div', { class: 'toast__emoji' }, emoji) : null,
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
  }, 2400);
}

function render(node, screenKey) {
  // Animation d'entrée seulement quand on change vraiment d'écran,
  // pas à chaque re-render interne (input, toggle, ticker live).
  if (screenKey && screenKey !== currentScreen) {
    node.classList.add('screen--enter');
    currentScreen = screenKey;
  }
  root.replaceChildren(node);
}

// ECRAN HOME

export function showHome() {
  const state = loadState();
  const ctx = ctxNow();
  const routineToday = state.routine && state.routine.days.includes(ctx.day) ? state.routine : null;
  const activeProfile = getActiveProfile(state);

  const title = state.name ? UI.home_title_with_name(state.name) : UI.home_title_anon;

  const children = [
    wordmark(),
    el('div', { class: 'spacer-lg' }),
    el('h1', { class: 't-display t-display--lg' }, title),
    el('div', { class: 'spacer-lg' }),
  ];

  if (routineToday) {
    children.push(
      el('div', { class: 'card card--accent' }, [
        el('div', { class: 't-label' }, UI.home_routine_label),
        el('div', { class: 'spacer-sm' }),
        el('div', { class: 't-body' }, UI.home_routine_sub),
        el('div', { class: 'spacer-md' }),
        el('button', {
          class: 'btn btn--primary',
          onclick: () => showPreview(routineToday),
        }, UI.home_routine_cta),
      ]),
      el('div', { class: 'spacer-md' }),
    );
  }

  const activeStepCount = activeProfile
    ? activeProfile.steps.filter((s) => s.active).length
    : 0;
  const profileSub = activeProfile
    ? el('div', { class: 'home-profile-tag' }, [
        el('span', {}, activeProfile.emoji),
        el('span', {}, activeProfile.name),
        el('span', { class: 'home-profile-tag__count' }, ` · ${activeStepCount} étapes`),
      ])
    : null;

  children.push(
    el('button', {
      class: 'btn btn--primary',
      onclick: () => showPreview(null),
      'aria-label': UI.home_cta,
    }, [
      el('span', {}, UI.home_cta),
    ]),
    profileSub,
    el('div', { class: 'spacer-sm' }),
    el('button', { class: 'btn btn--soft', onclick: showStudio }, UI.home_studio_link),
    el('div', { class: 'spacer-sm' }),
    el('button', { class: 'btn btn--ghost', onclick: showSocial }, UI.home_social_link),
  );

  const screen = el('main', { class: 'screen stagger' }, children);
  render(screen, 'home');
}

// ECRAN PREVIEW

function showPreview(prefill) {
  const state = loadState();
  const ctx = ctxNow();
  const steps = getActiveSteps(state);

  const data = {
    arrival: prefill?.arrival || '09:00',
    transport: prefill?.transport || 'walk',
    travel: prefill?.travel ?? 20,
  };

  const transportLabels = {
    walk: UI.transport_walk, bike: UI.transport_bike,
    car: UI.transport_car, transit: UI.transport_transit,
  };
  const transportEmojis = { walk: '🚶', bike: '🚲', car: '🚗', transit: '🚌' };

  function render2() {
    const plan = buildPlan(steps, data.arrival, data.travel, data.transport, state.latenessScore, ctx);
    // R4 : la marge n'est jamais affichée ni nommée.

    const transportPills = Object.keys(TRANSPORT_BUFFER).map((k) =>
      el('button', {
        class: 'pill' + (data.transport === k ? ' is-on' : ''),
        onclick: () => { data.transport = k; render2(); },
      }, [
        el('span', {}, transportEmojis[k]),
        el('span', {}, transportLabels[k]),
      ])
    );

    const timeline = plan.sequence.map((s) => {
      const isLeave = s.key === 'leave';
      const learned = s.confidence > 0 && s.real && s.real.length >= 2
        ? el('div', { class: 'timeline-item__learned' }, UI.preview_learned(s.dur))
        : null;
      return el('div', { class: 'timeline-item' + (isLeave ? ' timeline-item--leave' : '') }, [
        el('div', { class: 'timeline-item__time' }, fromMin(s.at)),
        el('div', { class: 'timeline-item__emoji' }, s.emoji || ''),
        el('div', { class: 'timeline-item__label' }, [
          el('div', {}, s.label),
          learned,
        ]),
      ]);
    });

    const screen = el('main', { class: 'screen stagger' }, [
      wordmark(),
      el('div', { class: 'spacer-md' }),
      el('h1', { class: 't-display' }, UI.preview_subtitle(fromMin(plan.startMin))),
      el('p', { class: 't-body', style: 'margin-top: 12px' }, UI.preview_body),
      el('div', { class: 'spacer-md' }),

      el('div', { class: 'card' }, [
        el('div', { class: 't-label' }, UI.preview_arrival_label),
        el('div', { class: 'spacer-sm' }),
        el('input', {
          class: 'time-input',
          type: 'time',
          value: data.arrival,
          onchange: (e) => { data.arrival = e.target.value || '09:00'; render2(); },
        }),
        el('div', { class: 'spacer-md' }),
        el('div', { class: 't-label' }, UI.preview_transport_label),
        el('div', { class: 'spacer-sm' }),
        el('div', { style: 'display:flex; gap:8px; flex-wrap:wrap' }, transportPills),
        el('div', { class: 'spacer-md' }),
        el('div', { class: 't-label' }, UI.preview_travel_label),
        el('div', { class: 'spacer-sm' }),
        el('input', {
          class: 'text-input',
          type: 'number',
          min: '0', max: '180',
          value: String(data.travel),
          onchange: (e) => { data.travel = Number(e.target.value) || 0; render2(); },
        }),
      ]),

      el('div', { class: 'spacer-md' }),
      el('div', { class: 't-label' }, UI.preview_sequence_label),
      el('div', { class: 'spacer-sm' }),
      el('div', { style: 'display:flex; flex-direction:column; gap:8px' }, timeline),

      el('div', { class: 'spacer-md' }),
      el('div', { class: 'callout callout--amber' }, [
        el('div', { class: 'callout__icon' }, '🛡️'),
        el('div', { class: 'callout__text' }, UI.preview_margin_notice),
      ]),
      el('div', { class: 'spacer-sm' }),
      el('div', { class: 'callout callout--warning' }, [
        el('div', { class: 'callout__icon' }, '📱'),
        el('div', { class: 'callout__text' }, UI.preview_wakelock_notice),
      ]),

      el('div', { class: 'spacer-md' }),
      el('button', { class: 'btn btn--primary', onclick: () => startLive(plan) }, UI.preview_cta),
      el('div', { class: 'spacer-sm' }),
      el('button', { class: 'btn btn--ghost', onclick: showHome }, UI.preview_back),
    ]);
    render(screen, 'preview');
  }

  render2();
}

// ECRAN LIVE (R1 + R2 + R3)

function startLive(plan) {
  const ctx = ctxNow();
  live = {
    sequence: plan.sequence,
    leaveMin: plan.leaveMin,
    arrivalMin: plan.arrivalMin,
    current: 0,
    startedAt: Date.now(),
    measurements: [],
    nudged: false,
    suggestedAnnounced: false,
    currentSlipMsg: null,
    sentContactIds: new Set(),
    ctx,
  };
  wake.acquire();
  wake.bindVisibility();
  updateSessionProgress(0);
  audio.cue(live.sequence[0].key);
  renderLive();
  liveTicker = setInterval(renderLive, 5000);
}

function liveStatus() {
  const step = live.sequence[live.current];
  const elapsedMin = (Date.now() - live.startedAt) / 60000;
  const suggested = elapsedMin >= step.dur && live.current < live.sequence.length - 1;
  const nudgeThreshold = Math.max(step.dur * 1.6, step.dur + 4);
  const nudge = step.dur > 0 && elapsedMin >= nudgeThreshold;

  // Recalcul de l'heure de départ projetée (somme des durées restantes hors étape courante).
  const remaining = live.sequence.slice(live.current).reduce((a, s, i) => i === 0 ? a : a + s.dur, 0);
  const d = new Date();
  const nowMin = d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
  const projectedLeave = nowMin + remaining;
  let slip = projectedLeave - live.leaveMin;
  if (slip > 720) slip -= 1440;
  if (slip < -720) slip += 1440;

  // Progression organique (R1 : aucune valeur affichée, juste un ratio CSS).
  const progress = step.dur > 0 ? Math.min(elapsedMin / step.dur, 1.4) : 1;

  return { step, suggested, nudge, slip, progress, elapsedMin };
}

function confirmNext() {
  if (!live) return;
  const step = live.sequence[live.current];
  // R3 : mesure RÉELLE.
  const realDur = Math.max(1, Math.round((Date.now() - live.startedAt) / 60000));
  if (step.key !== 'leave') {
    live.measurements.push({ stepKey: step.key, v: realDur });
  }

  if (live.current >= live.sequence.length - 1) {
    return endLive();
  }

  // Onde lumineuse sur le bouton, arrêt de la respiration de l'emoji.
  const btn = document.querySelector('.btn--confirm');
  const emoji = document.querySelector('.step-emoji');
  if (btn) {
    btn.classList.remove('state-suggested', 'state-idle');
    btn.classList.add('state-releasing');
  }
  if (emoji) emoji.classList.add('state-done');

  setTimeout(() => {
    if (!live) return;
    live.current += 1;
    live.startedAt = Date.now();
    live.nudged = false;
    live.suggestedAnnounced = false;
    live.currentSlipMsg = null;
    updateSessionProgress(live.current / Math.max(1, live.sequence.length - 1));
    audio.cue(live.sequence[live.current].key);
    renderLive();
  }, 450);
}

// Progression imperceptible du fond pendant la session.
// progress : 0 (réveil) vers 1 (départ). Jamais perceptible en temps réel.
function updateSessionProgress(progress) {
  const root = document.documentElement;
  const rStart = 15, gStart = 13, bStart = 11;
  const rEnd   = 18, gEnd   = 15, bEnd   = 8;
  const r = Math.round(rStart + (rEnd - rStart) * progress);
  const g = Math.round(gStart + (gEnd - gStart) * progress);
  const b = Math.round(bStart + (bEnd - bStart) * progress);
  root.style.setProperty('--bg-session', `rgb(${r},${g},${b})`);

  const glowAlpha = Math.max(0, (progress - 0.6) / 0.4) * 0.05;
  root.style.setProperty('--glow-session',
    `rgba(232,180,80,${glowAlpha.toFixed(3)})`);

  const breathDur = 5.5 - (5.5 - 4.2) * progress;
  document.querySelector('.step-emoji')
    ?.style.setProperty('--breath-dur', `${breathDur.toFixed(1)}s`);
}

function resetSessionProgress() {
  const root = document.documentElement;
  root.style.removeProperty('--bg-session');
  root.style.removeProperty('--glow-session');
}

function renderLive() {
  if (!live) return;
  const { step, suggested, nudge, slip, progress } = liveStatus();
  const isLeave = step.key === 'leave';
  const next = live.sequence[live.current + 1];

  // Message glissement, tiré une fois par étape pour rester stable.
  if (slip > 2 && !live.currentSlipMsg) {
    live.currentSlipMsg = pick('slip');
  } else if (slip <= 2) {
    live.currentSlipMsg = null;
  }

  if (isLeave) {
    return renderLeave(slip);
  }

  // Texte du bouton selon l'état.
  const nextLabel = next ? next.label.toLowerCase() : '';
  const btnText = suggested
    ? UI.live_confirm_suggested(nextLabel)
    : UI.live_confirm_idle(nextLabel);
  const hint = suggested ? UI.live_confirm_hint_suggested : UI.live_confirm_hint_idle;

  // Message d'étape : tiré au premier render de l'étape.
  if (!live.stepMessage || live.lastMessageStep !== live.current) {
    live.stepMessage = pick(step.key);
    live.lastMessageStep = live.current;
  }

  const progressFill = el('div', {
    class: 'progress-fill' + (nudge ? ' state-overrun' : ''),
    style: `width: ${Math.min(progress, 1) * 100}%`,
  });

  // is-new : animation d'entrée du step-card uniquement à la prise de fonction.
  const isNewStep = live.lastRenderedStep !== live.current;
  live.lastRenderedStep = live.current;

  const stepCardClasses = ['step-card'];
  if (suggested) stepCardClasses.push('state-suggested');
  if (nudge) stepCardClasses.push('state-nudge');
  if (isNewStep) stepCardClasses.push('is-new');

  const stepCard = el('div', { class: stepCardClasses.join(' ') }, [
    el('div', { class: 'step-emoji' }, step.emoji || ''),
    el('h1', { class: 't-step' }, step.label),
    el('p', { class: 't-body', style: 'margin-top: 16px' }, live.stepMessage),
  ]);

  const screen = el('main', { class: 'screen' }, [
    wordmark(),
    el('div', { class: 'spacer-md' }),
    el('div', { class: 't-label' }, UI.live_current_label),
    el('div', { class: 'spacer-sm' }),
    stepCard,
    el('div', { class: 'spacer-md' }),
    el('div', { class: 'progress-track' }, progressFill),

    next ? el('div', { class: 't-label', style: 'text-align:center' },
      `${UI.live_next_prefix} ${next.emoji || ''} ${next.label}`) : null,

    nudge ? el('div', { class: 'spacer-md' }) : null,
    nudge ? el('div', { class: 'callout callout--amber' }, [
      el('div', { class: 'callout__icon' }, '🤲'),
      el('div', { class: 'callout__text' }, pick('nudge')),
    ]) : null,

    live.currentSlipMsg ? el('div', { class: 'spacer-sm' }) : null,
    live.currentSlipMsg ? el('div', { class: 'callout' }, [
      el('div', { class: 'callout__icon' }, '🌿'),
      el('div', { class: 'callout__text' }, live.currentSlipMsg),
    ]) : null,

    el('div', { style: 'flex: 1' }),

    el('button', {
      class: 'btn btn--confirm ' + (suggested ? 'state-suggested' : 'state-idle'),
      onclick: confirmNext,
    }, btnText),
    el('div', { class: 'spacer-sm' }),
    el('div', { class: 'callout' }, [
      el('div', { class: 'callout__icon' }, suggested ? '🌅' : '🤍'),
      el('div', { class: 'callout__text' }, hint),
    ]),
    el('div', { class: 'spacer-sm' }),
    el('button', { class: 'btn btn--ghost', onclick: abortLive }, UI.live_quit),
  ]);
  render(screen, 'live');

  if (suggested && !live.suggestedAnnounced && next) {
    live.suggestedAnnounced = true;
    audio.cue(next.key);
    toast(next.label, pick(next.key), next.emoji);
  }

  if (nudge && !live.nudged) {
    live.nudged = true;
    audio.cue('nudge');
  }
}

function renderLeave(slip) {
  // R4 : on n'affiche jamais la marge. On dit juste l'arrivée prévue.
  const arrivalTxt = slip > 2
    ? UI.leave_slip(fromMin(live.arrivalMin))
    : UI.leave_arrival(fromMin(live.arrivalMin));

  const leaveMsg = pick('leave');

  // L'animation du halo joue une seule fois à l'arrivée sur l'écran.
  const isNewLeave = !live.leaveRendered;
  live.leaveRendered = true;

  const halo = el('div', { class: 'leave-card' + (isNewLeave ? ' is-new' : '') }, [
    el('div', { class: 'leave-icon-wrap' }, [
      el('div', { class: 'leave-ring' }),
      el('div', { class: 'leave-ring' }),
      el('div', { class: 'leave-icon-bg' }, '🌅'),
    ]),
    el('h1', { class: 't-display', style: 'text-align:center' }, UI.leave_title),
    el('p', { class: 't-body', style: 'margin-top: 14px; text-align:center' }, leaveMsg),
    el('div', { class: 'spacer-sm' }),
    el('p', { class: 't-label', style: 'text-align:center' }, arrivalTxt),
  ]);

  // Section contacts (spec §7) : affichée uniquement si l'utilisateur a des proches.
  const contacts = loadState().contacts || [];
  const contactsSection = contacts.length > 0
    ? buildLeaveContacts(contacts, slip)
    : null;

  const screen = el('main', { class: 'screen' }, [
    wordmark(),
    el('div', { class: 'spacer-md' }),
    el('div', { class: 't-label' }, UI.leave_label),
    el('div', { class: 'spacer-sm' }),
    halo,
    contactsSection ? el('div', { class: 'spacer-md' }) : null,
    contactsSection,
    el('div', { style: 'flex: 1' }),
    el('button', { class: 'btn btn--primary', onclick: confirmNext }, UI.leave_cta),
    el('div', { class: 'spacer-sm' }),
    el('button', { class: 'btn btn--ghost', onclick: abortLive }, UI.live_quit),
  ]);
  render(screen, 'live');
}

function buildLeaveContacts(contacts, slip) {
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
        ? el('div', { class: 'social-mini-sent' }, '✓ envoyé')
        : el('button', {
            class: 'social-mini-send',
            onclick: () => {
              sendSignal(c);
              live.sentContactIds.add(c.id);
              renderLeave(slip);
            },
          }, 'Envoyer'),
    ]);
  });

  return el('div', { class: 'social-leave-section' }, [
    el('div', { class: 't-label', style: 'margin-bottom: 10px' }, UI.social_leave_nearby),
    el('div', { class: 'social-leave-list' }, miniCards),
  ]);
}

function endLive() {
  clearInterval(liveTicker); liveTicker = null;
  wake.release();
  resetSessionProgress();
  const measurements = live.measurements;
  const ctx = live.ctx;
  live = null;
  showFeedback(measurements, ctx);
}

function abortLive() {
  clearInterval(liveTicker); liveTicker = null;
  wake.release();
  resetSessionProgress();
  live = null;
  showHome();
}

// ECRAN FEEDBACK (R5)

function showFeedback(measurements, ctx) {
  let selected = null;

  function submit() {
    if (!selected) return;
    const state = loadState();
    onFeedback(state, selected, measurements, ctx);
    saveState(state);
    toast(UI.feedback_label, pick(`feedback_${selected}`), '🌿');
    setTimeout(() => showInsight(), 700);
  }

  const options = [
    { key: 'early', label: UI.feedback_early_label, emoji: '🌤️' },
    { key: 'ontime', label: UI.feedback_ontime_label, emoji: '🌞' },
    { key: 'late', label: UI.feedback_late_label, emoji: '🌥️' },
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
            el('div', { class: 'feedback-option__icon' }, o.emoji),
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

// ECRAN INSIGHT

function showInsight() {
  const state = loadState();
  const steps = getActiveSteps(state);
  const last7 = state.history.slice(-7);
  const ontime = last7.filter((h) => h.status !== 'late').length;
  const ratio = last7.length ? Math.round((ontime / last7.length) * 100) : null;

  const learned = steps
    .filter((s) => s.active && s.real.length >= 2)
    .map((s) => {
      const mean = Math.round(s.real.reduce((a, r) => a + r.v, 0) / s.real.length);
      const variance = Math.round(Math.sqrt(s.real.reduce((a, r) => a + (r.v - mean) ** 2, 0) / s.real.length));
      return { ...s, mean, variance };
    });

  const statusColor = {
    early: 'var(--status-early)',
    ontime: 'var(--status-ok)',
    late: 'var(--status-late)',
  };

  const screen = el('main', { class: 'screen stagger' }, [
    wordmark(),
    el('div', { class: 'spacer-md' }),
    el('div', { class: 't-label' }, UI.insight_label),
    el('div', { class: 'spacer-sm' }),
    el('h1', { class: 't-display' }, ratio == null ? UI.insight_first : UI.insight_rate(ratio)),

    last7.length > 0 ? el('div', { class: 'spacer-md' }) : null,
    last7.length > 0 ? el('div', { class: 't-label' }, UI.insight_history_label) : null,
    last7.length > 0 ? el('div', { class: 'spacer-sm' }) : null,
    last7.length > 0 ? el('div', { class: 'history-bars' },
      last7.map((h) => el('div', {
        class: 'history-bar',
        style: `height: ${h.status === 'late' ? 35 : h.status === 'early' ? 80 : 55}%; background: ${statusColor[h.status]}`,
      }))
    ) : null,

    el('div', { class: 'spacer-md' }),
    el('div', { class: 'card' }, [
      el('div', { class: 't-label' }, UI.insight_learned_title),
      el('div', { class: 'spacer-sm' }),
      learned.length === 0
        ? el('p', { class: 't-body' }, UI.insight_learned_empty)
        : el('div', { style: 'display:flex; flex-direction:column; gap:10px' },
            learned.map((s) =>
              el('div', { class: 'timeline-item' }, [
                el('div', { class: 'timeline-item__emoji' }, s.emoji || ''),
                el('div', { class: 'timeline-item__label' }, [
                  el('div', {}, s.label),
                  el('div', { class: 'timeline-item__learned' },
                    s.variance > 2 ? UI.insight_mean_var(s.mean, s.variance) : UI.insight_mean(s.mean)),
                ]),
                el('div', { class: 'tag tag--accent' }, UI.insight_was(s.est)),
              ])
            )
          ),
    ]),

    el('div', { class: 'spacer-md' }),
    el('div', { class: 'callout callout--amber' }, [
      el('div', { class: 'callout__icon' }, '🔒'),
      el('div', { class: 'callout__text' }, UI.insight_learned_privacy),
    ]),

    el('div', { class: 'spacer-md' }),
    el('button', { class: 'btn btn--primary', onclick: showHome }, UI.insight_back),
  ]);
  render(screen, 'insight');
}

// ECRAN ROUTINE

export function showRoutine() {
  const state = loadState();
  const r = state.routine || { arrival: '09:00', transport: 'walk', travel: 20, days: [1,2,3,4,5], evening: false };
  const data = { ...r };

  function save() {
    const next = loadState();
    next.routine = data;
    saveState(next);
    toast(UI.routine_label, UI.routine_saved, '🌿');
    setTimeout(showHome, 600);
  }

  function clear() {
    const next = loadState();
    next.routine = null;
    saveState(next);
    toast(UI.routine_label, UI.routine_cleared, '🍃');
    setTimeout(showHome, 600);
  }

  function renderR() {
    const dayLabels = ['D','L','M','M','J','V','S'];
    const screen = el('main', { class: 'screen stagger' }, [
      wordmark(),
      el('div', { class: 'spacer-md' }),
      el('div', { class: 't-label' }, UI.routine_label),
      el('div', { class: 'spacer-sm' }),
      el('h1', { class: 't-display' }, UI.routine_title),
      el('p', { class: 't-body', style: 'margin-top: 12px' }, UI.routine_body),
      el('div', { class: 'spacer-md' }),

      el('div', { class: 'card' }, [
        el('div', { class: 't-label' }, UI.routine_arrival_label),
        el('div', { class: 'spacer-sm' }),
        el('input', {
          class: 'time-input',
          type: 'time',
          value: data.arrival,
          oninput: (e) => { data.arrival = e.target.value || '09:00'; },
        }),
        el('div', { class: 'spacer-md' }),
        el('div', { class: 't-label' }, UI.routine_travel_label),
        el('div', { class: 'spacer-sm' }),
        el('input', {
          class: 'text-input',
          type: 'number',
          min: '0', max: '180',
          value: String(data.travel),
          oninput: (e) => { data.travel = Number(e.target.value) || 0; },
        }),
        el('div', { class: 'spacer-md' }),
        el('div', { class: 't-label' }, UI.routine_days_label),
        el('div', { class: 'spacer-sm' }),
        el('div', { style: 'display:flex; gap:6px; flex-wrap:wrap' },
          dayLabels.map((lab, i) => {
            const on = data.days.includes(i);
            return el('button', {
              class: 'pill' + (on ? ' is-on' : ''),
              onclick: () => {
                data.days = on ? data.days.filter((d) => d !== i) : [...data.days, i].sort();
                renderR();
              },
            }, lab);
          })
        ),
      ]),

      el('div', { class: 'spacer-md' }),
      el('div', { class: 'card' }, [
        el('div', { style: 'display:flex; justify-content:space-between; align-items:center; gap:12px' }, [
          el('div', {}, [
            el('div', { class: 't-body', style: 'color: var(--text); font-weight: 600' }, UI.routine_evening_label),
            el('div', { class: 't-body', style: 'font-size: 13px; margin-top: 2px' }, UI.routine_evening_sub),
          ]),
          el('button', {
            class: 'toggle ' + (data.evening ? 'is-on' : 'is-off'),
            onclick: () => { data.evening = !data.evening; renderR(); },
          }, [ el('span', { class: 'toggle__thumb' }) ]),
        ]),
      ]),

      el('div', { class: 'spacer-md' }),
      el('button', { class: 'btn btn--primary', onclick: save }, UI.routine_cta),
      el('div', { class: 'spacer-sm' }),
      state.routine ? el('button', { class: 'btn btn--ghost', onclick: clear }, UI.routine_clear) : null,
      el('div', { class: 'spacer-sm' }),
      el('button', { class: 'btn btn--ghost', onclick: showHome }, UI.routine_back),
    ]);
    render(screen, 'routine');
  }

  renderR();
}

// ECRAN SOCIAL

function showSocial() {
  // sentTimes : Map<id, timestamp> pour l'état "envoyé" 4 secondes (local, non persisté).
  const sentTimes = new Map();
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

    function handleSend(contact) {
      sendSignal(contact);
      sentTimes.set(contact.id, Date.now());
      renderSocial();
      setTimeout(() => { if (currentScreen === 'social') renderSocial(); }, 4200);
    }

    const contactCards = contacts.map((c) => {
      const isSent = sentTimes.has(c.id) && (Date.now() - sentTimes.get(c.id)) < 4000;
      const channel = CHANNELS.find((ch) => ch.key === c.channel) || CHANNELS[0];
      const msg = MESSAGE_TEMPLATES[c.messageIdx ?? 0]();
      const initials = c.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';
      const hue = c.name.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % 360;

      const avatar = el('div', {
        class: 'social-avatar',
        style: `background: hsl(${hue}, 35%, 25%); color: hsl(${hue}, 60%, 75%);`,
      }, initials);

      return el('div', { class: 'social-contact-card' }, [
        el('div', { class: 'social-card-header' }, [
          avatar,
          el('div', { class: 'social-card-info' }, [
            el('div', { class: 'social-card-name' }, c.name),
            el('div', { class: 'social-card-meta' }, `${channel.emoji} ${channel.label} · ${c.number}`),
          ]),
          el('button', {
            class: 'social-card-edit',
            onclick: () => openModal(c),
            'aria-label': 'Modifier',
          }, '✎'),
          el('button', {
            class: 'social-card-delete',
            onclick: () => deleteContact(c.id),
            'aria-label': 'Supprimer',
          }, '×'),
        ]),
        el('p', { class: 'social-card-preview' }, `« ${msg} »`),
        isSent
          ? el('div', { class: 'social-send-btn is-sent' }, '✓ Messagerie ouverte')
          : el('button', { class: 'social-send-btn', onclick: () => handleSend(c) },
              '🌿 Envoyer le signal de départ'),
      ]);
    });

    const canAdd = contacts.length < 5;

    const screen = el('main', { class: 'screen stagger' }, [
      el('div', { class: 'studio-topbar' }, [
        wordmark(),
        el('button', { class: 'studio-back-btn', onclick: showHome }, '← Retour'),
      ]),
      el('div', { class: 'spacer-md' }),
      el('div', { class: 't-label' }, UI.social_label),
      el('div', { class: 'spacer-sm' }),
      el('h1', { class: 't-display' }, UI.social_title),
      el('div', { class: 'spacer-md' }),
      el('div', { class: 'callout callout--amber' }, [
        el('div', { class: 'callout__icon' }, '🔒'),
        el('div', { class: 'callout__text' }, UI.social_privacy),
      ]),
      el('div', { class: 'spacer-md' }),
      contacts.length > 0
        ? el('div', { class: 'social-contact-list' }, contactCards)
        : null,
      contacts.length > 0 ? el('div', { class: 'spacer-sm' }) : null,
      canAdd
        ? el('button', { class: 'social-add-btn', onclick: () => openModal(null) },
            '+ Ajouter un proche')
        : null,
      el('div', { style: 'flex: 1' }),
      el('div', { class: 'social-guardrail' }, [
        el('div', { class: 'social-guardrail__line' }),
        el('p', { class: 'social-guardrail__text' }, UI.social_guardrail_full),
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
      modalNode.style.transition = 'opacity 180ms';
      modalNode.style.opacity = '0';
      const node = modalNode;
      setTimeout(() => { node.remove(); if (modalNode === node) modalNode = null; }, 200);
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

    const channelPills = CHANNELS.map((ch) =>
      el('button', {
        class: 'pill' + (draft.channel === ch.key ? ' is-on' : ''),
        onclick: () => { draft.channel = ch.key; renderModal(draft); },
      }, [
        el('span', {}, ch.emoji),
        el('span', {}, ch.label),
      ])
    );

    const isTelegram = draft.channel === 'telegram';
    const nameInput = el('input', {
      class: 'text-input',
      type: 'text',
      placeholder: 'Prénom',
      value: draft.name,
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
      class: 'btn btn--primary',
      style: 'flex:1',
      disabled: (!draft.name.trim() || !draft.number.trim()) ? true : null,
      onclick: save,
    }, isNew ? 'Ajouter' : 'Enregistrer');

    function updateSaveBtn() {
      saveBtn.disabled = !draft.name.trim() || !draft.number.trim();
    }

    const templateItems = MESSAGE_TEMPLATES.map((tpl, i) =>
      el('button', {
        class: 'social-template-item' + (draft.messageIdx === i ? ' is-selected' : ''),
        onclick: () => { draft.messageIdx = i; renderModal(draft); },
      }, el('em', {}, `« ${tpl()} »`))
    );

    const sheet = el('div', { class: 'studio-modal__sheet' }, [
      el('div', { class: 'studio-modal__handle' }),
      el('div', { class: 't-label' }, isNew ? 'Nouveau proche' : 'Modifier'),
      el('div', { class: 'spacer-sm' }),
      el('div', { class: 't-label', style: 'font-size:11px;margin-bottom:6px' }, 'Prénom'),
      nameInput,
      el('div', { class: 'spacer-sm' }),
      el('div', { class: 't-label', style: 'font-size:11px;margin-bottom:6px' }, 'Canal préféré'),
      el('div', { class: 'social-channel-grid' }, channelPills),
      el('div', { class: 'spacer-sm' }),
      el('div', { class: 't-label', style: 'font-size:11px;margin-bottom:6px' }, 'Numéro ou pseudo'),
      numberInput,
      el('div', { class: 'spacer-sm' }),
      el('div', { class: 't-label', style: 'font-size:11px;margin-bottom:6px' }, 'Message envoyé'),
      el('div', { class: 'social-template-list' }, templateItems),
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

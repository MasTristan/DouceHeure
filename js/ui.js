// Rendu des écrans et navigation. Pas de calcul métier ici.

import { loadState, saveState } from './store.js';
import { toMin, fromMin } from './time.js';
import { buildPlan, TRANSPORT_BUFFER } from './plan.js';
import { onFeedback } from './predict.js';
import * as audio from './audio.js';
import * as wake from './wakelock.js';

const root = document.getElementById('app');

// État de session live (mémoire, pas persisté).
let live = null;
let liveTicker = null;

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null) node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

function ctxNow() {
  const d = new Date();
  const day = d.getDay();
  // type 'work' lundi à vendredi, 'other' sinon (heuristique simple).
  const type = day >= 1 && day <= 5 ? 'work' : 'other';
  return { day, type };
}

function toast(msg) {
  const t = el('div', { class: 'toast show' }, msg);
  document.body.appendChild(t);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 220); }, 2400);
}

function render(node) {
  root.replaceChildren(node);
}

// ---------- ÉCRAN HOME ----------

export function showHome() {
  const state = loadState();
  const ctx = ctxNow();
  const routineToday = state.routine && state.routine.days.includes(ctx.day) ? state.routine : null;

  const hello = state.name ? `Bonjour ${state.name}` : 'Bonjour';

  const screen = el('main', { class: 'screen screen-home' }, [
    el('header', { class: 'home-header' }, [
      el('p', { class: 'eyebrow' }, hello),
      el('h1', { class: 'display' }, 'Douce heure')
    ]),
    el('section', { class: 'home-empty' }, [
      el('p', { class: 'lead' }, 'Prépare un départ tranquille, à ton rythme.')
    ]),
    routineToday ? el('div', { class: 'card card-hi' }, [
      el('p', { class: 'eyebrow' }, 'Ton départ habituel'),
      el('p', { class: 'lead', style: 'margin-top:6px' }, `Arrivée à ${routineToday.arrival}`),
      el('div', { style: 'display:flex; gap:10px; margin-top:14px' }, [
        el('button', {
          class: 'btn btn-primary',
          style: 'flex:1',
          onclick: () => showPreview(routineToday)
        }, 'Lancer ce départ')
      ])
    ]) : null,
    el('div', { style: 'display:flex; flex-direction:column; gap:12px' }, [
      el('button', { class: 'btn btn-primary', onclick: () => showPreview(null) }, 'Préparer un départ'),
      el('button', { class: 'btn', onclick: showRoutine }, 'Mon rituel'),
      el('button', { class: 'btn btn-ghost', onclick: showSocial }, 'Mes proches')
    ])
  ]);
  render(screen);
}

// ---------- ÉCRAN PREVIEW ----------

function showPreview(prefill) {
  const state = loadState();
  const ctx = ctxNow();

  const data = {
    arrival: prefill?.arrival || '09:00',
    transport: prefill?.transport || 'walk',
    travel: prefill?.travel ?? 20
  };

  function rebuild() {
    const plan = buildPlan(state.steps, data.arrival, data.travel, data.transport, state.latenessScore, ctx);
    return plan;
  }

  function render2() {
    const plan = rebuild();
    // R4 : ne JAMAIS nommer ni afficher plan.margin.
    const screen = el('main', { class: 'screen' }, [
      el('header', { class: 'home-header' }, [
        el('p', { class: 'eyebrow' }, 'Ton départ'),
        el('h1', { class: 'display' }, `Arrivée ${data.arrival}`)
      ]),

      el('div', { class: 'card' }, [
        el('label', { class: 'eyebrow' }, 'Heure d\'arrivée'),
        el('input', {
          type: 'time', value: data.arrival,
          style: 'width:100%; margin-top:8px; background:transparent; color:var(--text); border:1px solid var(--border); border-radius:12px; padding:10px 12px; font-size:17px; font-family:inherit;',
          oninput: (e) => { data.arrival = e.target.value || '09:00'; render2(); }
        }),
        el('div', { style: 'display:flex; gap:8px; flex-wrap:wrap; margin-top:14px' }, [
          ...Object.keys(TRANSPORT_BUFFER).map((k) => {
            const labels = { walk: 'À pied', bike: 'Vélo', car: 'Voiture', transit: 'Transports' };
            const isOn = data.transport === k;
            return el('button', {
              class: 'pill',
              style: isOn ? 'background:var(--accent-dk); color:var(--text); border-color:var(--accent-md)' : '',
              onclick: () => { data.transport = k; render2(); }
            }, labels[k]);
          })
        ]),
        el('label', { class: 'eyebrow', style: 'display:block; margin-top:14px' }, 'Durée du trajet (min)'),
        el('input', {
          type: 'number', min: '0', max: '180', value: String(data.travel),
          style: 'width:100%; margin-top:8px; background:transparent; color:var(--text); border:1px solid var(--border); border-radius:12px; padding:10px 12px; font-size:17px; font-family:inherit;',
          oninput: (e) => { data.travel = Number(e.target.value) || 0; render2(); }
        })
      ]),

      el('div', { class: 'card card-hi' }, [
        el('p', { class: 'eyebrow' }, 'Le moment de te lever'),
        el('h2', { style: 'font-size:32px; margin-top:4px' }, fromMin(plan.startMin))
      ]),

      el('div', { class: 'card' }, [
        el('p', { class: 'eyebrow' }, 'Ta séquence'),
        el('div', { style: 'display:flex; flex-direction:column; gap:10px; margin-top:10px' },
          plan.sequence.map((s) =>
            el('div', { style: 'display:flex; justify-content:space-between; align-items:center; gap:12px' }, [
              el('span', {}, `${s.emoji || ''} ${s.label}`),
              el('span', { class: 'pill' }, fromMin(s.at))
            ])
          )
        )
      ]),

      el('div', { class: 'card', style: 'border-color:var(--border-hi)' }, [
        el('p', { class: 'lead' }, 'Pose ton téléphone en vue et garde Douce heure ouverte. L\'app reste avec toi pendant toute la préparation.')
      ]),

      el('div', { style: 'display:flex; flex-direction:column; gap:10px' }, [
        el('button', { class: 'btn btn-primary', onclick: () => startLive(plan) }, 'Lancer le guide'),
        el('button', { class: 'btn btn-ghost', onclick: showHome }, 'Retour')
      ])
    ]);
    render(screen);
  }

  render2();
}

// ---------- ÉCRAN LIVE (le coeur, R1 + R2 + R3) ----------

function startLive(plan) {
  const ctx = ctxNow();
  live = {
    sequence: plan.sequence,
    leaveMin: plan.leaveMin,
    arrivalMin: plan.arrivalMin,
    current: 0,
    startedAt: Date.now(),
    measurements: [], // { stepKey, v }
    nudged: false,
    ctx
  };
  wake.acquire();
  wake.bindVisibility();
  audio.cue(live.sequence[0].key);
  renderLive();
  liveTicker = setInterval(renderLive, 5000);
}

function liveStatus() {
  const step = live.sequence[live.current];
  const elapsedMin = (Date.now() - live.startedAt) / 60000;
  const suggested = elapsedMin >= step.dur && live.current < live.sequence.length - 1;
  const nudgeThreshold = Math.max(step.dur * 1.6, step.dur + 4);
  const nudge = elapsedMin >= nudgeThreshold;

  // Heure de départ recalculée : maintenant + somme des durées restantes (jusqu'à 'leave').
  const remaining = live.sequence.slice(live.current).reduce((a, s, i) => i === 0 ? a : a + s.dur, 0);
  const d = new Date();
  const nowMin = d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
  const projectedLeave = nowMin + remaining;
  // slip en minutes (positif = on glisse, négatif = on est en avance).
  // On compare modulo 24h, donc on borne l'écart.
  let slip = projectedLeave - live.leaveMin;
  if (slip > 720) slip -= 1440;
  if (slip < -720) slip += 1440;

  return { step, suggested, nudge, slip };
}

function confirmNext() {
  if (!live) return;
  const step = live.sequence[live.current];
  // R3 : mesure RÉELLE, jamais une durée théorique.
  const realDur = Math.max(1, Math.round((Date.now() - live.startedAt) / 60000));
  if (step.key !== 'leave') {
    live.measurements.push({ stepKey: step.key, v: realDur });
  }

  // Étape finale 'leave' : on bascule en feedback.
  if (live.current >= live.sequence.length - 1) {
    return endLive();
  }

  live.current += 1;
  live.startedAt = Date.now();
  live.nudged = false;
  audio.cue(live.sequence[live.current].key);
  renderLive();
}

function renderLive() {
  if (!live) return;
  const { step, suggested, nudge, slip } = liveStatus();
  const isLeave = step.key === 'leave';

  const slipMsg = slip > 2
    ? 'On a un peu glissé, ta marge absorbe, la suite est réajustée.'
    : slip < -2
      ? 'Tu prends de l\'avance, profite de ce temps pour toi.'
      : null;

  const next = live.sequence[live.current + 1];

  const screen = el('main', { class: 'screen' }, [
    el('p', { class: 'eyebrow' }, isLeave ? 'C\'est le moment' : 'Maintenant'),
    el('div', {
      class: 'card card-hi',
      style: 'display:flex; flex-direction:column; gap:6px; padding:28px 22px'
    }, [
      el('div', { style: 'font-size:64px; line-height:1' }, step.emoji || ''),
      el('h1', { class: 'display', style: 'font-size:36px; margin-top:8px' }, step.label),
      isLeave
        ? el('p', { class: 'lead', style: 'margin-top:8px' }, 'Prends ton sac, respire, en route.')
        : el('p', { class: 'lead', style: 'margin-top:8px' }, 'Prends ton temps. Quand c\'est fait, confirme.')
    ]),

    nudge && !isLeave
      ? el('div', { class: 'card' }, [
          el('p', { class: 'lead' }, 'Tu es toujours sur cette étape, c\'est ok. Quand tu as fini, un tap suffit.')
        ])
      : null,

    slipMsg ? el('p', { class: 'eyebrow', style: 'color:var(--text-mid)' }, slipMsg) : null,

    next && !isLeave
      ? el('p', { class: 'eyebrow' }, `Ensuite, ${next.emoji || ''} ${next.label}`)
      : null,

    el('div', { style: 'display:flex; flex-direction:column; gap:10px; margin-top:auto' }, [
      el('button', {
        class: 'btn ' + (suggested || isLeave ? 'btn-primary' : ''),
        onclick: confirmNext
      }, isLeave ? 'Je pars' : 'C\'est fait'),
      el('button', { class: 'btn btn-ghost', onclick: abortLive }, 'Quitter le guide')
    ])
  ]);
  // Layout flex pour que le bouton tombe en bas.
  screen.style.minHeight = '100dvh';
  render(screen);

  if (nudge && !live.nudged && !isLeave) {
    live.nudged = true;
    audio.cue('nudge');
  }
}

function endLive() {
  clearInterval(liveTicker); liveTicker = null;
  wake.release();
  const measurements = live.measurements;
  const ctx = live.ctx;
  live = null;
  showFeedback(measurements, ctx);
}

function abortLive() {
  clearInterval(liveTicker); liveTicker = null;
  wake.release();
  live = null;
  showHome();
}

// ---------- ÉCRAN FEEDBACK (R5) ----------

function showFeedback(measurements, ctx) {
  function pick(status, reply) {
    const state = loadState();
    onFeedback(state, status, measurements, ctx);
    saveState(state);
    toast(reply);
    setTimeout(() => showInsight(), 600);
  }

  const screen = el('main', { class: 'screen' }, [
    el('header', { class: 'home-header' }, [
      el('p', { class: 'eyebrow' }, 'Tu y es'),
      el('h1', { class: 'display' }, 'Comment c\'était ?')
    ]),
    el('div', { style: 'display:flex; flex-direction:column; gap:10px' }, [
      el('button', { class: 'btn', onclick: () => pick('early', 'Une vraie respiration, c\'est précieux.') }, 'En avance et tranquille'),
      el('button', { class: 'btn btn-primary', onclick: () => pick('ontime', 'Pile à l\'heure, bravo.') }, 'Pile à l\'heure'),
      el('button', { class: 'btn', onclick: () => pick('late', 'Ce n\'est rien, on ajuste pour la prochaine.') }, 'Un peu juste')
    ])
  ]);
  render(screen);
}

// ---------- ÉCRAN INSIGHT ----------

function showInsight() {
  const state = loadState();
  const last7 = state.history.slice(-7);
  const ontime = last7.filter((h) => h.status !== 'late').length;
  const ratio = last7.length ? Math.round((ontime / last7.length) * 100) : null;

  const learned = state.steps
    .filter((s) => s.active && s.real.length >= 2)
    .map((s) => {
      const mean = Math.round(s.real.reduce((a, r) => a + r.v, 0) / s.real.length);
      const variance = Math.round(Math.sqrt(s.real.reduce((a, r) => a + (r.v - mean) ** 2, 0) / s.real.length));
      return { ...s, mean, variance };
    });

  const screen = el('main', { class: 'screen' }, [
    el('header', { class: 'home-header' }, [
      el('p', { class: 'eyebrow' }, 'Doucement, ça apprend'),
      el('h1', { class: 'display' }, ratio == null ? 'Premiers pas' : `${ratio}% à l'heure`)
    ]),
    el('div', { class: 'card' }, [
      el('p', { class: 'eyebrow' }, 'Ce que j\'ai appris'),
      learned.length === 0
        ? el('p', { class: 'lead', style: 'margin-top:10px' }, 'Encore quelques départs et je te montrerai tes vraies durées.')
        : el('div', { style: 'display:flex; flex-direction:column; gap:10px; margin-top:10px' },
            learned.map((s) =>
              el('div', { style: 'display:flex; justify-content:space-between; align-items:center; gap:10px' }, [
                el('span', {}, `${s.emoji || ''} ${s.label}`),
                el('span', { class: 'pill' }, [
                  el('s', { style: 'color:var(--text-dim); margin-right:8px' }, `${s.est} min`),
                  el('span', {}, `${s.mean} min`),
                  s.variance > 2 ? el('span', { style: 'color:var(--text-mid); margin-left:6px' }, `±${s.variance}`) : null
                ].filter(Boolean))
              ])
            )
          )
    ]),
    el('p', { class: 'eyebrow', style: 'text-align:center' }, 'Tes données restent sur ton téléphone.'),
    el('button', { class: 'btn btn-primary', onclick: showHome }, 'Retour à l\'accueil')
  ]);
  render(screen);
}

// ---------- ÉCRAN ROUTINE ----------

function showRoutine() {
  const state = loadState();
  const r = state.routine || { arrival: '09:00', transport: 'walk', travel: 20, days: [1,2,3,4,5], evening: false };

  const data = { ...r };

  function save() {
    const next = loadState();
    next.routine = data;
    saveState(next);
    toast('Rituel enregistré.');
    showHome();
  }

  function clear() {
    const next = loadState();
    next.routine = null;
    saveState(next);
    toast('Rituel retiré.');
    showHome();
  }

  function render3() {
    const dayLabels = ['D','L','M','M','J','V','S'];
    const screen = el('main', { class: 'screen' }, [
      el('header', { class: 'home-header' }, [
        el('p', { class: 'eyebrow' }, 'Mon rituel'),
        el('h1', { class: 'display' }, 'Départ récurrent')
      ]),
      el('div', { class: 'card' }, [
        el('label', { class: 'eyebrow' }, 'Heure d\'arrivée'),
        el('input', {
          type: 'time', value: data.arrival,
          style: 'width:100%; margin-top:8px; background:transparent; color:var(--text); border:1px solid var(--border); border-radius:12px; padding:10px 12px; font-size:17px; font-family:inherit;',
          oninput: (e) => { data.arrival = e.target.value || '09:00'; }
        }),
        el('label', { class: 'eyebrow', style: 'display:block; margin-top:14px' }, 'Trajet (min)'),
        el('input', {
          type: 'number', min: '0', max: '180', value: String(data.travel),
          style: 'width:100%; margin-top:8px; background:transparent; color:var(--text); border:1px solid var(--border); border-radius:12px; padding:10px 12px; font-size:17px; font-family:inherit;',
          oninput: (e) => { data.travel = Number(e.target.value) || 0; }
        }),
        el('label', { class: 'eyebrow', style: 'display:block; margin-top:14px' }, 'Jours'),
        el('div', { style: 'display:flex; gap:6px; margin-top:8px; flex-wrap:wrap' },
          dayLabels.map((lab, i) => {
            const on = data.days.includes(i);
            return el('button', {
              class: 'pill',
              style: on ? 'background:var(--accent-dk); color:var(--text); border-color:var(--accent-md)' : '',
              onclick: () => {
                data.days = on ? data.days.filter((d) => d !== i) : [...data.days, i].sort();
                render3();
              }
            }, lab);
          })
        )
      ]),
      el('div', { style: 'display:flex; flex-direction:column; gap:10px' }, [
        el('button', { class: 'btn btn-primary', onclick: save }, 'Enregistrer'),
        state.routine ? el('button', { class: 'btn btn-ghost', onclick: clear }, 'Retirer le rituel') : null,
        el('button', { class: 'btn btn-ghost', onclick: showHome }, 'Retour')
      ].filter(Boolean))
    ]);
    render(screen);
  }

  render3();
}

// ---------- ÉCRAN SOCIAL (maquette) ----------

function showSocial() {
  const screen = el('main', { class: 'screen' }, [
    el('header', { class: 'home-header' }, [
      el('p', { class: 'eyebrow' }, 'Mes proches'),
      el('h1', { class: 'display' }, 'Bientôt avec toi')
    ]),
    el('div', { class: 'card', style: 'border-color:var(--amber); background:rgba(232,178,92,0.08)' }, [
      el('p', { class: 'eyebrow', style: 'color:var(--amber)' }, 'Maquette'),
      el('p', { class: 'lead', style: 'margin-top:6px' }, 'Cette fonction est conçue mais pas encore active. Tes proches ne reçoivent rien aujourd\'hui.')
    ]),
    el('div', { class: 'card card-hi' }, [
      el('p', { class: 'eyebrow' }, 'La promesse'),
      el('p', { class: 'lead', style: 'margin-top:6px' }, 'Tes proches ne reçoivent que des signaux positifs que tu choisis. Jamais de retard, jamais de position. Le social célèbre, il ne surveille pas.')
    ]),
    el('div', { class: 'card' }, [
      el('p', { class: 'eyebrow' }, 'Aperçu'),
      el('div', { style: 'display:flex; flex-direction:column; gap:8px; margin-top:10px' }, [
        el('p', { class: 'lead' }, '✨ Camille est en route, sereine.'),
        el('p', { class: 'lead' }, '☀️ Léo a pris une douce avance ce matin.')
      ])
    ]),
    el('button', { class: 'btn btn-ghost', onclick: showHome }, 'Retour')
  ]);
  render(screen);
}

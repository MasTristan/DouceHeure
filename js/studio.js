// Le Studio v2 : compositeur de départs (spec v2 §14).
// Toute la logique et le rendu du Studio sont isolés ici.

import { loadState, saveState, ARCHETYPES, makeProfileFromArchetype, makeChecklist, MAX_PROFILES, MAX_STEPS } from './store.js';
import { buildPlan, TRANSPORT_BUFFER } from './plan.js';
import { addDestination } from './travel.js';
import { fromMin } from './time.js';
import { icon, STEP_ICON_CHOICES, TRANSPORT_ICONS } from './icons.js';
import * as haptics from './haptics.js';
import { UI } from './copy.js';

// --- Helper DOM ---

function el(tag, attrs = {}, children = []) {
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

// --- État du Studio ---

let studioState = null;
let studioActiveId = null;

function activeProfile() {
  return studioState.profiles.find((p) => p.id === studioActiveId);
}

function autosave() {
  saveState(studioState);
}

// --- Logique pure (exportée pour clarté et réutilisation) ---

export function createStep(iconName, label, dur) {
  return {
    key: `free-${Date.now()}`,
    label,
    icon: iconName,
    emoji: null,
    est: Math.max(2, dur),
    active: true,
    fixed: false,
    kind: 'comfort',
    real: [],
  };
}

export function reorderSteps(steps, fromIdx, toIdx) {
  const next = [...steps];
  const last = next.length - 1;
  // Le réveil reste premier, l'étape finale reste dernière.
  const clampedTo = Math.max(1, Math.min(last - 1, toIdx));
  const [moved] = next.splice(fromIdx, 1);
  next.splice(clampedTo, 0, moved);
  return next;
}

// --- Drag and drop (touch + mouse) ---

let drag = null;

function initDrag(cardEl, idx, listEl) {
  function onStart(clientY) {
    const rect = cardEl.closest('.studio-step').getBoundingClientRect();
    const card = cardEl.closest('.studio-step');
    const clone = card.cloneNode(true);
    clone.style.cssText = `
      position: fixed; left: ${rect.left}px; top: ${rect.top}px;
      width: ${rect.width}px; opacity: 0.9;
      transform: scale(1.02); z-index: 999;
      pointer-events: none; transition: none;
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-amber), 0 12px 40px rgba(0,0,0,0.45);
    `;
    document.body.appendChild(clone);
    card.style.opacity = '0.35';
    haptics.buzz('tap'); // lift
    drag = { idx, offsetY: clientY - rect.top, clone, card, listEl, dropIdx: idx };
  }

  function onMove(clientY) {
    if (!drag) return;
    drag.clone.style.top = (clientY - drag.offsetY) + 'px';
    const cards = drag.listEl.querySelectorAll('.studio-step');
    let found = false;
    for (let i = 0; i < cards.length; i++) {
      const r = cards[i].getBoundingClientRect();
      if (clientY < r.top + r.height / 2) {
        drag.dropIdx = i;
        found = true;
        break;
      }
    }
    if (!found) drag.dropIdx = cards.length - 1;
    const profile = activeProfile();
    if (profile) {
      const last = profile.steps.length - 1;
      drag.dropIdx = Math.max(1, Math.min(last - 1, drag.dropIdx));
    }
    cards.forEach((c, i) => {
      c.classList.toggle('drag-target', i === drag.dropIdx && i !== drag.idx);
    });
  }

  function onEnd() {
    if (!drag) return;
    drag.clone.remove();
    drag.card.style.opacity = '1';
    const { listEl, dropIdx } = drag;
    const fromIdx = drag.idx;
    drag = null;
    listEl.querySelectorAll('.studio-step').forEach((c) => c.classList.remove('drag-target'));
    if (fromIdx !== dropIdx) {
      haptics.buzz('tap'); // drop
      const profile = activeProfile();
      profile.steps = reorderSteps(profile.steps, fromIdx, dropIdx);
      autosave();
      renderStudio();
    }
  }

  cardEl.addEventListener('touchstart', (e) => {
    onStart(e.touches[0].clientY);
  }, { passive: true });
  document.addEventListener('touchmove', (e) => {
    if (drag) { e.preventDefault(); onMove(e.touches[0].clientY); }
  }, { passive: false });
  document.addEventListener('touchend', () => { if (drag) onEnd(); }, { passive: true });

  cardEl.addEventListener('mousedown', (e) => {
    e.preventDefault();
    onStart(e.clientY);
    const mm = (ev) => onMove(ev.clientY);
    const mu = () => { onEnd(); document.removeEventListener('mousemove', mm); document.removeEventListener('mouseup', mu); };
    document.addEventListener('mousemove', mm);
    document.addEventListener('mouseup', mu);
  });
}

// --- Picker d'icône ---

function buildIconPicker(anchorEl, onPick) {
  const existing = document.querySelector('.emoji-picker');
  if (existing) { existing.remove(); return; }

  const grid = el('div', { class: 'emoji-picker__grid', role: 'grid' },
    STEP_ICON_CHOICES.map((name) =>
      el('button', {
        class: 'emoji-picker__item',
        'aria-label': name,
        onclick: () => { picker.remove(); onPick(name); },
      }, icon(name))
    )
  );

  const picker = el('div', {
    class: 'emoji-picker', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Choisir une icône',
  }, [
    grid,
    el('button', { class: 'emoji-picker__close', onclick: () => picker.remove() }, 'Fermer'),
  ]);

  const rect = anchorEl.getBoundingClientRect();
  picker.style.cssText = `position: fixed; top: ${Math.min(rect.bottom + 6, innerHeight - 260)}px; left: ${Math.min(rect.left, innerWidth - 280)}px; z-index: 300;`;
  document.body.appendChild(picker);

  setTimeout(() => {
    document.addEventListener('click', function outside(ev) {
      if (!picker.contains(ev.target)) {
        picker.remove();
        document.removeEventListener('click', outside);
      }
    });
  }, 0);
}

// --- Modal "Ajouter une étape" ---

function openAddStepModal() {
  const existing = document.querySelector('.studio-modal');
  if (existing) existing.remove();

  let newIcon = 'star';
  let newLabel = '';
  let newDur = 10;

  const iconBtn = el('button', {
    class: 'add-step-emoji-btn',
    'aria-label': 'Choisir une icône',
    onclick: (e) => {
      e.stopPropagation();
      buildIconPicker(iconBtn, (chosen) => {
        newIcon = chosen;
        iconBtn.replaceChildren(icon(chosen, 'icon--lg'));
      });
    },
  }, icon(newIcon, 'icon--lg'));

  const labelInput = el('input', {
    class: 'text-input', type: 'text', placeholder: 'Nom de l\'étape',
    maxlength: '32', 'aria-label': 'Nom de l\'étape',
    oninput: (e) => {
      newLabel = e.target.value;
      addBtn.disabled = newLabel.trim().length === 0;
    },
  });

  const durValue = el('div', { class: 'add-step-dur-value' }, newDur + ' min');
  const durInput = el('input', {
    class: 'dur-slider', type: 'range', min: '2', max: '45', step: '1',
    value: String(newDur), 'aria-label': 'Durée en minutes',
    oninput: (e) => {
      const v = Number(e.target.value);
      if (v !== newDur) haptics.buzz('crank');
      newDur = v;
      durValue.textContent = newDur + ' min';
    },
  });

  const addBtn = el('button', {
    class: 'btn btn--primary', disabled: true,
    onclick: () => {
      if (!newLabel.trim()) return;
      const profile = activeProfile();
      if (!profile || profile.steps.length >= MAX_STEPS) return;
      const step = createStep(newIcon, newLabel.trim(), newDur);
      profile.steps.splice(profile.steps.length - 1, 0, step);
      autosave();
      modal.remove();
      renderStudio();
    },
  }, 'Ajouter');

  const modal = el('div', { class: 'studio-modal' }, [
    el('div', { class: 'studio-modal__sheet' }, [
      el('div', { class: 'studio-modal__handle' }),
      el('div', { class: 't-label', style: 'margin-bottom: 16px' }, 'Nouvelle étape'),
      el('div', { class: 'add-step-row' }, [iconBtn, labelInput]),
      el('div', { class: 'spacer-md' }),
      el('div', { class: 'add-step-dur-row' }, [
        el('div', { class: 't-label' }, 'Durée'),
        durValue,
      ]),
      el('div', { class: 'spacer-sm' }),
      durInput,
      el('div', { class: 'spacer-md' }),
      addBtn,
      el('div', { class: 'spacer-sm' }),
      el('button', { class: 'btn btn--ghost', onclick: () => modal.remove() }, 'Annuler'),
    ]),
  ]);

  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
  setTimeout(() => labelInput.focus(), 100);
}

// --- Choix d'archétype pour un nouveau départ ---

function openArchetypeModal() {
  const existing = document.querySelector('.studio-modal');
  if (existing) existing.remove();

  const modal = el('div', { class: 'studio-modal' }, [
    el('div', { class: 'studio-modal__sheet' }, [
      el('div', { class: 'studio-modal__handle' }),
      el('div', { class: 't-label', style: 'margin-bottom: 16px' }, UI.studio_archetype_title),
      el('div', { style: 'display:flex; flex-direction:column; gap:10px' },
        ARCHETYPES.map((arch) =>
          el('button', {
            class: 'archetype-card',
            onclick: () => {
              const profile = makeProfileFromArchetype(arch);
              studioState.profiles.push(profile);
              studioActiveId = profile.id;
              autosave();
              modal.remove();
              renderStudio();
            },
          }, [
            icon(arch.icon, 'icon--lg'),
            el('div', {}, [
              el('div', { class: 'feedback-option__label' }, arch.name),
              el('div', { class: 't-body t-body--sm' }, `${arch.stepKeys.length} étapes · ${arch.checklist.length} objets`),
            ]),
          ])
        )
      ),
      el('div', { class: 'spacer-md' }),
      el('button', { class: 'btn btn--ghost', onclick: () => modal.remove() }, 'Annuler'),
    ]),
  ]);

  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

// --- Sheet d'aperçu du plan : timeline en métaphore lumière ---

function openPreviewSheet() {
  const existing = document.querySelector('.studio-modal');
  if (existing) existing.remove();

  const profile = activeProfile();
  if (!profile) return;

  const arrival = profile.defaults.arrival || '09:00';
  const transport = profile.defaults.transport || 'walk';
  const ctx = { day: 1, type: 'work' };
  const plan = buildPlan(profile.steps, arrival, 20, transport, studioState.latenessScore, ctx);

  const n = plan.sequence.length;
  const items = plan.sequence.map((s, i) => {
    const isLeave = s.key === 'leave';
    // Du début en pénombre à la fin éclairée.
    const lum = 0.35 + (i / Math.max(1, n - 1)) * 0.65;
    return el('div', {
      class: 'timeline-item' + (isLeave ? ' timeline-item--leave' : ''),
      style: `opacity: ${lum.toFixed(2)}`,
    }, [
      el('div', { class: 'timeline-item__time' }, fromMin(s.at)),
      el('div', { class: 'timeline-item__emoji' }, s.emoji ? s.emoji : icon(s.icon)),
      el('div', { class: 'timeline-item__label' }, s.label),
    ]);
  });

  const modal = el('div', { class: 'studio-modal' }, [
    el('div', { class: 'studio-modal__sheet' }, [
      el('div', { class: 'studio-modal__handle' }),
      el('div', { class: 't-label', style: 'margin-bottom: 16px' }, UI.studio_preview),
      el('div', { style: 'display:flex; flex-direction:column; gap:8px' }, items),
      el('div', { class: 'spacer-md' }),
      el('button', { class: 'btn btn--ghost', onclick: () => modal.remove() }, 'Fermer'),
    ]),
  ]);

  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

// --- Carte d'étape ---

function buildStepCard(step, idx, profile, listEl) {
  const isDraggable = !step.fixed;

  const handle = isDraggable
    ? el('div', { class: 'studio-step__handle', 'aria-label': 'Glisser pour réordonner', role: 'img' }, [
        el('div', { class: 'studio-step__dots' }),
      ])
    : el('div', { class: 'studio-step__handle studio-step__handle--fixed' });

  const iconEl = step.fixed
    ? el('div', { class: 'studio-step__emoji studio-step__emoji--fixed' }, step.emoji ? step.emoji : icon(step.icon))
    : el('button', {
        class: 'studio-step__emoji',
        'aria-label': `Changer l'icône de ${step.label}`,
        onclick: (e) => buildIconPicker(e.currentTarget, (chosen) => {
          step.icon = chosen;
          step.emoji = null;
          autosave();
          renderStudio();
        }),
      }, step.emoji ? step.emoji : icon(step.icon));

  const labelEl = step.fixed
    ? el('div', { class: 'studio-step__label studio-step__label--fixed' }, step.label)
    : el('button', {
        class: 'studio-step__label',
        'aria-label': `Modifier le nom : ${step.label}`,
        onclick: (e) => startInlineEdit(e.currentTarget, step),
      }, step.label);

  // Pill essentiel / confort (F3).
  const kindPill = el('button', {
    class: 'kind-pill' + (step.kind === 'core' ? ' is-core' : ''),
    'aria-label': `${step.label} : ${step.kind === 'core' ? UI.studio_core : UI.studio_comfort}`,
    onclick: () => {
      step.kind = step.kind === 'core' ? 'comfort' : 'core';
      haptics.buzz('tap');
      autosave();
      renderStudio();
    },
  }, step.kind === 'core' ? UI.studio_core : UI.studio_comfort);

  // Durée : slider à crans de 1 min (estimation de configuration,
  // autorisée hors session).
  const durValue = el('span', { class: 'studio-step__dur' }, step.est + ' min');
  const durSlider = el('input', {
    class: 'dur-slider dur-slider--sm', type: 'range',
    min: '2', max: '60', step: '1', value: String(step.est),
    'aria-label': `Durée de ${step.label} en minutes`,
    oninput: (e) => {
      const v = Number(e.target.value);
      if (v !== step.est) haptics.buzz('crank');
      step.est = v;
      durValue.textContent = v + ' min';
    },
    onchange: () => { autosave(); },
  });

  const deleteBtn = !step.fixed
    ? el('button', {
        class: 'studio-step__delete',
        'aria-label': `Supprimer l'étape ${step.label}`,
        onclick: () => {
          profile.steps = profile.steps.filter((s) => s.key !== step.key);
          autosave();
          renderStudio();
        },
      }, '×')
    : null;

  const toggleActive = el('button', {
    class: 'toggle ' + (step.active ? 'is-on' : 'is-off'),
    role: 'switch',
    'aria-checked': step.active ? 'true' : 'false',
    'aria-label': `Activer ${step.label}`,
    onclick: () => {
      if (step.fixed) return;
      step.active = !step.active;
      autosave();
      renderStudio();
    },
  }, [el('span', { class: 'toggle__thumb' })]);

  const card = el('div', {
    class: 'studio-step' + (step.fixed ? ' studio-step--fixed' : '') + (!step.active ? ' is-inactive' : ''),
    'data-key': step.key,
  }, [
    el('div', { class: 'studio-step__row' }, [
      handle,
      iconEl,
      labelEl,
      kindPill,
      step.fixed ? null : toggleActive,
      deleteBtn,
    ]),
    el('div', { class: 'studio-step__row studio-step__row--dur' }, [
      durSlider,
      durValue,
    ]),
  ]);

  if (isDraggable) initDrag(handle, idx, listEl);
  return card;
}

function startInlineEdit(labelBtn, step) {
  const original = step.label;
  const input = el('input', {
    class: 'studio-step__label-input', type: 'text', value: original,
    maxlength: '32', 'aria-label': 'Nom de l\'étape',
  });

  function confirmEdit() {
    step.label = input.value.trim().slice(0, 32) || original;
    autosave();
    renderStudio();
  }

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); confirmEdit(); }
    if (e.key === 'Escape') renderStudio();
  });
  input.addEventListener('blur', confirmEdit);

  labelBtn.replaceWith(input);
  input.focus();
  input.select();
}

// --- Checklist du profil ---

function buildChecklistCard(profile) {
  const items = (profile.checklist || []).map((item, i) =>
    el('div', { class: 'studio-checklist-item' }, [
      el('span', { class: 't-body', style: 'flex:1; color: var(--text)' }, item.label),
      i > 0 ? el('button', {
        class: 'studio-step__kbmove', 'aria-label': `Monter ${item.label}`,
        onclick: () => {
          [profile.checklist[i - 1], profile.checklist[i]] = [profile.checklist[i], profile.checklist[i - 1]];
          autosave();
          renderStudio();
        },
      }, '↑') : null,
      i < profile.checklist.length - 1 ? el('button', {
        class: 'studio-step__kbmove', 'aria-label': `Descendre ${item.label}`,
        onclick: () => {
          [profile.checklist[i + 1], profile.checklist[i]] = [profile.checklist[i], profile.checklist[i + 1]];
          autosave();
          renderStudio();
        },
      }, '↓') : null,
      el('button', {
        class: 'studio-step__delete', 'aria-label': `Supprimer ${item.label}`,
        onclick: () => {
          profile.checklist.splice(i, 1);
          autosave();
          renderStudio();
        },
      }, '×'),
    ])
  );

  const input = el('input', {
    class: 'text-input', type: 'text',
    placeholder: UI.studio_checklist_placeholder, maxlength: '32',
  });

  return el('div', { class: 'card' }, [
    el('div', { class: 't-label' }, UI.studio_checklist_label),
    el('div', { class: 'spacer-sm' }),
    ...items,
    el('div', { class: 'spacer-sm' }),
    el('div', { style: 'display:flex; gap:8px' }, [
      input,
      el('button', {
        class: 'btn btn--soft', style: 'flex-shrink:0',
        onclick: () => {
          const label = input.value.trim();
          if (!label) return;
          profile.checklist = profile.checklist || [];
          profile.checklist.push(makeChecklist([label])[0]);
          autosave();
          renderStudio();
        },
      }, '+'),
    ]),
  ]);
}

// --- Défauts du profil : arrivée, transport, destination ---

function buildDefaultsCard(profile) {
  return el('div', { class: 'card' }, [
    el('div', { class: 't-label' }, UI.studio_defaults_label),
    el('div', { class: 'spacer-sm' }),
    el('div', { class: 't-label', style: 'font-size:10px' }, UI.studio_default_arrival),
    el('div', { class: 'spacer-sm' }),
    el('input', {
      class: 'time-input', type: 'time', value: profile.defaults.arrival || '',
      onchange: (e) => {
        profile.defaults.arrival = e.target.value || null;
        autosave();
      },
    }),
    el('div', { class: 'spacer-md' }),
    el('div', { class: 't-label', style: 'font-size:10px' }, UI.studio_default_transport),
    el('div', { class: 'spacer-sm' }),
    el('div', { style: 'display:flex; gap:8px; flex-wrap:wrap' },
      Object.keys(TRANSPORT_BUFFER).map((k) =>
        el('button', {
          class: 'pill' + (profile.defaults.transport === k ? ' is-on' : ''),
          onclick: () => {
            profile.defaults.transport = k;
            autosave();
            renderStudio();
          },
        }, [icon(TRANSPORT_ICONS[k]), el('span', {}, UI['transport_' + k])])
      )
    ),
    el('div', { class: 'spacer-md' }),
    el('div', { class: 't-label', style: 'font-size:10px' }, UI.studio_default_destination),
    el('div', { class: 'spacer-sm' }),
    el('div', { style: 'display:flex; gap:8px; flex-wrap:wrap' }, [
      el('button', {
        class: 'pill' + (!profile.defaults.destinationId ? ' is-on' : ''),
        onclick: () => { profile.defaults.destinationId = null; autosave(); renderStudio(); },
      }, UI.preview_destination_none),
      ...studioState.destinations.map((d) =>
        el('button', {
          class: 'pill' + (profile.defaults.destinationId === d.id ? ' is-on' : ''),
          onclick: () => { profile.defaults.destinationId = d.id; autosave(); renderStudio(); },
        }, d.label)
      ),
      el('button', {
        class: 'pill',
        onclick: () => {
          const label = prompt(UI.preview_destination_prompt);
          if (!label || !label.trim()) return;
          const dest = addDestination(studioState, label);
          profile.defaults.destinationId = dest.id;
          autosave();
          renderStudio();
        },
      }, UI.preview_destination_add),
    ]),
  ]);
}

// --- Rendu principal du Studio ---

function renderStudio() {
  const profile = activeProfile();
  if (!profile) return;

  const steps = profile.steps;
  const canAddStep = steps.length < MAX_STEPS;
  const canAddProfile = studioState.profiles.length < MAX_PROFILES;

  const pills = [
    ...studioState.profiles.map((p) =>
      el('button', {
        class: 'pill' + (p.id === studioActiveId ? ' is-on' : ''),
        onclick: () => { studioActiveId = p.id; renderStudio(); },
      }, [icon(p.icon), el('span', {}, p.name)])
    ),
    canAddProfile
      ? el('button', {
          class: 'pill studio-add-profile',
          'aria-label': 'Ajouter un départ',
          onclick: openArchetypeModal,
        }, UI.studio_add_profile)
      : null,
  ].filter(Boolean);

  const listEl = el('div', { class: 'studio-step-list' });
  steps.forEach((step, idx) => {
    listEl.appendChild(buildStepCard(step, idx, profile, listEl));
  });

  const addStepEl = canAddStep
    ? el('button', { class: 'studio-add-step', onclick: openAddStepModal }, [
        el('span', { class: 'studio-add-step__icon' }, '+'),
        el('span', {}, UI.studio_add_step),
      ])
    : el('div', { class: 'studio-add-step studio-add-step--disabled' }, [
        el('span', {}, UI.studio_max_steps),
      ]);

  const deleteProfileBtn = studioState.profiles.length > 1
    ? el('button', {
        class: 'btn btn--ghost', style: 'font-size:13px; opacity:0.7',
        onclick: () => {
          if (!confirm(`${UI.studio_delete_profile} ?`)) return;
          studioState.profiles = studioState.profiles.filter((p) => p.id !== studioActiveId);
          studioActiveId = studioState.profiles[0].id;
          if (studioState.activeProfileId !== studioActiveId
            && !studioState.profiles.find((p) => p.id === studioState.activeProfileId)) {
            studioState.activeProfileId = studioActiveId;
          }
          autosave();
          renderStudio();
        },
      }, UI.studio_delete_profile)
    : null;

  const screen = el('main', { class: 'screen screen--studio stagger' }, [
    el('div', { class: 'studio-topbar' }, [
      el('div', { class: 'wordmark' }, [
        el('span', { class: 'wordmark__dot' }),
        el('span', { class: 'wordmark__name' }, UI.wordmark),
      ]),
      el('button', {
        class: 'studio-back-btn', onclick: leaveStudio, 'aria-label': 'Retour',
      }, '← ' + UI.studio_back),
    ]),

    el('div', { class: 'spacer-md' }),
    el('div', { class: 't-label' }, UI.studio_label),
    el('div', { class: 'spacer-sm' }),
    el('h1', { class: 't-display' }, UI.studio_title),
    el('p', { class: 't-body', style: 'margin-top: 10px' }, UI.studio_body),

    el('div', { class: 'spacer-md' }),
    el('div', { class: 't-label' }, UI.studio_profiles_label),
    el('div', { class: 'spacer-sm' }),
    el('div', { class: 'studio-profile-pills' }, pills),

    el('div', { class: 'spacer-md' }),
    el('div', { class: 't-label' }, UI.studio_steps_label(steps.length)),
    el('div', { class: 'spacer-sm' }),
    listEl,

    el('div', { class: 'spacer-sm' }),
    addStepEl,

    el('div', { class: 'spacer-md' }),
    buildChecklistCard(profile),

    el('div', { class: 'spacer-md' }),
    buildDefaultsCard(profile),

    el('div', { class: 'spacer-md' }),
    el('button', { class: 'btn btn--soft', onclick: openPreviewSheet }, UI.studio_preview),

    el('div', { class: 'spacer-sm' }),
    deleteProfileBtn,
  ]);

  const root = document.getElementById('app');
  if (!root) return;
  if (root.dataset.screen !== 'studio') {
    screen.classList.add('screen--studio-enter');
    root.dataset.screen = 'studio';
  }
  root.replaceChildren(screen);
}

// --- Navigation ---

function leaveStudio() {
  document.body.classList.remove('in-studio');
  const root = document.getElementById('app');
  if (root) delete root.dataset.screen;
  import('./ui.js').then((m) => m.showHome());
}

// --- Point d'entrée ---

export function showStudio() {
  studioState = loadState();
  studioActiveId = studioState.activeProfileId;
  document.body.classList.add('in-studio');
  renderStudio();
}

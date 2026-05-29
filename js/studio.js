// Le Studio : compositeur de routine.
// Toute la logique et le rendu du Studio sont isolés ici.

import { loadState, saveState } from './store.js';
import { buildPlan } from './plan.js';
import { fromMin } from './time.js';

// --- Helper DOM ---

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

// --- Constantes ---

const MAX_PROFILES = 3;
const MAX_STEPS = 8;
const EMOJI_SUGGESTIONS = [
  '🧘','🐱','🐶','🪴','📚','🎵','💊','🧃','🥗','🧴',
  '🏃','🚴','✏️','🎨','🧹','💻','📱','🪞','🛁','☕',
  '🍳','🥐','🫖','🧺','👟','🎯','🌿','🕯️','🎸','🌅'
];

const PROFILE_PRESETS = [
  { name: 'Routine complète', emoji: '✨' },
  { name: 'Routine rapide',   emoji: '⚡' },
  { name: 'Routine du weekend', emoji: '🌸' },
];

// --- État du Studio ---

let studioProfiles = [];
let studioActiveId = null;
let openPickerStepKey = null;

// --- API ---

export function loadProfiles() {
  const state = loadState();
  return { profiles: state.profiles || [], activeId: state.activeProfileId || 'default' };
}

export function saveProfiles(profiles, activeId) {
  const state = loadState();
  state.profiles = profiles;
  state.activeProfileId = activeId;
  saveState(state);
}

export function createStep(emoji, label, dur) {
  return {
    key: `free-${Date.now()}`,
    label,
    emoji,
    est: Math.max(2, dur),
    active: true,
    fixed: false,
    real: [],
  };
}

export function reorderSteps(profiles, activeId, fromIdx, toIdx) {
  const profile = profiles.find((p) => p.id === activeId);
  if (!profile) return profiles;
  const steps = [...profile.steps];
  const last = steps.length - 1;
  // Constrain so fixed wakeup stays first and ready stays last.
  const clampedTo = Math.max(1, Math.min(last - 1, toIdx));
  const [moved] = steps.splice(fromIdx, 1);
  steps.splice(clampedTo, 0, moved);
  profile.steps = steps;
  return [...profiles];
}

export function addStep(profiles, activeId, step) {
  const profile = profiles.find((p) => p.id === activeId);
  if (!profile) return profiles;
  // Insert before the last fixed step (ready).
  const lastFixed = profile.steps.length - 1;
  profile.steps.splice(lastFixed, 0, step);
  return [...profiles];
}

export function removeStep(profiles, activeId, stepKey) {
  const profile = profiles.find((p) => p.id === activeId);
  if (!profile) return profiles;
  const step = profile.steps.find((s) => s.key === stepKey);
  if (!step || step.fixed) return profiles;
  profile.steps = profile.steps.filter((s) => s.key !== stepKey);
  return [...profiles];
}

export function setDuration(profiles, activeId, stepKey, delta) {
  const profile = profiles.find((p) => p.id === activeId);
  if (!profile) return profiles;
  const step = profile.steps.find((s) => s.key === stepKey);
  if (!step) return profiles;
  step.est = Math.max(2, step.est + delta);
  return [...profiles];
}

export function renameStep(profiles, activeId, stepKey, label) {
  const profile = profiles.find((p) => p.id === activeId);
  if (!profile) return profiles;
  const step = profile.steps.find((s) => s.key === stepKey);
  if (!step || step.fixed) return profiles;
  step.label = label.trim().slice(0, 32) || step.label;
  return [...profiles];
}

export function setEmoji(profiles, activeId, stepKey, emoji) {
  const profile = profiles.find((p) => p.id === activeId);
  if (!profile) return profiles;
  const step = profile.steps.find((s) => s.key === stepKey);
  if (!step || step.fixed) return profiles;
  step.emoji = emoji;
  return [...profiles];
}

// --- Sauvegarde automatique ---

function autosave() {
  saveProfiles(studioProfiles, studioActiveId);
}

// --- Drag and drop (touch + mouse) ---

let drag = null;

function initDrag(cardEl, idx, listEl) {
  function onStart(clientY) {
    const rect = cardEl.getBoundingClientRect();
    const clone = cardEl.cloneNode(true);
    clone.style.cssText = `
      position: fixed; left: ${rect.left}px; top: ${rect.top}px;
      width: ${rect.width}px; opacity: 0.88;
      transform: scale(1.02); z-index: 999;
      pointer-events: none; transition: none;
      border-radius: var(--radius-lg);
      box-shadow: 0 12px 40px rgba(0,0,0,0.5);
    `;
    document.body.appendChild(clone);
    cardEl.style.opacity = '0.35';
    drag = {
      idx,
      startY: clientY,
      offsetY: clientY - rect.top,
      clone,
      card: cardEl,
      listEl,
      dropIdx: idx,
    };
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
    // Constrain to non-fixed slots (1 .. length-2).
    const profile = studioProfiles.find((p) => p.id === studioActiveId);
    if (profile) {
      const last = profile.steps.length - 1;
      drag.dropIdx = Math.max(1, Math.min(last - 1, drag.dropIdx));
    }
    // Visual indicator on cards.
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
      studioProfiles = reorderSteps(studioProfiles, studioActiveId, fromIdx, dropIdx);
      autosave();
      renderStudio();
    }
  }

  // Touch events (iOS).
  cardEl.addEventListener('touchstart', (e) => {
    onStart(e.touches[0].clientY);
  }, { passive: true });
  document.addEventListener('touchmove', (e) => {
    if (drag) { e.preventDefault(); onMove(e.touches[0].clientY); }
  }, { passive: false });
  document.addEventListener('touchend', () => { if (drag) onEnd(); }, { passive: true });

  // Mouse events (desktop).
  cardEl.addEventListener('mousedown', (e) => {
    e.preventDefault();
    onStart(e.clientY);
    const mm = (ev) => onMove(ev.clientY);
    const mu = () => { onEnd(); document.removeEventListener('mousemove', mm); document.removeEventListener('mouseup', mu); };
    document.addEventListener('mousemove', mm);
    document.addEventListener('mouseup', mu);
  });
}

// --- Emoji picker ---

function buildEmojiPicker(stepKey, anchorEl) {
  const existing = document.querySelector('.emoji-picker');
  if (existing) existing.remove();
  if (openPickerStepKey === stepKey) {
    openPickerStepKey = null;
    return;
  }
  openPickerStepKey = stepKey;

  const grid = el('div', { class: 'emoji-picker__grid', role: 'grid' },
    EMOJI_SUGGESTIONS.map((e) =>
      el('button', {
        class: 'emoji-picker__item',
        'aria-label': e,
        onclick: () => {
          studioProfiles = setEmoji(studioProfiles, studioActiveId, stepKey, e);
          autosave();
          openPickerStepKey = null;
          renderStudio();
        },
      }, e)
    )
  );

  const picker = el('div', {
    class: 'emoji-picker',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': 'Choisir un emoji',
  }, [
    grid,
    el('button', { class: 'emoji-picker__close', onclick: () => { picker.remove(); openPickerStepKey = null; } }, 'Fermer'),
  ]);

  // Position below anchor.
  const rect = anchorEl.getBoundingClientRect();
  picker.style.cssText = `position: fixed; top: ${rect.bottom + 6}px; left: ${rect.left}px; z-index: 200;`;
  document.body.appendChild(picker);

  // Close on outside tap.
  setTimeout(() => {
    document.addEventListener('click', function outside(ev) {
      if (!picker.contains(ev.target)) {
        picker.remove();
        openPickerStepKey = null;
        document.removeEventListener('click', outside);
      }
    });
  }, 0);
}

// --- Modal "Ajouter une étape" ---

function openAddStepModal() {
  const existing = document.querySelector('.studio-modal');
  if (existing) existing.remove();

  let newEmoji = '✏️';
  let newLabel = '';
  let newDur = 10;

  function rebuild() {
    modal.querySelector('.add-step-preview-emoji').textContent = newEmoji;
    modal.querySelector('.add-step-label-input').value = newLabel;
    modal.querySelector('.add-step-dur-value').textContent = newDur + ' min';
    modal.querySelector('.add-step-dur-input').value = String(newDur);
    const addBtn = modal.querySelector('.add-step-submit');
    addBtn.disabled = newLabel.trim().length === 0;
    addBtn.style.opacity = newLabel.trim().length === 0 ? '0.4' : '1';
  }

  const emojiBtn = el('button', {
    class: 'add-step-emoji-btn',
    'aria-label': 'Choisir un emoji',
    onclick: (e) => {
      e.stopPropagation();
      buildAddModalEmojiPicker(emojiBtn, (chosen) => {
        newEmoji = chosen;
        rebuild();
      });
    },
  }, newEmoji);

  const labelInput = el('input', {
    class: 'text-input add-step-label-input',
    type: 'text',
    placeholder: 'Nom de l\'étape',
    maxlength: '32',
    'aria-label': 'Nom de l\'étape',
    oninput: (e) => { newLabel = e.target.value; rebuild(); },
  });

  const durInput = el('input', {
    class: 'add-step-dur-input',
    type: 'range',
    min: '2',
    max: '45',
    value: String(newDur),
    'aria-label': 'Durée en minutes',
    oninput: (e) => { newDur = Number(e.target.value); rebuild(); },
  });

  const addBtn = el('button', {
    class: 'btn btn--primary add-step-submit',
    disabled: true,
    onclick: () => {
      if (!newLabel.trim()) return;
      const profile = studioProfiles.find((p) => p.id === studioActiveId);
      if (profile && profile.steps.length >= MAX_STEPS) return;
      const step = createStep(newEmoji, newLabel.trim(), newDur);
      studioProfiles = addStep(studioProfiles, studioActiveId, step);
      autosave();
      modal.remove();
      renderStudio();
    },
  }, 'Ajouter à ma routine');

  const modal = el('div', { class: 'studio-modal' }, [
    el('div', { class: 'studio-modal__sheet' }, [
      el('div', { class: 'studio-modal__handle' }),
      el('div', { class: 't-label', style: 'margin-bottom: 16px' }, 'Nouvelle étape'),
      el('div', { class: 'add-step-row' }, [
        el('div', { class: 'add-step-preview-emoji' }, newEmoji),
        emojiBtn,
        labelInput,
      ]),
      el('div', { class: 'spacer-md' }),
      el('div', { class: 'add-step-dur-row' }, [
        el('div', { class: 't-label' }, 'Durée'),
        el('div', { class: 'add-step-dur-value' }, newDur + ' min'),
      ]),
      el('div', { class: 'spacer-sm' }),
      durInput,
      el('div', { class: 'spacer-md' }),
      addBtn,
      el('div', { class: 'spacer-sm' }),
      el('button', {
        class: 'btn btn--ghost',
        onclick: () => modal.remove(),
      }, 'Annuler'),
    ]),
  ]);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });

  document.body.appendChild(modal);
  setTimeout(() => labelInput.focus(), 100);
}

function buildAddModalEmojiPicker(anchorEl, onPick) {
  const existing = document.querySelector('.emoji-picker');
  if (existing) existing.remove();

  const grid = el('div', { class: 'emoji-picker__grid' },
    EMOJI_SUGGESTIONS.map((e) =>
      el('button', {
        class: 'emoji-picker__item',
        onclick: (ev) => {
          ev.stopPropagation();
          anchorEl.textContent = e;
          picker.remove();
          onPick(e);
        },
      }, e)
    )
  );

  const picker = el('div', { class: 'emoji-picker' }, [
    grid,
    el('button', { class: 'emoji-picker__close', onclick: () => picker.remove() }, 'Fermer'),
  ]);

  const rect = anchorEl.getBoundingClientRect();
  picker.style.cssText = `position: fixed; top: ${rect.bottom + 6}px; left: ${rect.left}px; z-index: 300;`;
  document.body.appendChild(picker);
}

// --- Sheet de prévisualisation ---

function openPreviewSheet() {
  const existing = document.querySelector('.studio-modal');
  if (existing) existing.remove();

  const state = loadState();
  const profile = studioProfiles.find((p) => p.id === studioActiveId);
  if (!profile) return;

  const arrival = '09:00';
  const travel = 20;
  const transport = 'car';
  const ctx = { day: 1, type: 'work' };
  const plan = buildPlan(profile.steps, arrival, travel, transport, state.latenessScore, ctx);

  const items = plan.sequence.map((s) => {
    const isLeave = s.key === 'leave';
    return el('div', { class: 'timeline-item' + (isLeave ? ' timeline-item--leave' : '') }, [
      el('div', { class: 'timeline-item__time' }, fromMin(s.at)),
      el('div', { class: 'timeline-item__emoji' }, s.emoji || ''),
      el('div', { class: 'timeline-item__label' }, s.label),
    ]);
  });

  const modal = el('div', { class: 'studio-modal' }, [
    el('div', { class: 'studio-modal__sheet' }, [
      el('div', { class: 'studio-modal__handle' }),
      el('div', { class: 't-label', style: 'margin-bottom: 16px' }, 'Aperçu'),
      el('div', { style: 'display:flex; flex-direction:column; gap:8px' }, items),
      el('div', { class: 'spacer-sm' }),
      el('div', { class: 'callout' }, [
        el('div', { class: 'callout__icon' }, 'ℹ️'),
        el('div', { class: 'callout__text' }, 'Pour un départ à 09:00, trajet 20 min en voiture.'),
      ]),
      el('div', { class: 'spacer-md' }),
      el('button', { class: 'btn btn--ghost', onclick: () => modal.remove() }, 'Fermer'),
    ]),
  ]);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });

  document.body.appendChild(modal);
}

// --- Rendu d'une carte d'étape ---

function buildStepCard(step, idx, profile, listEl) {
  const isDraggable = !step.fixed;
  const isFirst = idx === 0;
  const isLast = idx === profile.steps.length - 1;

  const handle = isDraggable
    ? el('div', { class: 'studio-step__handle', 'aria-label': 'Glisser pour réordonner', role: 'img' }, [
        el('div', { class: 'studio-step__dots' }),
      ])
    : el('div', { class: 'studio-step__handle studio-step__handle--fixed' });

  // Emoji button (tappable if not fixed).
  let emojiEl;
  if (!step.fixed) {
    emojiEl = el('button', {
      class: 'studio-step__emoji',
      'aria-label': `Changer l'emoji de ${step.label}`,
      onclick: (e) => buildEmojiPicker(step.key, e.currentTarget),
    }, step.emoji);
  } else {
    emojiEl = el('div', { class: 'studio-step__emoji studio-step__emoji--fixed' }, step.emoji);
  }

  // Label (tappable if not fixed, becomes inline input).
  let labelEl;
  if (!step.fixed) {
    labelEl = el('button', {
      class: 'studio-step__label',
      'aria-label': `Modifier le nom : ${step.label}`,
      onclick: (e) => startInlineEdit(e.currentTarget, step, idx),
    }, step.label);
  } else {
    labelEl = el('div', { class: 'studio-step__label studio-step__label--fixed' }, step.label);
  }

  const durMinus = el('button', {
    class: 'dur-btn',
    'aria-label': `Diminuer la durée de ${step.label}`,
    onclick: () => {
      studioProfiles = setDuration(studioProfiles, studioActiveId, step.key, -1);
      autosave();
      renderStudio();
    },
  }, '−');

  const durValue = el('div', { class: 'studio-step__dur' }, step.est + ' min');

  const durPlus = el('button', {
    class: 'dur-btn',
    'aria-label': `Augmenter la durée de ${step.label}`,
    onclick: () => {
      studioProfiles = setDuration(studioProfiles, studioActiveId, step.key, 1);
      autosave();
      renderStudio();
    },
  }, '+');

  const deleteBtn = !step.fixed
    ? el('button', {
        class: 'studio-step__delete',
        'aria-label': `Supprimer l'étape ${step.label}`,
        onclick: () => {
          studioProfiles = removeStep(studioProfiles, studioActiveId, step.key);
          autosave();
          renderStudio();
        },
      }, '×')
    : null;

  // Keyboard reorder buttons (visible only on focus).
  const kbUp = !isFirst && !step.fixed
    ? el('button', {
        class: 'studio-step__kbmove',
        'aria-label': `Monter ${step.label}`,
        onclick: () => {
          studioProfiles = reorderSteps(studioProfiles, studioActiveId, idx, idx - 1);
          autosave();
          renderStudio();
        },
      }, '↑')
    : null;

  const kbDown = !isLast && !step.fixed
    ? el('button', {
        class: 'studio-step__kbmove',
        'aria-label': `Descendre ${step.label}`,
        onclick: () => {
          studioProfiles = reorderSteps(studioProfiles, studioActiveId, idx, idx + 1);
          autosave();
          renderStudio();
        },
      }, '↓')
    : null;

  const card = el('div', {
    class: 'studio-step' + (step.fixed ? ' studio-step--fixed' : ''),
    'data-key': step.key,
  }, [
    handle,
    emojiEl,
    labelEl,
    el('div', { class: 'studio-step__dur-controls' }, [durMinus, durValue, durPlus]),
    el('div', { class: 'studio-step__kbmoves' }, [kbUp, kbDown]),
    deleteBtn,
  ]);

  // Attach drag only to draggable cards, listening on the handle.
  if (isDraggable) {
    initDrag(handle, idx, listEl);
  }

  return card;
}

function startInlineEdit(labelBtn, step, idx) {
  const original = step.label;
  const input = el('input', {
    class: 'studio-step__label-input',
    type: 'text',
    value: original,
    maxlength: '32',
    'aria-label': 'Nom de l\'étape',
  });

  function confirm() {
    const val = input.value.trim();
    studioProfiles = renameStep(studioProfiles, studioActiveId, step.key, val || original);
    autosave();
    renderStudio();
  }

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); confirm(); }
    if (e.key === 'Escape') { renderStudio(); }
  });
  input.addEventListener('blur', confirm);

  labelBtn.replaceWith(input);
  input.focus();
  input.select();
}

// --- Rendu principal du Studio ---

let saveConfirmTimeout = null;

function renderStudio() {
  const profile = studioProfiles.find((p) => p.id === studioActiveId);
  if (!profile) return;

  const steps = profile.steps;
  const totalDur = steps.reduce((a, s) => a + s.est, 0);
  const canAddStep = steps.length < MAX_STEPS;
  const canAddProfile = studioProfiles.length < MAX_PROFILES;

  // Profile pills.
  const pills = [
    ...studioProfiles.map((p) =>
      el('button', {
        class: 'pill' + (p.id === studioActiveId ? ' is-on' : ''),
        onclick: () => {
          studioActiveId = p.id;
          renderStudio();
        },
      }, [el('span', {}, p.emoji), el('span', {}, p.name)])
    ),
    canAddProfile
      ? el('button', {
          class: 'pill studio-add-profile',
          'aria-label': 'Ajouter un profil',
          onclick: addProfile,
        }, '+ Profil')
      : null,
  ].filter(Boolean);

  // Step list.
  const listEl = el('div', { class: 'studio-step-list' });
  steps.forEach((step, idx) => {
    listEl.appendChild(buildStepCard(step, idx, profile, listEl));
  });

  // Add step button.
  const addStepEl = canAddStep
    ? el('button', {
        class: 'studio-add-step',
        onclick: openAddStepModal,
      }, [
        el('span', { class: 'studio-add-step__icon' }, '+'),
        el('span', {}, 'Ajouter une étape libre'),
      ])
    : el('div', { class: 'studio-add-step studio-add-step--disabled' }, [
        el('span', {}, 'Maximum 8 étapes atteint'),
      ]);

  // Save button.
  const saveBtn = el('button', {
    class: 'btn btn--primary studio-save-btn',
    id: 'studio-save-btn',
    onclick: () => {
      autosave();
      const btn = document.getElementById('studio-save-btn');
      if (!btn) return;
      btn.textContent = '✓ Sauvegardé';
      btn.style.background = 'var(--green-dk)';
      btn.style.color = 'var(--green)';
      clearTimeout(saveConfirmTimeout);
      saveConfirmTimeout = setTimeout(() => {
        if (document.getElementById('studio-save-btn')) renderStudio();
      }, 2000);
    },
  }, 'Sauvegarder');

  const screen = el('main', { class: 'screen screen--studio stagger' }, [
    el('div', { class: 'studio-topbar' }, [
      el('div', { class: 'wordmark' }, [
        el('span', { class: 'wordmark__dot' }),
        el('span', { class: 'wordmark__name' }, 'Douce heure'),
      ]),
      el('button', {
        class: 'btn--ghost studio-back-btn',
        onclick: leaveStudio,
        'aria-label': 'Retour',
      }, '← Retour'),
    ]),

    el('div', { class: 'spacer-md' }),
    el('div', { class: 't-label' }, 'Le Studio'),
    el('div', { class: 'spacer-sm' }),
    el('h1', { class: 't-display' }, 'Compose ta routine'),
    el('p', { class: 't-body', style: 'margin-top: 10px' },
      'Glisse pour réordonner, touche pour modifier. Chaque changement est sauvegardé.'),

    el('div', { class: 'spacer-md' }),
    el('div', { class: 't-label' }, 'Mes routines'),
    el('div', { class: 'spacer-sm' }),
    el('div', { class: 'studio-profile-pills' }, pills),

    el('div', { class: 'spacer-md' }),
    el('div', { class: 'studio-steps-header' }, [
      el('div', { class: 't-label' }, `Étapes · ${steps.length}`),
      el('div', { class: 'studio-total-dur' }, `Durée totale : ${totalDur} min`),
    ]),
    el('div', { class: 'spacer-sm' }),
    listEl,

    el('div', { class: 'spacer-sm' }),
    addStepEl,

    el('div', { class: 'spacer-md' }),
    el('div', { style: 'display:flex; gap:10px' }, [
      el('button', {
        class: 'btn btn--soft',
        style: 'flex:1',
        onclick: openPreviewSheet,
      }, '👁 Prévisualiser'),
      el('div', { style: 'flex:1' }, saveBtn),
    ]),

    el('div', { class: 'spacer-sm' }),
    el('button', {
      class: 'btn btn--ghost',
      style: 'font-size:12px; opacity:0.6',
      onclick: showRoutineSettings,
    }, '⚙ Mon trajet habituel'),
  ]);

  const root = document.getElementById('app');
  if (!root) return;
  if (root.dataset.screen !== 'studio') {
    screen.classList.add('screen--enter');
    root.dataset.screen = 'studio';
  }
  root.replaceChildren(screen);
}

// --- Ajout d'un profil ---

function addProfile() {
  const used = studioProfiles.map((p) => p.name);
  const preset = PROFILE_PRESETS.find((p) => !used.includes(p.name))
    || { name: `Profil ${studioProfiles.length + 1}`, emoji: '🌿' };

  // Clone steps from active profile, but reset real measurements.
  const base = studioProfiles.find((p) => p.id === studioActiveId);
  const clonedSteps = base
    ? structuredClone(base.steps).map((s) => ({ ...s, real: [] }))
    : [];

  const newProfile = {
    id: `profile-${Date.now()}`,
    name: preset.name,
    emoji: preset.emoji,
    steps: clonedSteps,
  };

  studioProfiles = [...studioProfiles, newProfile];
  studioActiveId = newProfile.id;
  autosave();
  renderStudio();
}

// --- Navigation ---

function leaveStudio() {
  document.body.classList.remove('in-studio');
  const root = document.getElementById('app');
  if (root) delete root.dataset.screen;
  import('./ui.js').then((m) => m.showHome());
}

function showRoutineSettings() {
  document.body.classList.remove('in-studio');
  const root = document.getElementById('app');
  if (root) delete root.dataset.screen;
  import('./ui.js').then((m) => m.showRoutine());
}

// --- Point d'entrée ---

export function showStudio() {
  const { profiles, activeId } = loadProfiles();
  studioProfiles = profiles;
  studioActiveId = activeId;
  openPickerStepKey = null;
  document.body.classList.add('in-studio');
  renderStudio();
}

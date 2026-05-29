// État unique persisté dans une seule clé localStorage (cf. CLAUDE.md §5).

const KEY = 'douce-heure:v1';

// Étapes par défaut. fixed = non supprimable.
export const DEFAULT_STEPS = [
  { key: 'wakeup',    label: 'Réveil',           emoji: '☀️', est: 5,  active: true,  fixed: true,  real: [] },
  { key: 'shower',    label: 'Douche',           emoji: '🚿', est: 15, active: true,  fixed: false, real: [] },
  { key: 'outfit',    label: 'Tenue',            emoji: '👕', est: 10, active: true,  fixed: false, real: [] },
  { key: 'breakfast', label: 'Petit déjeuner',   emoji: '🥐', est: 12, active: true,  fixed: false, real: [] },
  { key: 'grooming',  label: 'Soins',            emoji: '🪞', est: 10, active: false, fixed: false, real: [] },
  { key: 'bag',       label: 'Sac',              emoji: '🎒', est: 6,  active: true,  fixed: false, real: [] },
  { key: 'ready',     label: 'Clés, prêt·e',     emoji: '🗝️', est: 4,  active: true,  fixed: true,  real: [] }
];

function makeDefaultProfiles() {
  const full = structuredClone(DEFAULT_STEPS);
  return [
    { id: 'profile_default', name: 'Routine complète', emoji: '✨', steps: full },
    {
      id: 'profile_fast', name: 'Routine rapide', emoji: '⚡',
      steps: full.filter((s) => s.fixed || ['shower', 'outfit'].includes(s.key))
                 .map((s) => ({ ...s, real: [] })),
    },
  ];
}

function defaultState() {
  return {
    name: '',
    sound: true,
    latenessScore: 0.5,
    profiles: makeDefaultProfiles(),
    activeProfileId: 'profile_default',
    history: [],
    routine: null,
    contacts: [],
  };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      const s = defaultState();
      saveState(s);
      return s;
    }
    return JSON.parse(raw);
  } catch {
    return defaultState();
  }
}

export function saveState(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

// Migration depuis l'ancien format (steps à plat) vers profiles.
export function migrateIfNeeded(state) {
  // Déjà migré.
  if (state.profiles && state.activeProfileId) {
    if (!state.profiles.find((p) => p.id === state.activeProfileId)) {
      state.activeProfileId = state.profiles[0]?.id;
    }
    if (!state.contacts) {
      state.contacts = [];
      saveState(state);
    }
    return state;
  }

  if (!state.contacts) {
    state.contacts = [];
  }

  const existingSteps = state.steps || structuredClone(DEFAULT_STEPS);
  state.profiles = [
    { id: 'profile_default', name: 'Routine complète', emoji: '✨', steps: existingSteps },
    {
      id: 'profile_fast', name: 'Routine rapide', emoji: '⚡',
      steps: existingSteps
        .filter((s) => s.fixed || ['shower', 'outfit'].includes(s.key))
        .map((s) => ({ ...s })),
    },
  ];
  state.activeProfileId = 'profile_default';
  delete state.steps;
  saveState(state);
  return state;
}

export function getActiveProfile(state) {
  return state.profiles?.find((p) => p.id === state.activeProfileId) || null;
}

export function getActiveSteps(state) {
  return getActiveProfile(state)?.steps || [];
}

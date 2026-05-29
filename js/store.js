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

function defaultState() {
  return {
    name: '',
    sound: true,
    latenessScore: 0.5,
    profiles: [
      {
        id: 'default',
        name: 'Routine complète',
        emoji: '✨',
        steps: structuredClone(DEFAULT_STEPS),
      }
    ],
    activeProfileId: 'default',
    history: [],
    routine: null
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
  if (state.steps && !state.profiles) {
    state.profiles = [
      {
        id: 'default',
        name: 'Routine complète',
        emoji: '✨',
        steps: state.steps,
      }
    ];
    state.activeProfileId = 'default';
    delete state.steps;
    saveState(state);
  }
  // Garantie : activeProfileId pointe sur un profil existant.
  if (!state.profiles?.find((p) => p.id === state.activeProfileId)) {
    state.activeProfileId = state.profiles?.[0]?.id || 'default';
  }
  return state;
}

export function getActiveProfile(state) {
  return state.profiles?.find((p) => p.id === state.activeProfileId) || null;
}

export function getActiveSteps(state) {
  return getActiveProfile(state)?.steps || [];
}

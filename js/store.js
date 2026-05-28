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
    steps: structuredClone(DEFAULT_STEPS),
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

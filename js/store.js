// État unique persisté dans une seule clé localStorage (cf. CLAUDE.md §5).
// Schéma v2 (spec v2 §4) : profils complets, destinations, chevet, réglages.
// Toute la logique ici est pure (testable en node), sauf loadState/saveState.

const KEY = 'douce-heure:v1';

// Correspondance emoji v1 -> icône maison v2 (migration).
const EMOJI_TO_ICON = {
  '☀️': 'sun', '🚿': 'shower', '👕': 'outfit', '🥐': 'breakfast',
  '🪞': 'care', '🎒': 'bag', '🗝️': 'keys', '🚪': 'door',
  '⚡': 'star', '✨': 'star', '🌸': 'heart', '☕': 'coffee',
  '🏃': 'sport', '🚴': 'bike', '🎸': 'headset',
};

// Étapes dont le kind est 'core' à la migration (spec v2 §4).
const CORE_KEYS = ['wakeup', 'outfit', 'bag', 'ready'];

// Étapes par défaut. fixed = non supprimable.
export const DEFAULT_STEPS = [
  { key: 'wakeup',    label: 'Réveil',         icon: 'sun',       emoji: null, est: 5,  active: true,  fixed: true,  kind: 'core',    real: [] },
  { key: 'shower',    label: 'Douche',         icon: 'shower',    emoji: null, est: 15, active: true,  fixed: false, kind: 'comfort', real: [] },
  { key: 'outfit',    label: 'Tenue',          icon: 'outfit',    emoji: null, est: 10, active: true,  fixed: false, kind: 'core',    real: [] },
  { key: 'breakfast', label: 'Petit déjeuner', icon: 'breakfast', emoji: null, est: 12, active: true,  fixed: false, kind: 'comfort', real: [] },
  { key: 'grooming',  label: 'Soins',          icon: 'care',      emoji: null, est: 10, active: false, fixed: false, kind: 'comfort', real: [] },
  { key: 'bag',       label: 'Sac',            icon: 'bag',       emoji: null, est: 6,  active: true,  fixed: false, kind: 'core',    real: [] },
  { key: 'ready',     label: 'Clés, prêt·e',   icon: 'keys',      emoji: null, est: 4,  active: true,  fixed: true,  kind: 'core',    real: [] },
];

export const DEFAULT_CHECKLIST = [
  { id: 'chk_keys',  label: 'Clés',      done: false },
  { id: 'chk_phone', label: 'Téléphone', done: false },
];

// Archétypes de départ (spec v2 §9), proposés à la création de profil et à l'onboarding.
export const ARCHETYPES = [
  { key: 'express',   name: 'Matin express',   icon: 'sun',
    stepKeys: ['wakeup', 'outfit', 'bag', 'ready'], checklist: ['Clés', 'Téléphone'] },
  { key: 'classic',   name: 'Matin classique', icon: 'coffee',
    stepKeys: ['wakeup', 'shower', 'outfit', 'breakfast', 'bag', 'ready'], checklist: ['Clés', 'Téléphone'] },
  { key: 'self',      name: 'Matin avec du temps pour soi', icon: 'heart',
    stepKeys: ['wakeup', 'shower', 'grooming', 'outfit', 'breakfast', 'bag', 'ready'], checklist: ['Clés', 'Téléphone'] },
  { key: 'sport',     name: 'Sport',  icon: 'sport',
    stepKeys: ['wakeup', 'outfit', 'bag', 'ready'], checklist: ['Clés', 'Téléphone', 'Sac de sport', 'Gourde'] },
  { key: 'gig',       name: 'Gig',    icon: 'headset',
    stepKeys: ['wakeup', 'shower', 'outfit', 'bag', 'ready'], checklist: ['Clés', 'Téléphone', 'Casque', 'Clés USB', 'Câbles'] },
  { key: 'travel',    name: 'Voyage', icon: 'suitcase',
    stepKeys: ['wakeup', 'shower', 'outfit', 'breakfast', 'bag', 'ready'], checklist: ['Clés', 'Téléphone', 'Billets', 'Papiers', 'Chargeur'] },
];

export const MAX_PROFILES = 6;
export const MAX_STEPS = 8;
export const MAX_REAL = 8;

let checklistSeq = 0;
export function makeChecklist(labels) {
  return labels.map((label) => ({
    id: `chk_${Date.now().toString(36)}_${checklistSeq++}`,
    label,
    done: false,
  }));
}

export function makeProfileFromArchetype(arch, id) {
  const steps = DEFAULT_STEPS
    .filter((s) => arch.stepKeys.includes(s.key))
    .map((s) => structuredClone(s));
  return {
    id: id || `profile_${Date.now().toString(36)}`,
    name: arch.name,
    icon: arch.icon,
    steps,
    checklist: makeChecklist(arch.checklist),
    defaults: { arrival: null, transport: 'walk', destinationId: null },
  };
}

export function defaultSettings() {
  return {
    confirmMode: 'hold',
    scene: 'auto',
    ambient: false,
    haptics: true,
    readable: false,
    sound: true,
    voice: { enabled: false, rate: 1, voiceURI: null },
  };
}

export function defaultState() {
  return {
    version: 2,
    name: '',
    latenessScore: 0.5,
    onboarded: false,
    settings: defaultSettings(),
    profiles: [
      makeProfileFromArchetype(ARCHETYPES[1], 'profile_default'),
      makeProfileFromArchetype(ARCHETYPES[0], 'profile_fast'),
    ],
    activeProfileId: 'profile_default',
    destinations: [],
    bedside: null,
    pendingTrip: null,
    history: [],
    routine: null,
    contacts: [],
  };
}

function iconForEmoji(emoji) {
  return EMOJI_TO_ICON[emoji] || 'star';
}

function migrateStep(old) {
  return {
    key: old.key,
    label: old.label,
    icon: old.icon || iconForEmoji(old.emoji),
    emoji: old.emoji ?? null,
    est: old.est,
    active: old.active !== false,
    fixed: !!old.fixed,
    kind: old.kind || (CORE_KEYS.includes(old.key) ? 'core' : 'comfort'),
    real: Array.isArray(old.real) ? old.real.slice(-MAX_REAL) : [],
  };
}

function migrateProfile(old, routine) {
  return {
    id: old.id,
    name: old.name,
    icon: old.icon || iconForEmoji(old.emoji),
    steps: (old.steps || []).map(migrateStep),
    checklist: Array.isArray(old.checklist) && old.checklist.length
      ? old.checklist.map((c) => ({ id: c.id, label: c.label, done: false }))
      : makeChecklist(DEFAULT_CHECKLIST.map((c) => c.label)),
    defaults: old.defaults || {
      arrival: routine?.arrival || null,
      transport: routine?.transport || 'walk',
      destinationId: null,
    },
  };
}

// Migration v1 -> v2 (spec v2 §4). Conserve history, mesures réelles et latenessScore.
// Idempotente : un état déjà en v2 est simplement normalisé.
export function migrate(state) {
  if (!state || typeof state !== 'object') return defaultState();

  if (state.version === 2) {
    // Normalisation douce : champs manquants comblés, sans toucher aux données.
    state.settings = { ...defaultSettings(), ...(state.settings || {}) };
    state.settings.voice = { ...defaultSettings().voice, ...(state.settings.voice || {}) };
    state.destinations = state.destinations || [];
    state.contacts = state.contacts || [];
    state.history = state.history || [];
    state.bedside = state.bedside || null;
    state.pendingTrip = state.pendingTrip || null;
    if (!state.profiles?.length) state.profiles = defaultState().profiles;
    if (!state.profiles.find((p) => p.id === state.activeProfileId)) {
      state.activeProfileId = state.profiles[0].id;
    }
    return state;
  }

  // v1 : soit profiles (emoji), soit steps à plat (tout premier format).
  const next = defaultState();
  next.name = state.name || '';
  next.latenessScore = typeof state.latenessScore === 'number' ? state.latenessScore : 0.5;
  next.onboarded = true; // un état v1 existant a déjà dépassé l'onboarding
  next.settings.sound = state.sound !== false;
  next.routine = state.routine || null;
  next.contacts = state.contacts || [];
  next.history = (state.history || []).map((h) => ({ ...h, profileId: h.profileId ?? null }));

  if (Array.isArray(state.profiles) && state.profiles.length) {
    next.profiles = state.profiles.map((p) => migrateProfile(p, state.routine));
    next.activeProfileId = next.profiles.find((p) => p.id === state.activeProfileId)
      ? state.activeProfileId
      : next.profiles[0].id;
  } else if (Array.isArray(state.steps)) {
    const profile = migrateProfile(
      { id: 'profile_default', name: 'Matin classique', emoji: '✨', steps: state.steps },
      state.routine
    );
    next.profiles = [profile];
    next.activeProfileId = profile.id;
  }

  return next;
}

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      const s = defaultState();
      saveState(s);
      return s;
    }
    const parsed = JSON.parse(raw);
    if (parsed.version !== 2) {
      const migrated = migrate(parsed);
      saveState(migrated);
      return migrated;
    }
    return parsed;
  } catch {
    return defaultState();
  }
}

export function saveState(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function getActiveProfile(state) {
  return state.profiles?.find((p) => p.id === state.activeProfileId) || null;
}

export function getActiveSteps(state) {
  return getActiveProfile(state)?.steps || [];
}

export function getProfile(state, id) {
  return state.profiles?.find((p) => p.id === id) || null;
}

// Profil du "prochain départ" : heure d'arrivée par défaut la plus proche de maintenant.
export function nextDepartureProfile(state, nowMin) {
  const withArrival = (state.profiles || []).filter((p) => p.defaults?.arrival);
  if (!withArrival.length) return getActiveProfile(state);
  const delta = (p) => {
    const [h, m] = p.defaults.arrival.split(':').map(Number);
    let d = h * 60 + m - nowMin;
    if (d < 0) d += 1440;
    return d;
  };
  return withArrival.sort((a, b) => delta(a) - delta(b))[0];
}

// F7 · Export et import des données. File API locale uniquement, aucun envoi.
// Validation stricte clé par clé : tout champ inconnu est ignoré,
// toute structure invalide est rejetée. Remplacement intégral, pas de fusion.

import { migrate, defaultState, defaultSettings } from './store.js';

const num = (v, fb) => (typeof v === 'number' && isFinite(v) ? v : fb);
const str = (v, fb = '') => (typeof v === 'string' ? v : fb);
const bool = (v, fb = false) => (typeof v === 'boolean' ? v : fb);
const arr = (v) => (Array.isArray(v) ? v : []);

function sanitizeReal(real, max = 8) {
  return arr(real)
    .filter((r) => r && typeof r.v === 'number' && isFinite(r.v))
    .slice(-max)
    .map((r) => ({ v: r.v, day: num(r.day, 0), ...(r.type !== undefined ? { type: str(r.type) } : {}) }));
}

function sanitizeStep(s) {
  if (!s || typeof s.key !== 'string' || typeof s.label !== 'string') return null;
  return {
    key: s.key,
    label: s.label.slice(0, 40),
    icon: str(s.icon, 'star'),
    emoji: typeof s.emoji === 'string' ? s.emoji : null,
    est: Math.max(1, num(s.est, 5)),
    // J2 : l'estimation de référence, base du calibrage. Sans elle, un
    // recalibrage après restauration s'empilerait sur un `est` déjà
    // calibré et le plan dériverait. Absente d'une sauvegarde d'avant J2 :
    // `est` fait alors office de référence, ce qui est exact.
    ...(typeof s.estBase === 'number' ? { estBase: Math.max(1, s.estBase) } : {}),
    active: bool(s.active, true),
    fixed: bool(s.fixed, false),
    kind: s.kind === 'core' ? 'core' : 'comfort',
    real: sanitizeReal(s.real),
  };
}

function sanitizeProfile(p) {
  if (!p || typeof p.id !== 'string' || typeof p.name !== 'string') return null;
  const steps = arr(p.steps).map(sanitizeStep).filter(Boolean);
  if (!steps.length) return null;
  return {
    id: p.id,
    name: p.name.slice(0, 40),
    icon: str(p.icon, 'star'),
    steps,
    checklist: arr(p.checklist)
      .filter((c) => c && typeof c.label === 'string')
      .map((c) => ({ id: str(c.id, `chk_${Math.random().toString(36).slice(2)}`), label: c.label.slice(0, 40), done: false })),
    defaults: {
      arrival: typeof p.defaults?.arrival === 'string' ? p.defaults.arrival : null,
      transport: str(p.defaults?.transport, 'walk'),
      destinationId: typeof p.defaults?.destinationId === 'string' ? p.defaults.destinationId : null,
      // J2 : sans ce champ, restaurer une sauvegarde perdrait le calibrage
      // et renverrait la personne au comportement d'avant J2.
      wakeTime: typeof p.defaults?.wakeTime === 'string' ? p.defaults.wakeTime : null,
    },
  };
}

function sanitizeDestination(d) {
  if (!d || typeof d.id !== 'string' || typeof d.label !== 'string') return null;
  const byTransport = {};
  if (d.byTransport && typeof d.byTransport === 'object') {
    for (const [t, entry] of Object.entries(d.byTransport)) {
      byTransport[t] = { real: sanitizeReal(entry?.real) };
    }
  }
  return { id: d.id, label: d.label.slice(0, 40), byTransport };
}

// Valide un objet importé. Renvoie { ok: true, state } ou { ok: false, error }.
export function validateImport(raw) {
  let data = raw;
  if (typeof raw === 'string') {
    try { data = JSON.parse(raw); } catch { return { ok: false, error: 'json' }; }
  }
  if (!data || typeof data !== 'object') return { ok: false, error: 'structure' };
  if (data.version !== 2) {
    // Format v1 reconnaissable : on migre puis on repasse par la validation.
    if (data.version === undefined && (Array.isArray(data.steps) || Array.isArray(data.profiles))) {
      return validateImport(migrate(data));
    }
    return { ok: false, error: 'version' };
  }

  const base = defaultState();
  const state = {
    version: 2,
    name: str(data.name).slice(0, 40),
    latenessScore: Math.min(1, Math.max(0, num(data.latenessScore, 0.5))),
    onboarded: bool(data.onboarded, true),
    settings: { ...defaultSettings() },
    profiles: arr(data.profiles).map(sanitizeProfile).filter(Boolean).slice(0, 6),
    activeProfileId: str(data.activeProfileId),
    destinations: arr(data.destinations).map(sanitizeDestination).filter(Boolean),
    bedside: null,
    pendingTrip: null,
    pendingSession: null,
    history: arr(data.history)
      .filter((h) => h && typeof h.ts === 'number' && ['early', 'ontime', 'late'].includes(h.status))
      .map((h) => ({ ts: h.ts, status: h.status, day: num(h.day, 0), type: str(h.type, 'other'), profileId: typeof h.profileId === 'string' ? h.profileId : null })),
    routine: null,
    contacts: arr(data.contacts)
      .filter((c) => c && typeof c.name === 'string' && typeof c.number === 'string')
      .map((c) => ({ id: str(c.id, String(Date.now())), name: c.name.slice(0, 40), number: c.number.slice(0, 40), channel: str(c.channel, 'sms'), messageIdx: num(c.messageIdx, 0) })),
  };

  const s = data.settings || {};
  state.settings.confirmMode = s.confirmMode === 'tap' ? 'tap' : 'hold';
  state.settings.scene = ['auto', 'dawn', 'day', 'evening'].includes(s.scene) ? s.scene : 'auto';
  state.settings.ambient = bool(s.ambient);
  state.settings.haptics = bool(s.haptics, true);
  state.settings.readable = bool(s.readable);
  state.settings.sound = bool(s.sound, true);
  state.settings.voice = {
    enabled: bool(s.voice?.enabled),
    rate: Math.min(1.1, Math.max(0.8, num(s.voice?.rate, 1))),
    voiceURI: typeof s.voice?.voiceURI === 'string' ? s.voice.voiceURI : null,
  };

  if (data.bedside && typeof data.bedside.wakeTime === 'string') {
    state.bedside = {
      wakeTime: data.bedside.wakeTime,
      profileId: str(data.bedside.profileId),
      lightLeadMin: Math.min(30, Math.max(1, num(data.bedside.lightLeadMin, 10))),
      sound: bool(data.bedside.sound, true),
    };
  }

  if (data.routine && typeof data.routine.arrival === 'string') {
    state.routine = {
      arrival: data.routine.arrival,
      transport: str(data.routine.transport, 'walk'),
      travel: num(data.routine.travel, 20),
      days: arr(data.routine.days).filter((d) => typeof d === 'number'),
      evening: bool(data.routine.evening),
    };
  }

  if (!state.profiles.length) state.profiles = base.profiles;
  if (!state.profiles.find((p) => p.id === state.activeProfileId)) {
    state.activeProfileId = state.profiles[0].id;
  }

  return { ok: true, state };
}

// Nom de fichier d'export : douce-heure-AAAA-MM-JJ.json
export function exportFilename(now = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `douce-heure-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}.json`;
}

// Déclenche le téléchargement local de l'état complet.
export function downloadExport(state) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = exportFilename();
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

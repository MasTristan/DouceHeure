import test from 'node:test';
import assert from 'node:assert/strict';
import { migrate, defaultState } from '../js/store.js';

// Etat v1 realiste : profils emoji, mesures reelles, historique.
function v1State() {
  return {
    name: 'Camille',
    sound: false,
    latenessScore: 0.72,
    profiles: [
      {
        id: 'profile_default', name: 'Routine complète', emoji: '✨',
        steps: [
          { key: 'wakeup', label: 'Réveil', emoji: '☀️', est: 5, active: true, fixed: true, real: [{ v: 7, day: 1, type: 'work' }] },
          { key: 'shower', label: 'Douche', emoji: '🚿', est: 15, active: true, fixed: false, real: [{ v: 22, day: 1, type: 'work' }, { v: 19, day: 2, type: 'work' }] },
          { key: 'ready', label: 'Clés, prêt·e', emoji: '🗝️', est: 4, active: true, fixed: true, real: [] },
        ],
      },
    ],
    activeProfileId: 'profile_default',
    history: [
      { ts: 1700000000000, status: 'ontime', day: 1, type: 'work' },
      { ts: 1700086400000, status: 'late', day: 2, type: 'work' },
    ],
    routine: { arrival: '08:30', transport: 'bike', travel: 25, days: [1, 2, 3, 4, 5], evening: false },
    contacts: [{ id: '1', name: 'Lou', number: '+33600000000', channel: 'sms', messageIdx: 0 }],
  };
}

test('migration v1 -> v2 : history, mesures et latenessScore conserves', () => {
  const v2 = migrate(v1State());
  assert.equal(v2.version, 2);
  assert.equal(v2.latenessScore, 0.72);
  assert.equal(v2.history.length, 2);
  assert.equal(v2.history[0].status, 'ontime');
  const shower = v2.profiles[0].steps.find((s) => s.key === 'shower');
  assert.deepEqual(shower.real.map((r) => r.v), [22, 19]);
});

test('migration : kind core pour wakeup/outfit/bag/ready, comfort sinon', () => {
  const v2 = migrate(v1State());
  const byKey = Object.fromEntries(v2.profiles[0].steps.map((s) => [s.key, s.kind]));
  assert.equal(byKey.wakeup, 'core');
  assert.equal(byKey.ready, 'core');
  assert.equal(byKey.shower, 'comfort');
});

test('migration : icon mappee depuis l\'emoji', () => {
  const v2 = migrate(v1State());
  const byKey = Object.fromEntries(v2.profiles[0].steps.map((s) => [s.key, s.icon]));
  assert.equal(byKey.wakeup, 'sun');
  assert.equal(byKey.shower, 'shower');
  assert.equal(byKey.ready, 'keys');
});

test('migration : sound v1 repris dans settings, defauts de profil depuis routine', () => {
  const v2 = migrate(v1State());
  assert.equal(v2.settings.sound, false);
  assert.equal(v2.settings.confirmMode, 'hold');
  assert.equal(v2.profiles[0].defaults.arrival, '08:30');
  assert.equal(v2.profiles[0].defaults.transport, 'bike');
});

test('migration : history gagne profileId (null pour l\'ancien)', () => {
  const v2 = migrate(v1State());
  assert.equal(v2.history[0].profileId, null);
});

test('migration idempotente sur un etat v2', () => {
  const v2 = migrate(v1State());
  const again = migrate(structuredClone(v2));
  assert.deepEqual(again.profiles, v2.profiles);
  assert.deepEqual(again.history, v2.history);
});

test('migration du tout premier format (steps a plat)', () => {
  const flat = {
    name: '', sound: true, latenessScore: 0.5,
    steps: [
      { key: 'wakeup', label: 'Réveil', emoji: '☀️', est: 5, active: true, fixed: true, real: [{ v: 6, day: 3, type: 'work' }] },
      { key: 'ready', label: 'Prêt', emoji: '🗝️', est: 4, active: true, fixed: true, real: [] },
    ],
    history: [],
  };
  const v2 = migrate(flat);
  assert.equal(v2.version, 2);
  assert.equal(v2.profiles.length, 1);
  assert.equal(v2.profiles[0].steps[0].real[0].v, 6);
});

test('migration d\'un etat invalide : etat par defaut sain', () => {
  const v2 = migrate(null);
  assert.equal(v2.version, 2);
  assert.ok(v2.profiles.length >= 1);
  assert.deepEqual(v2, { ...v2, ...defaultState(), profiles: v2.profiles, settings: v2.settings });
});

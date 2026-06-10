import test from 'node:test';
import assert from 'node:assert/strict';
import { validateImport, exportFilename } from '../js/backup.js';
import { defaultState } from '../js/store.js';

test('export puis import : etat strictement equivalent', () => {
  const state = defaultState();
  state.name = 'Sam';
  state.latenessScore = 0.3;
  state.history.push({ ts: 1700000000000, status: 'ontime', day: 1, type: 'work', profileId: 'profile_default' });
  state.destinations.push({ id: 'd1', label: 'Bureau', byTransport: { bike: { real: [{ v: 14, day: 1 }] } } });
  state.profiles[0].steps[1].real.push({ v: 18, day: 1, type: 'work' });

  const json = JSON.stringify(state);
  const result = validateImport(json);
  assert.equal(result.ok, true);
  assert.deepEqual(result.state, JSON.parse(json));
});

test('import : champs inconnus ignores', () => {
  const state = defaultState();
  const raw = { ...state, champMysterieux: 'x', settings: { ...state.settings, autre: 1 } };
  const result = validateImport(JSON.stringify(raw));
  assert.equal(result.ok, true);
  assert.equal('champMysterieux' in result.state, false);
  assert.equal('autre' in result.state.settings, false);
});

test('import : version inconnue rejetee', () => {
  assert.equal(validateImport('{"version":99}').ok, false);
  assert.equal(validateImport('pas du json').ok, false);
  assert.equal(validateImport('42').ok, false);
});

test('import : un export v1 est migre puis accepte', () => {
  const v1 = {
    name: 'Ana', sound: true, latenessScore: 0.6,
    profiles: [{
      id: 'p1', name: 'Routine', emoji: '✨',
      steps: [{ key: 'wakeup', label: 'Réveil', emoji: '☀️', est: 5, active: true, fixed: true, real: [{ v: 6, day: 1, type: 'work' }] }],
    }],
    activeProfileId: 'p1',
    history: [],
  };
  const result = validateImport(JSON.stringify(v1));
  assert.equal(result.ok, true);
  assert.equal(result.state.version, 2);
  assert.equal(result.state.profiles[0].steps[0].real[0].v, 6);
});

test('import : valeurs hors bornes ramenees dans les bornes', () => {
  const state = defaultState();
  state.latenessScore = 4;
  state.settings.voice.rate = 9;
  const result = validateImport(JSON.stringify(state));
  assert.equal(result.state.latenessScore, 1);
  assert.equal(result.state.settings.voice.rate, 1.1);
});

test('nom de fichier d\'export : douce-heure-AAAA-MM-JJ.json', () => {
  assert.equal(exportFilename(new Date(2026, 5, 10)), 'douce-heure-2026-06-10.json');
});

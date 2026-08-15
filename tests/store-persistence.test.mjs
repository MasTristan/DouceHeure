// B5 · saveState() ne doit pas propager une exception de stockage (R5 :
// un matin en cours ne doit jamais casser sur un QuotaExceededError), et
// history doit rester borne (FIFO) au lieu de croitre sans limite.
import test from 'node:test';
import assert from 'node:assert/strict';
import { migrate, capHistory, MAX_HISTORY } from '../js/store.js';
import { recordDurations, recordOutcome } from '../js/predict.js';

function stubQuotaExceededLocalStorage() {
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem() { return null; },
      setItem() { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; },
    },
    configurable: true,
  });
}

test('B5 : saveState() n\'echoue pas quand le stockage refuse d\'ecrire', async () => {
  stubQuotaExceededLocalStorage();
  const { saveState } = await import('../js/store.js?b5');
  assert.doesNotThrow(() => saveState({ version: 2, history: [] }));
});

test('B5 : history reste borne a MAX_HISTORY apres de nombreuses sessions', () => {
  const state = { history: [], profiles: [{ id: 'p', steps: [] }], activeProfileId: 'p', latenessScore: 0.5 };
  for (let i = 0; i < 500; i++) {
    recordDurations(state, [], { day: 1, type: 'week', profileId: 'p' });
    recordOutcome(state, 'ontime', { day: 1, type: 'week', profileId: 'p' });
  }
  assert.ok(state.history.length <= MAX_HISTORY, `history a ${state.history.length} entrees, plafond ${MAX_HISTORY}`);
});

test('B5 : migrate() borne l\'historique existant, v2 comme v1', () => {
  const bigHistory = Array.from({ length: 400 }, (_, i) => ({ ts: i, status: 'ontime', day: 1, type: 'week' }));
  const v2 = migrate({ version: 2, history: bigHistory, profiles: [{ id: 'p', name: 'P', steps: [], checklist: [] }], activeProfileId: 'p' });
  assert.ok(v2.history.length <= MAX_HISTORY);

  const v1 = migrate({ history: bigHistory, steps: [{ key: 'a', label: 'A', est: 5 }] });
  assert.ok(v1.history.length <= MAX_HISTORY);
});

test('B5 : capHistory garde les entrees les plus recentes', () => {
  const h = Array.from({ length: 250 }, (_, i) => i);
  const capped = capHistory(h);
  assert.equal(capped.length, MAX_HISTORY);
  assert.equal(capped[capped.length - 1], 249);
});

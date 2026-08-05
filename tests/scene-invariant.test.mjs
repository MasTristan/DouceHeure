// B8 · La scène Nuit n'est atteignable que par le mode chevet (CLAUDE.md §6,
// piège « Scène Nuit par l'horloge »). resolveScene ne doit jamais retourner
// 'night', quels que soient l'heure et les réglages, y compris si une
// sauvegarde importée ou un état corrompu contient settings.scene = 'night'.
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveScene, SCENES } from '../js/scene.js';
import { validateImport } from '../js/backup.js';

test('B8 : resolveScene ne retourne jamais "night", sur toutes les combinaisons', () => {
  const prefs = ['auto', 'dawn', 'day', 'evening', 'night', 'bogus', undefined, null];
  for (const pref of prefs) {
    for (let h = 0; h < 24; h++) {
      const s = resolveScene({ scene: pref }, h);
      assert.notEqual(s, 'night', `resolveScene({scene:${pref}}, ${h}) a renvoye "night"`);
      assert.ok(['dawn', 'day', 'evening'].includes(s), `scene inattendue : ${s}`);
    }
  }
});

test('B8 : settings.scene absent ou invalide retombe sur l\'horloge, jamais sur "night"', () => {
  assert.notEqual(resolveScene(undefined, 3), 'night');
  assert.notEqual(resolveScene(null, 3), 'night');
});

test('B8 : une sauvegarde important "night" est normalisee a l\'import (deja verifie, verrouille ici)', () => {
  const r = validateImport({
    version: 2,
    profiles: [{ id: 'p', name: 'P', steps: [{ key: 'a', label: 'A' }] }],
    settings: { scene: 'night' },
  });
  assert.equal(r.ok, true);
  assert.notEqual(r.state.settings.scene, 'night');
});

test('SCENES continue d\'exposer "night" pour le mode chevet uniquement', () => {
  assert.ok(SCENES.includes('night'), 'le mode chevet doit pouvoir appliquer la scene night directement');
});

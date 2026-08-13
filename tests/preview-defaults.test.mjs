// B7 · La destination et le transport choisis dans l'Apercu doivent etre
// persistes dans profile.defaults au lancement de la session. Avant
// correctif, l'Apercu ne modifiait qu'un objet local `data`, jamais
// `profile.defaults` : confirmArrival() refuse d'ecrire sans destination
// (js/travel.js), donc la boucle d'apprentissage du trajet (F5) ne se
// fermait jamais pour qui ne passait pas par le Studio.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { commitPreviewDefaults, defaultState } from '../js/store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('B7 : commitPreviewDefaults ecrit la destination et le transport choisis', () => {
  const state = defaultState();
  const profileId = state.activeProfileId;
  assert.equal(state.profiles.find((p) => p.id === profileId).defaults.destinationId, null);

  commitPreviewDefaults(state, profileId, { destinationId: 'dest_travail', transport: 'transit' });

  const profile = state.profiles.find((p) => p.id === profileId);
  assert.equal(profile.defaults.destinationId, 'dest_travail');
  assert.equal(profile.defaults.transport, 'transit');
});

test('B7 : choisir "sans destination" efface bien la destination existante', () => {
  const state = defaultState();
  const profileId = state.activeProfileId;
  commitPreviewDefaults(state, profileId, { destinationId: 'dest_travail', transport: 'walk' });
  commitPreviewDefaults(state, profileId, { destinationId: null, transport: 'walk' });
  const profile = state.profiles.find((p) => p.id === profileId);
  assert.equal(profile.defaults.destinationId, null);
});

test('B7 : un profil inconnu ne leve pas et ne modifie rien', () => {
  const state = defaultState();
  assert.doesNotThrow(() => commitPreviewDefaults(state, 'profile_absent', { destinationId: 'x' }));
});

test('B7 : screens/preview.js appelle bien commitPreviewDefaults avant de lancer la session', () => {
  // showPreview vit depuis la découpe J1 étape 6 dans screens/preview.js,
  // plus dans ui.js (Nour, R1 §1.4).
  const src = fs.readFileSync(path.join(__dirname, '../js/screens/preview.js'), 'utf8');
  const ctaBlock = src.slice(src.indexOf('UI.preview_cta') - 600, src.indexOf('UI.preview_cta'));
  assert.match(ctaBlock, /commitPreviewDefaults\(/, 'le CTA de l\'Apercu ne persiste plus les defauts avant de lancer la session');
});

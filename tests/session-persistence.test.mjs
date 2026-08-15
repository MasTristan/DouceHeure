// B1 · Les mesures du matin ne doivent plus dependre d'un bilan de fin de
// session pour etre ecrites. Avant correctif, departNow() gardait
// live.measurements en memoire dans un objet `session` jamais persiste, et
// l'ecran Trajet invite explicitement a fermer l'app ("Tu peux fermer
// l'app."). La bannière de retour a l'accueil confirme l'arrivee sans jamais
// passer par le bilan : le moteur d'apprentissage restait vide dans le
// parcours nominal.
//
// Le correctif deplace l'ecriture des durees au fil de l'eau (recordDurations,
// appelee a chaque confirmation) au lieu de l'attendre a la fin (onFeedback).
// Le bilan declaratif ne conditionne plus que recordOutcome (latenessScore,
// history).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { recordDurations, recordOutcome } from '../js/predict.js';
import {
  defaultState, startPendingSession, clearPendingSession, purgePendingSession,
  PENDING_SESSION_PURGE_MS,
} from '../js/store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function freshState() {
  const state = defaultState();
  return state;
}

test('B1 : recordDurations ecrit dans step.real independamment du bilan', () => {
  const state = freshState();
  const profileId = state.activeProfileId;
  const ctx = { day: 1, type: 'work', profileId };

  recordDurations(state, [{ stepKey: 'shower', v: 18 }], ctx);

  const profile = state.profiles.find((p) => p.id === profileId);
  const shower = profile.steps.find((s) => s.key === 'shower');
  assert.deepEqual(shower.real, [{ v: 18, day: 1, type: 'work' }]);
  // recordDurations seul ne touche ni history ni latenessScore.
  assert.equal(state.history.length, 0);
  assert.equal(state.latenessScore, 0.5);
});

test('B1 : une session confirmee etape par etape, puis "l\'app ferme" (etat recharge), garde les mesures', () => {
  let state = freshState();
  const profileId = state.activeProfileId;
  const ctx = { day: 2, type: 'work', profileId };

  // Simule confirmNext() : chaque confirmation ecrit et "persiste" (on
  // serialise/deserialise l'etat entre chaque etape, comme le ferait un
  // aller-retour localStorage reel).
  const confirmedSteps = ['wakeup', 'shower', 'outfit'];
  for (const stepKey of confirmedSteps) {
    recordDurations(state, [{ stepKey, v: 10 }], ctx);
    state = JSON.parse(JSON.stringify(state)); // "fermeture" et rechargement de l'app
  }

  // L'app est fermee ici (ecran Trajet, "Tu peux fermer l'app.") : aucun
  // bilan n'est jamais soumis. Les mesures doivent deja etre la.
  const profile = state.profiles.find((p) => p.id === profileId);
  for (const stepKey of confirmedSteps) {
    const step = profile.steps.find((s) => s.key === stepKey);
    assert.equal(step.real.length, 1, `${stepKey} n'a pas ete mesuree`);
    assert.equal(step.real[0].v, 10);
  }
});

test('B1 : une etape polluee par un imprevu (F6) n\'ecrit toujours rien (R3)', () => {
  const state = freshState();
  const profileId = state.activeProfileId;
  const ctx = { day: 1, type: 'work', profileId };

  // confirmNext() ne pousse dans measurements/recordDurations que si
  // !live.polluted : une etape polluee ne doit jamais atteindre recordDurations.
  // On verifie ici le contrat de recordDurations lui-meme : un appel avec un
  // tableau vide (equivalent a "rien n'a ete collecte pour cette etape") ne
  // touche pas step.real.
  recordDurations(state, [], ctx);
  const profile = state.profiles.find((p) => p.id === profileId);
  for (const step of profile.steps) {
    assert.equal(step.real.length, 0);
  }
});

test('B1 : une session abandonnee ecrit seulement les etapes deja confirmees', () => {
  let state = freshState();
  const profileId = state.activeProfileId;
  const ctx = { day: 3, type: 'work', profileId };

  recordDurations(state, [{ stepKey: 'wakeup', v: 5 }], ctx);
  state = JSON.parse(JSON.stringify(state));
  recordDurations(state, [{ stepKey: 'shower', v: 20 }], ctx);
  // L'utilisateur abandonne ici (abortLive) : aucune confirmation de plus.

  const profile = state.profiles.find((p) => p.id === profileId);
  assert.equal(profile.steps.find((s) => s.key === 'wakeup').real.length, 1);
  assert.equal(profile.steps.find((s) => s.key === 'shower').real.length, 1);
  assert.equal(profile.steps.find((s) => s.key === 'outfit').real.length, 0);
  assert.equal(profile.steps.find((s) => s.key === 'bag').real.length, 0);
});

test('B1 : recordOutcome ne touche jamais step.real, seulement history et latenessScore', () => {
  const state = freshState();
  const profileId = state.activeProfileId;
  const ctx = { day: 1, type: 'work', profileId };
  recordDurations(state, [{ stepKey: 'wakeup', v: 5 }], ctx);

  const before = JSON.stringify(state.profiles.find((p) => p.id === profileId).steps);
  recordOutcome(state, 'ontime', ctx);
  const after = JSON.stringify(state.profiles.find((p) => p.id === profileId).steps);

  assert.equal(before, after, 'recordOutcome a modifie les etapes');
  assert.equal(state.history.length, 1);
  assert.notEqual(state.latenessScore, 0.5);
});

// J3 (DEC-12) · onFeedback a ete retiree : elle ne composait que
// recordDurations et recordOutcome, et plus aucun code de production ne
// l'appelait depuis B1. Seuls des tests la maintenaient en vie.
test('J3 : onFeedback n\'existe plus dans le moteur', async () => {
  const mod = await import('../js/predict.js');
  assert.equal('onFeedback' in mod, false,
    'du code de production que seuls les tests appellent n\'est pas du code de production');
});

test('B1 : pendingSession vieux de plus de 8h est purge sans ecriture et sans message', () => {
  const state = freshState();
  const ctx = { day: 1, type: 'work', profileId: state.activeProfileId };
  const oldTs = Date.now() - PENDING_SESSION_PURGE_MS - 60000; // 8h et 1 min
  startPendingSession(state, state.activeProfileId, ctx, oldTs);

  const purged = purgePendingSession(state, Date.now());
  assert.equal(purged, true);
  assert.equal(state.pendingSession, null);
});

test('B1 : pendingSession recent n\'est pas purge', () => {
  const state = freshState();
  const ctx = { day: 1, type: 'work', profileId: state.activeProfileId };
  startPendingSession(state, state.activeProfileId, ctx, Date.now() - 60000); // 1 min

  const purged = purgePendingSession(state, Date.now());
  assert.equal(purged, false);
  assert.notEqual(state.pendingSession, null);
});

test('B1 : clearPendingSession efface le marqueur explicitement (fin de session normale)', () => {
  const state = freshState();
  const ctx = { day: 1, type: 'work', profileId: state.activeProfileId };
  startPendingSession(state, state.activeProfileId, ctx);
  assert.notEqual(state.pendingSession, null);
  clearPendingSession(state);
  assert.equal(state.pendingSession, null);
});

test('B1 : confirmNext appelle recordDurations, pas onFeedback', () => {
  // Verification statique légère : le point d'ecriture au fil de l'eau doit
  // exister dans le module de rendu, sans reintroduire l'ancien onFeedback
  // qui ne s'executait qu'au bilan. confirmNext vit depuis la découpe J1
  // étape 4 dans live/controller.js, plus dans ui.js (Nour, R1 §1.4).
  const src = fs.readFileSync(path.join(__dirname, '../js/live/controller.js'), 'utf8');
  assert.match(src, /recordDurations\(/, 'confirmNext ne persiste plus les mesures au fil de l\'eau');
  assert.doesNotMatch(src, /\bonFeedback\(/, 'confirmNext appelle encore onFeedback : le bilan conditionne de nouveau les mesures');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { startTrip, tripStatus, confirmArrival, purgeExpiredTrip, addDestination } from '../js/travel.js';

const MIN = 60000;

function freshState() {
  return { destinations: [], profiles: [], pendingTrip: null };
}

test('mesure ecrite uniquement dans [5, 180] minutes', () => {
  for (const [minutes, expected] of [[2, false], [5, true], [90, true], [180, true], [181, false]]) {
    const state = freshState();
    const dest = addDestination(state, 'Bureau');
    const t0 = Date.now();
    startTrip(state, dest.id, 'bike', t0);
    const ok = confirmArrival(state, t0 + minutes * MIN);
    assert.equal(ok, expected, `${minutes} min`);
    const real = dest.byTransport.bike?.real || [];
    assert.equal(real.length, expected ? 1 : 0);
    if (expected) assert.equal(real[0].v, minutes);
    // Le trajet est consomme dans tous les cas
    assert.equal(state.pendingTrip, null);
  }
});

test('FIFO 8 mesures par destination et transport', () => {
  const state = freshState();
  const dest = addDestination(state, 'Salle');
  for (let i = 0; i < 10; i++) {
    const t0 = Date.now();
    startTrip(state, dest.id, 'car', t0);
    confirmArrival(state, t0 + (10 + i) * MIN);
  }
  const real = dest.byTransport.car.real;
  assert.equal(real.length, 8);
  assert.equal(real[0].v, 12); // les deux plus anciennes sont sorties
});

test('pendingTrip purge apres 4h, aucune ecriture', () => {
  const state = freshState();
  const dest = addDestination(state, 'Gare');
  const t0 = Date.now();
  startTrip(state, dest.id, 'transit', t0);
  assert.equal(tripStatus(state.pendingTrip, t0 + 241 * MIN).status, 'expired');
  assert.equal(purgeExpiredTrip(state, t0 + 241 * MIN), true);
  assert.equal(state.pendingTrip, null);
  assert.equal(dest.byTransport.transit, undefined);
});

test('tripStatus : trop court avant 5 min, ouvert ensuite', () => {
  const t0 = Date.now();
  const trip = { leaveTs: t0, destinationId: 'x', transport: 'walk' };
  assert.equal(tripStatus(trip, t0 + 2 * MIN).status, 'short');
  assert.equal(tripStatus(trip, t0 + 6 * MIN).status, 'open');
  assert.equal(tripStatus(null).status, 'none');
});

test('destination supprimee : confirmation sans ecriture, sans erreur', () => {
  const state = freshState();
  const t0 = Date.now();
  startTrip(state, 'dest_disparue', 'walk', t0);
  assert.equal(confirmArrival(state, t0 + 20 * MIN), false);
});

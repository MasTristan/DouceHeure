import test from 'node:test';
import assert from 'node:assert/strict';
import { nextWakeTimestamp, bedsidePhase, missedWake, armBedside, disarmBedside } from '../js/bedside.js';

const MIN = 60000;

test('nextWakeTimestamp : aujourd\'hui si devant nous, sinon demain', () => {
  const now = new Date(2026, 5, 10, 22, 0).getTime();
  const ts = nextWakeTimestamp('07:30', now);
  const d = new Date(ts);
  assert.equal(d.getHours(), 7);
  assert.equal(d.getMinutes(), 30);
  assert.equal(d.getDate(), 11); // le lendemain
  const tsToday = nextWakeTimestamp('23:00', now);
  assert.equal(new Date(tsToday).getDate(), 10);
});

test('bedsidePhase : nuit, aube progressive, reveil', () => {
  const wakeTs = new Date(2026, 5, 11, 7, 0).getTime();
  assert.equal(bedsidePhase(wakeTs, 10, wakeTs - 60 * MIN).phase, 'night');
  const mid = bedsidePhase(wakeTs, 10, wakeTs - 5 * MIN);
  assert.equal(mid.phase, 'dawn');
  assert.ok(Math.abs(mid.progress - 0.5) < 0.01);
  assert.equal(bedsidePhase(wakeTs, 10, wakeTs).phase, 'wake');
  // Onglet gele puis degele bien apres l'heure : toujours 'wake', pas de derive
  assert.equal(bedsidePhase(wakeTs, 10, wakeTs + 30 * MIN).phase, 'wake');
});

test('missedWake : fenetre [wake, wake + 60 min] seulement', () => {
  const bedside = { wakeTime: '07:00', profileId: 'p', lightLeadMin: 10, sound: true };
  const now = new Date(2026, 5, 10, 22, 0).getTime();
  const wakeTs = armBedside(bedside, now);
  assert.equal(missedWake(bedside, wakeTs - MIN), false);
  assert.equal(missedWake(bedside, wakeTs + 30 * MIN), true);
  assert.equal(missedWake(bedside, wakeTs + 61 * MIN), false);
  disarmBedside(bedside);
  assert.equal(missedWake(bedside, wakeTs + 30 * MIN), false);
});

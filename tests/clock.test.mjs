// S1 étape 2 (ADR-004) · Horloge injectable. L'horloge factice est un
// mini-moteur de temporisation maison (zéro dépendance, cf. ADR-001) : ces
// tests le valident intégralement avant qu'il ne serve de fondation au
// harnais anti bug de la douche.
import test from 'node:test';
import assert from 'node:assert/strict';
import { clock, resetClock, installFakeClock } from '../js/clock.js';

test.afterEach(() => resetClock());

test('mode reel : now() delegue a Date.now()', () => {
  const before = Date.now();
  const t = clock.now();
  const after = Date.now();
  assert.ok(t >= before && t <= after);
});

test('mode reel : setTimeout/clearTimeout delegue aux vraies globales', async () => {
  let fired = false;
  const id = clock.setTimeout(() => { fired = true; }, 5);
  clock.clearTimeout(id);
  await new Promise((r) => setTimeout(r, 15));
  assert.equal(fired, false);
});

test('horloge factice : now() ne bouge que sur tick()', () => {
  const fake = installFakeClock(1000);
  assert.equal(clock.now(), 1000);
  fake.tick(500);
  assert.equal(clock.now(), 1500);
  assert.equal(fake.now(), 1500);
});

test('horloge factice : setTimeout se declenche exactement une fois a echeance', () => {
  const fake = installFakeClock(0);
  let fired = 0;
  clock.setTimeout(() => fired++, 1000);
  fake.tick(999);
  assert.equal(fired, 0, 'declenche en avance');
  fake.tick(1);
  assert.equal(fired, 1);
  fake.tick(100000);
  assert.equal(fired, 1, 'un setTimeout se redeclenche a tort');
});

test('horloge factice : setInterval se redeclenche a chaque echeance et se reprogramme', () => {
  const fake = installFakeClock(0);
  let fired = 0;
  clock.setInterval(() => fired++, 5000);
  fake.tick(4999);
  assert.equal(fired, 0);
  fake.tick(1);
  assert.equal(fired, 1);
  fake.tick(15000); // 3 echeances supplementaires : 10000, 15000, 20000
  assert.equal(fired, 4);
});

test('horloge factice : clearInterval arrete definitivement les declenchements', () => {
  const fake = installFakeClock(0);
  let fired = 0;
  const id = clock.setInterval(() => fired++, 1000);
  fake.tick(2500);
  assert.equal(fired, 2);
  clock.clearInterval(id);
  fake.tick(10000);
  assert.equal(fired, 2, 'l\'intervalle a continue apres clearInterval');
});

test('horloge factice : plusieurs minuteurs se declenchent dans l\'ordre de leur echeance', () => {
  const fake = installFakeClock(0);
  const order = [];
  clock.setTimeout(() => order.push('b-2000'), 2000);
  clock.setTimeout(() => order.push('a-500'), 500);
  clock.setTimeout(() => order.push('c-1500'), 1500);
  fake.tick(3000);
  assert.deepEqual(order, ['a-500', 'c-1500', 'b-2000']);
});

test('horloge factice : un minuteur programme pendant tick() (echeance courte) est aussi traite dans le meme tick', () => {
  const fake = installFakeClock(0);
  const order = [];
  clock.setTimeout(() => {
    order.push('premier');
    clock.setTimeout(() => order.push('second, programme depuis le premier'), 100);
  }, 500);
  fake.tick(1000);
  assert.deepEqual(order, ['premier', 'second, programme depuis le premier']);
});

test('resetClock() restaure le mode reel apres une horloge factice', () => {
  installFakeClock(0);
  assert.equal(clock.now(), 0);
  resetClock();
  assert.ok(clock.now() > 1000000000000); // timestamp reel plausible
});

test('pendingCount() reflete le nombre de minuteurs en attente', () => {
  const fake = installFakeClock(0);
  assert.equal(fake.pendingCount(), 0);
  clock.setTimeout(() => {}, 100);
  clock.setTimeout(() => {}, 200);
  assert.equal(fake.pendingCount(), 2);
  fake.tick(150);
  assert.equal(fake.pendingCount(), 1);
});

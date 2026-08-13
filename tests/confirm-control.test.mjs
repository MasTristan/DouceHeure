// B2/B3 · Machine d'etat pure du geste de confirmation. Pas de DOM : ces
// tests prouvent le contrat que holdButton() et les ecrans du chevet
// cablent ensuite sur de vrais evenements. Delais reels tres courts
// (holdMs parametrable) plutot que des timers simules, pour rester sur des
// APIs Node stables (cf. ADR-001).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createConfirmControl, ASSIST_WINDOW_MS } from '../js/confirm-control.js';

function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

test('maintien : confirme apres holdMs de pression continue', async () => {
  let count = 0;
  const c = createConfirmControl({ onConfirm: () => count++, holdMs: 20 });
  c.pointerDown();
  await wait(35);
  assert.equal(count, 1);
});

test('appui interrompu : relache avant holdMs, aucune confirmation (R2/R3)', async () => {
  let count = 0;
  const c = createConfirmControl({ onConfirm: () => count++, holdMs: 30 });
  c.pointerDown();
  await wait(10);
  c.pointerUp();
  await wait(40);
  assert.equal(count, 0);
});

test('B2 : Espace maintenu (keydown puis keyup) n\'avance que d\'une etape', async () => {
  let count = 0;
  const c = createConfirmControl({ onConfirm: () => count++, holdMs: 20 });
  c.keyDown({ key: ' ', repeat: false });
  await wait(35);
  c.keyUp();
  assert.equal(count, 1);
});

test('B2 : une rafale de keydown avec repeat:true n\'avance rien au-dela de la premiere', async () => {
  let count = 0;
  const c = createConfirmControl({ onConfirm: () => count++, holdMs: 20 });
  c.keyDown({ key: 'Enter', repeat: false }); // arme
  // repetition automatique du systeme d'exploitation, des dizaines de fois
  for (let i = 0; i < 50; i++) c.keyDown({ key: 'Enter', repeat: true });
  await wait(35);
  assert.equal(count, 1, 'la repetition automatique a fait avancer plus d\'une etape');
});

test('B2 : keyup avant holdMs annule, comme un appui interrompu', async () => {
  let count = 0;
  const c = createConfirmControl({ onConfirm: () => count++, holdMs: 30 });
  c.keyDown({ key: 'Enter', repeat: false });
  await wait(10);
  c.keyUp();
  await wait(40);
  assert.equal(count, 0);
});

test('B3 : un click synthetique isole n\'avance rien', () => {
  let count = 0;
  let armed = 0;
  const c = createConfirmControl({ onConfirm: () => count++, onArm: () => armed++ });
  c.click();
  assert.equal(count, 0);
  assert.equal(armed, 1);
});

test('B3 : deux clicks synthetiques en moins de 8s avancent d\'exactement une etape', () => {
  let count = 0;
  let t = 1000;
  const c = createConfirmControl({ onConfirm: () => count++, now: () => t });
  c.click(); // arme
  t += 500;
  c.click(); // valide
  assert.equal(count, 1);
  // Un troisieme click isole ne doit pas re-confirmer tout seul.
  t += 500;
  c.click();
  assert.equal(count, 1);
});

test('B3 : deux clicks separes de plus de ASSIST_WINDOW_MS ne confirment pas, ils rearment', () => {
  let count = 0;
  let t = 0;
  const c = createConfirmControl({ onConfirm: () => count++, now: () => t });
  c.click();
  t += ASSIST_WINDOW_MS + 1;
  c.click();
  assert.equal(count, 0, 'la fenetre d\'activation assistive ne doit pas rester ouverte indefiniment');
});

test('mode tap : un seul click confirme (option de motricite, DEC-08)', () => {
  let count = 0;
  const c = createConfirmControl({ onConfirm: () => count++, mode: 'tap' });
  c.click();
  assert.equal(count, 1);
});

test('mode tap : le pointerdown/maintien n\'a aucun effet, seul le click confirme', async () => {
  let count = 0;
  const c = createConfirmControl({ onConfirm: () => count++, mode: 'tap', holdMs: 10 });
  c.pointerDown();
  await wait(25);
  assert.equal(count, 0);
});

test('une confirmation par maintien desarme l\'etat assistif residuel', async () => {
  let count = 0;
  const c = createConfirmControl({ onConfirm: () => count++, holdMs: 15 });
  c.click(); // arme le chemin assistif
  c.pointerDown();
  await wait(25); // confirme via le maintien
  assert.equal(count, 1);
  // Un click errant juste apres ne doit pas re-confirmer immediatement :
  // l'armement assistif a ete remis a zero par la confirmation par maintien.
  c.click();
  assert.equal(count, 1);
});

test('reset() desarme tout sans confirmer', async () => {
  let count = 0;
  const c = createConfirmControl({ onConfirm: () => count++, holdMs: 15 });
  c.pointerDown();
  c.click();
  c.reset();
  await wait(30);
  c.click();
  assert.equal(count, 0);
});

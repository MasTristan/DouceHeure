import test from 'node:test';
import assert from 'node:assert/strict';
import { COPY, UI } from '../js/copy.js';

// Recette §19 : aucun compte à rebours, durée restante ou retard chiffré
// dans aucune chaîne affichable ni prononçable. La marge invisible et le
// seuil de rattrapage n'apparaissent dans aucune chaîne.

function allStrings() {
  const out = [];
  const walk = (v, key) => {
    if (typeof v === 'string') out.push({ key, text: v });
    else if (Array.isArray(v)) v.forEach((x) => walk(x, key));
    else if (typeof v === 'function') {
      // Arguments génériques plausibles : heure, libellé, nombre.
      try { walk(v('08:00', 'lundi'), key); } catch { /* signature differente */ }
      try { walk(v(3), key); } catch { /* idem */ }
    }
  };
  for (const [key, v] of Object.entries(COPY)) walk(v, `COPY.${key}`);
  for (const [key, v] of Object.entries(UI)) walk(v, `UI.${key}`);
  return out;
}

test('R1 : aucune duree restante ni compte a rebours dans les chaines', () => {
  const forbidden = [
    /il (te )?reste/i,
    /min(utes)? restantes?/i,
    /compte [aà] rebours/i,
    /encore \d+ ?min/i,
    /dans \d+ ?min/i,
    /\d+ ?min(utes)? de retard/i,
    /retard de \d+/i,
    /tu as perdu/i,
  ];
  for (const { key, text } of allStrings()) {
    for (const re of forbidden) {
      assert.ok(!re.test(text), `${key} contient une formulation interdite : "${text}"`);
    }
  }
});

test('R4 : la marge et le seuil de rattrapage ne sont jamais nommes', () => {
  for (const { key, text } of allStrings()) {
    assert.ok(!/marge/i.test(text), `${key} nomme la marge : "${text}"`);
    assert.ok(!/seuil/i.test(text), `${key} nomme le seuil : "${text}"`);
  }
});

test('R5 : pas de vocabulaire culpabilisant', () => {
  const forbidden = [/échec/i, /raté[!.]/i, /trop tard/i, /encore en retard/i];
  for (const { key, text } of allStrings()) {
    for (const re of forbidden) {
      assert.ok(!re.test(text), `${key} : "${text}"`);
    }
  }
});

test('Pas de tiret cadratin nulle part dans les textes', () => {
  for (const { key, text } of allStrings()) {
    assert.ok(!text.includes('—'), `${key} contient un tiret cadratin`);
  }
});

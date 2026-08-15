// J1 étape 8 (DEC-03) · La feuille de confirmation remplace les dialogues
// natifs. Deux familles de tests :
//
// 1. Un test structurel qui interdit le retour d'un `confirm()`/`prompt()`
//    dans tout `js/`. C'est le test bloquant de S2 §8, et c'est celui qui a
//    de la valeur dans six mois : un dialogue natif est bloquant et non
//    simulable, donc il rend une zone du produit inatteignable par la
//    qualité. La règle doit être mécanique, pas une consigne de revue.
// 2. Des tests de comportement sur le composant lui-même, sous tiny-dom.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { installTinyDom, byClass, findWhere, findAllWhere, allText } from './tiny-dom.mjs';

const sheets = (body) => findAllWhere(body, (n) => n.classList.contains('sheet'));

function jsFiles(dir = 'js') {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...jsFiles(path));
    else if (entry.endsWith('.js')) out.push(path);
  }
  return out;
}

// Retire les commentaires de ligne et de bloc : ils mentionnent
// légitimement "confirm()" en prose pour documenter ce qui a été retiré.
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n');
}

test('S2 §8 : aucun confirm(), prompt() ni alert() natif dans js/', () => {
  const offenders = [];
  for (const file of jsFiles()) {
    const src = stripComments(readFileSync(file, 'utf8'));
    // Le préfixe négatif écarte askConfirm(, control.confirm(, etc. : on ne
    // vise que l'appel nu à la globale du navigateur.
    const matches = src.match(/(?<![.\w$])(confirm|prompt|alert)\s*\(/g) || [];
    if (matches.length) offenders.push(`${file} : ${matches.join(', ')}`);
  }
  assert.deepEqual(offenders, [],
    'un dialogue natif est bloquant et non simulable : passer par js/ui/sheet.js');
});

test('askConfirm : rend true a la validation, false au renoncement', async () => {
  const dom = installTinyDom();
  const { askConfirm } = await import('../js/ui/sheet.js');

  const validated = askConfirm({ title: 'Supprimer ce depart ?', confirmLabel: 'Supprimer' });
  const confirmBtn = findWhere(dom.document.body, (n) => n.textContent === 'Supprimer');
  assert.ok(confirmBtn, 'le bouton de validation doit porter le libelle propre a la question');
  dom.fireEvent(confirmBtn, 'click');
  assert.equal(await validated, true);

  const renounced = askConfirm({ title: 'Supprimer ce depart ?', confirmLabel: 'Supprimer', cancelLabel: 'Garder' });
  const cancelBtn = findWhere(dom.document.body, (n) => n.textContent === 'Garder');
  dom.fireEvent(cancelBtn, 'click');
  assert.equal(await renounced, false);
});

test('askConfirm : la feuille disparait du DOM une fois repondue', async () => {
  const dom = installTinyDom();
  const { askConfirm, isSheetOpen } = await import('../js/ui/sheet.js');

  const pending = askConfirm({ title: 'Quitter le mode chevet ?', confirmLabel: 'Quitter' });
  assert.ok(sheets(dom.document.body).length === 1, 'la feuille doit etre montee dans le body');
  assert.equal(isSheetOpen(), true);

  dom.fireEvent(findWhere(dom.document.body, (n) => n.textContent === 'Quitter'), 'click');
  await pending;

  assert.equal(sheets(dom.document.body).length, 0, 'la feuille doit etre retiree du DOM');
  assert.equal(isSheetOpen(), false);
});

test('askConfirm : Echap vaut renoncement', async () => {
  const dom = installTinyDom();
  const { askConfirm } = await import('../js/ui/sheet.js');

  const pending = askConfirm({ title: 'Remplacer toutes les donnees actuelles ?', confirmLabel: 'Remplacer' });
  const overlay = byClass(dom.document.body, 'sheet');
  dom.fireEvent(overlay, 'keydown', { key: 'Escape' });
  assert.equal(await pending, false, 'Echap doit renoncer, jamais valider');
});

test('askConfirm : le focus part sur le renoncement, pas sur l\'action destructrice', async () => {
  const dom = installTinyDom();
  const { askConfirm, closeSheet } = await import('../js/ui/sheet.js');

  askConfirm({ title: 'Supprimer ce depart ?', confirmLabel: 'Supprimer', cancelLabel: 'Garder', danger: true });
  assert.equal(dom.document.activeElement?.textContent, 'Garder',
    'a 3h du matin comme ailleurs, le geste le plus facile doit etre celui qui ne detruit rien');
  closeSheet();
});

test('askConfirm : le focus revient d\'ou il vient a la fermeture', async () => {
  const dom = installTinyDom();
  const { askConfirm } = await import('../js/ui/sheet.js');

  const opener = dom.document.createElement('button');
  dom.app.appendChild(opener);
  opener.focus();
  assert.equal(dom.document.activeElement, opener);

  const pending = askConfirm({ title: 'Quitter ?', confirmLabel: 'Quitter' });
  assert.notEqual(dom.document.activeElement, opener, 'la feuille prend le focus a l\'ouverture');

  dom.fireEvent(byClass(dom.document.body, 'sheet'), 'keydown', { key: 'Escape' });
  await pending;
  assert.equal(dom.document.activeElement, opener,
    'sans restauration, un utilisateur au clavier ou a la synthese vocale est renvoye en haut de page');
});

test('askConfirm : la tabulation tourne a l\'interieur de la feuille', async () => {
  const dom = installTinyDom();
  const { askConfirm, closeSheet } = await import('../js/ui/sheet.js');

  askConfirm({ title: 'Quitter ?', confirmLabel: 'Quitter', cancelLabel: 'Rester' });
  const overlay = byClass(dom.document.body, 'sheet');

  assert.equal(dom.document.activeElement.textContent, 'Rester');
  dom.fireEvent(overlay, 'keydown', { key: 'Tab' });
  assert.equal(dom.document.activeElement.textContent, 'Quitter');
  dom.fireEvent(overlay, 'keydown', { key: 'Tab' });
  assert.equal(dom.document.activeElement.textContent, 'Rester', 'la tabulation doit boucler, pas sortir derriere le voile');
  dom.fireEvent(overlay, 'keydown', { key: 'Tab', shiftKey: true });
  assert.equal(dom.document.activeElement.textContent, 'Quitter', 'Maj+Tab doit remonter');
  closeSheet();
});

test('askText : rend la saisie nettoyee, null au renoncement', async () => {
  const dom = installTinyDom();
  const { askText } = await import('../js/ui/sheet.js');

  const pending = askText({ title: 'Un nom pour cette destination ?', confirmLabel: 'Ajouter' });
  const input = byClass(dom.document.body, 'sheet__input');
  assert.ok(input, 'la feuille de saisie doit exposer un champ');
  input.value = '  Le bureau  ';
  dom.fireEvent(findWhere(dom.document.body, (n) => n.textContent === 'Ajouter'), 'click');
  assert.equal(await pending, 'Le bureau');

  const renounced = askText({ title: 'Un nom pour cette destination ?', confirmLabel: 'Ajouter' });
  dom.fireEvent(byClass(dom.document.body, 'sheet'), 'keydown', { key: 'Escape' });
  assert.equal(await renounced, null, 'renoncer a une saisie rend null, pas une chaine vide');
});

test('askText : une saisie vide ne ferme pas la feuille', async () => {
  const dom = installTinyDom();
  const { askText, closeSheet } = await import('../js/ui/sheet.js');

  askText({ title: 'Un nom pour cette destination ?', confirmLabel: 'Ajouter' });
  const input = byClass(dom.document.body, 'sheet__input');
  input.value = '   ';
  dom.fireEvent(findWhere(dom.document.body, (n) => n.textContent === 'Ajouter'), 'click');

  assert.equal(sheets(dom.document.body).length, 1,
    'valider a vide n\'est pas un renoncement : la feuille reste ouverte');
  closeSheet();
});

test('askText : Entree depuis le champ vaut validation', async () => {
  const dom = installTinyDom();
  const { askText } = await import('../js/ui/sheet.js');

  const pending = askText({ title: 'Un nom pour cette destination ?', confirmLabel: 'Ajouter' });
  const overlay = byClass(dom.document.body, 'sheet');
  byClass(dom.document.body, 'sheet__input').value = 'La creche';
  dom.fireEvent(overlay, 'keydown', { key: 'Enter' });
  assert.equal(await pending, 'La creche');
});

test('une seconde demande annule la premiere plutot que d\'empiler deux voiles', async () => {
  const dom = installTinyDom();
  const { askConfirm, closeSheet } = await import('../js/ui/sheet.js');

  const first = askConfirm({ title: 'Premiere question ?', confirmLabel: 'Oui' });
  askConfirm({ title: 'Seconde question ?', confirmLabel: 'Oui' });

  assert.equal(await first, false, 'la premiere demande se resout en renoncement');
  assert.equal(sheets(dom.document.body).length, 1, 'une seule feuille a la fois');
  assert.ok(allText(dom.document.body).includes('Seconde question ?'));
  closeSheet();
});

test('la feuille expose un dialogue nomme pour les technologies d\'assistance', async () => {
  const dom = installTinyDom();
  const { askConfirm, closeSheet } = await import('../js/ui/sheet.js');

  askConfirm({ title: 'Quitter le mode chevet ?', confirmLabel: 'Quitter' });
  const panel = byClass(dom.document.body, 'sheet__panel');
  assert.equal(panel.getAttribute('role'), 'dialog');
  assert.equal(panel.getAttribute('aria-modal'), 'true');
  const labelledBy = panel.getAttribute('aria-labelledby');
  assert.ok(labelledBy, 'la feuille doit porter un nom accessible');
  const title = findWhere(panel, (n) => n.getAttribute?.('id') === labelledBy);
  assert.equal(title.textContent, 'Quitter le mode chevet ?');
  closeSheet();
});

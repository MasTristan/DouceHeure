// J1 étape 8 (DEC-03) · La feuille de confirmation, non bloquante.
//
// Remplace les cinq `confirm()` et `prompt()` natifs qui restaient dans
// l'app. L'argument qui a fait descendre ce chantier de J4 vers J1 n'est
// pas esthétique, il est technique : un dialogue natif est bloquant et non
// simulable, donc c'est un mur au milieu d'un chemin de test. Les cinq se
// trouvaient pile sur les deux chemins les plus destructeurs du produit,
// perdre sa nuit (sortie du chevet) et perdre ses données (import).
//
// Version minimale et vérifiable de J1. La forme définitive (animation,
// ergonomie à une main, variantes) revient à J4.
//
// Aucune règle de calcul ici, aucune chaîne en dur : tout vient de copy.js.

import { el } from './dom.js';
import { UI } from '../copy.js';

// Une seule feuille ouverte à la fois. Une seconde demande annule la
// première plutôt que d'empiler deux couches modales l'une sur l'autre.
let current = null;

export function isSheetOpen() {
  return current !== null;
}

// Ferme la feuille ouverte, s'il y en a une, comme si l'utilisateur avait
// annulé. Utilisé par la navigation (quitter un écran ne doit pas laisser
// une feuille orpheline) et par les tests.
export function closeSheet() {
  if (current) current.cancel();
}

function open({ title, body, input, confirmLabel, cancelLabel, danger }) {
  closeSheet();

  // Le focus revient d'où il vient à la fermeture : sans ça, un utilisateur
  // au clavier ou à la synthèse vocale est renvoyé en haut de la page.
  const previousFocus = document.activeElement || null;

  return new Promise((resolve) => {
    let settled = false;

    // `input` distingue les deux formes de réponse : une question fermée
    // rend un booléen, une saisie rend une chaîne ou null si on renonce.
    const emptyAnswer = input ? null : false;

    function finish(value) {
      if (settled) return;
      settled = true;
      overlay.remove();
      current = null;
      if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus();
      resolve(value);
    }

    function submit() {
      if (!input) return finish(true);
      const text = String(inputNode.value || '').trim();
      // Une saisie vide n'est pas une réponse : la feuille reste ouverte
      // plutôt que de fermer sur un renoncement que l'utilisateur n'a pas
      // exprimé.
      if (!text) return inputNode.focus();
      finish(text);
    }

    const titleId = 'sheet-title';

    const inputNode = input
      ? el('input', {
          class: 'text-input sheet__input',
          type: 'text',
          value: input.value || '',
          placeholder: input.placeholder || '',
          'aria-labelledby': titleId,
        })
      : null;

    const cancelBtn = el('button', {
      class: 'btn btn--ghost sheet__action',
      onclick: () => finish(emptyAnswer),
    }, cancelLabel || UI.sheet_cancel);

    const confirmBtn = el('button', {
      class: `btn ${danger ? 'btn--soft' : 'btn--primary'} sheet__action`,
      onclick: submit,
    }, confirmLabel);

    const panel = el('div', {
      class: 'sheet__panel',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': titleId,
    }, [
      el('div', { class: 'sheet__handle', 'aria-hidden': 'true' }),
      el('h2', { class: 't-title', id: titleId }, title),
      body ? el('p', { class: 't-body t-body--sm', style: 'margin-top:6px' }, body) : null,
      inputNode ? el('div', { class: 'spacer-sm' }) : null,
      inputNode,
      el('div', { class: 'spacer-sm' }),
      el('div', { class: 'sheet__actions' }, [cancelBtn, confirmBtn]),
    ]);

    const overlay = el('div', {
      class: 'sheet',
      // Toucher le voile hors de la feuille vaut renoncement, comme Échap.
      onclick: (e) => { if (e.target === overlay) finish(emptyAnswer); },
    }, [panel]);

    // Piège de focus : tant que la feuille est ouverte, la tabulation
    // tourne à l'intérieur. Sans ça, le clavier sort derrière le voile et
    // atteint des boutons que l'utilisateur ne voit plus.
    const focusables = () => (inputNode ? [inputNode, cancelBtn, confirmBtn] : [cancelBtn, confirmBtn]);

    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        return finish(emptyAnswer);
      }
      if (e.key === 'Enter' && input) {
        e.preventDefault();
        return submit();
      }
      if (e.key !== 'Tab') return;
      e.preventDefault();
      const list = focusables();
      const idx = list.indexOf(document.activeElement);
      const dir = e.shiftKey ? -1 : 1;
      const nextIdx = idx === -1 ? 0 : (idx + dir + list.length) % list.length;
      list[nextIdx].focus();
    });

    document.body.appendChild(overlay);
    current = { cancel: () => finish(emptyAnswer) };

    // Une saisie place le curseur dans le champ ; une question fermée place
    // le focus sur le renoncement, jamais sur l'action destructrice.
    if (inputNode) inputNode.focus();
    else cancelBtn.focus();
  });
}

// Question fermée. Rend `true` si l'utilisateur valide, `false` s'il
// renonce (bouton, Échap, ou voile).
export function askConfirm({ title, body = null, confirmLabel, cancelLabel = UI.sheet_cancel, danger = false }) {
  return open({ title, body, input: null, confirmLabel, cancelLabel, danger });
}

// Saisie de texte. Rend la chaîne saisie, nettoyée de ses espaces de bord,
// ou `null` si l'utilisateur renonce.
export function askText({ title, body = null, value = '', placeholder = '', confirmLabel, cancelLabel = UI.sheet_cancel }) {
  return open({ title, body, input: { value, placeholder }, confirmLabel, cancelLabel, danger: false });
}

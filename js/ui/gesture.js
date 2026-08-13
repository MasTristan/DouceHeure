// J1 découpe étape 4 (préalable, Nour R1 §1.4) · Le geste de confirmation
// (spec v2 §7.2, S2-le-geste.md). Composant socle, pas spécifique au live :
// le mode chevet l'utilise aussi (via confirm-control.js directement pour
// ses propres écrans plein cadre). Aucune dépendance à `live`/`night`.
//
// Un appui interrompu n'avance rien et n'écrit rien (R3). La décision de
// QUAND confirmer vit dans confirm-control.js (pur, testé sans DOM) : cette
// fonction ne fait que câbler de vrais événements dessus et gérer le rendu.
//
// Quatre chemins vers la même garantie (R2 : intentionnel, non ambigu) :
// maintien, clavier (B2 : keydown arme, keyup valide, repeat ignoré),
// assistif (B3 : deux activations click en moins de 8 s, pour VoiceOver et
// Switch Control, dont l'activation ne produit pas de maintien mesurable),
// et tap (option de motricité, DEC-08, pas une réponse d'accessibilité).

import { el } from './dom.js';
import { createConfirmControl } from '../confirm-control.js';
import { clock } from '../clock.js';
import * as haptics from '../haptics.js';

let holdActive = false;

// Lu par le rendu du live pour ne pas détruire un appui en cours (un
// re-rendu du ticker pendant un maintien remplacerait le bouton sous le
// doigt de l'utilisateur).
export function isHoldActive() {
  return holdActive;
}

export function holdButton({ label, onConfirm, mode, cls = '' }) {
  if (mode === 'tap') {
    const control = createConfirmControl({
      mode: 'tap', onConfirm: () => { haptics.buzz('confirm'); onConfirm(); },
      now: clock.now, setTimeoutFn: clock.setTimeout, clearTimeoutFn: clock.clearTimeout,
    });
    return el('button', {
      class: `hold-btn hold-btn--tap ${cls}`,
      onclick: () => control.click(),
    }, [el('span', { class: 'hold-btn__label' }, label)]);
  }

  const btn = el('button', { class: `hold-btn ${cls}`, 'aria-label': label }, [
    el('span', { class: 'hold-btn__fill', 'aria-hidden': 'true' }),
    el('span', { class: 'hold-btn__label' }, label),
  ]);

  // Suit si un maintien ou un clavier est en attente de résolution, pour
  // savoir si un relâchement doit jouer l'animation d'annulation (jamais
  // après une confirmation déjà survenue : pas de "rebond" après succès).
  let holdPending = false;

  function fireConfirm() {
    holdPending = false;
    holdActive = false;
    btn.classList.remove('is-holding', 'is-armed');
    haptics.buzz('confirm');
    onConfirm();
  }

  const control = createConfirmControl({
    onConfirm: fireConfirm,
    onArm: () => {
      // B3 : chemin assistif armé, pas encore confirmé. Retour discret ;
      // le texte prononcé/annoncé définitif reste à écrire dans copy.js
      // (S2-le-geste.md §7, hors périmètre de ce correctif).
      haptics.buzz('tap');
      btn.classList.add('is-armed');
    },
    now: clock.now, setTimeoutFn: clock.setTimeout, clearTimeoutFn: clock.clearTimeout,
  });

  function cancelVisual() {
    if (!holdPending) return; // déjà confirmé ou jamais armé : rien à annuler
    holdPending = false;
    holdActive = false;
    btn.classList.remove('is-holding');
    btn.classList.add('is-spring');
    setTimeout(() => btn.classList.remove('is-spring'), 300);
  }

  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    btn.setPointerCapture(e.pointerId);
    holdActive = true;
    holdPending = true;
    // Remplissage radial depuis le point de contact.
    const rect = btn.getBoundingClientRect();
    btn.style.setProperty('--hold-x', `${((e.clientX - rect.left) / rect.width * 100).toFixed(1)}%`);
    btn.classList.add('is-holding');
    control.pointerDown();
  });
  btn.addEventListener('pointerup', () => { cancelVisual(); control.pointerUp(); });
  btn.addEventListener('pointercancel', () => { cancelVisual(); control.pointerCancel(); });

  // B2 : keydown arme (sauf répétition automatique), keyup valide.
  btn.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    if (!e.repeat) holdPending = true;
    control.keyDown(e);
  });
  btn.addEventListener('keyup', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    cancelVisual();
    control.keyUp();
  });

  // B3 : chemin assistif. Une activation atomique (click) qui n'a pas été
  // précédée d'un maintien mesurable (VoiceOver, Switch Control) passe par
  // le comptage à deux du contrôle plutôt que d'être ignorée ou d'avancer
  // seule, ce qui violerait R2 dans un sens ou dans l'autre.
  btn.addEventListener('click', () => control.click());

  return btn;
}

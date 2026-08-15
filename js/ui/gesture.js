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

import { el, announce } from './dom.js';
import { UI } from '../copy.js';
import { createConfirmControl } from '../confirm-control.js';
import { clock } from '../clock.js';
import * as haptics from '../haptics.js';

let holdActive = false;

// S2 §5 · Le bouton de confirmation n'est JAMAIS remplacé pendant une
// session : son libellé change, son identité DOM non. Remplacer le nœud
// renvoyait le focus clavier et le curseur VoiceOver en haut de page à
// chaque battement du ticker, ce qui faisait de l'atteinte du bouton une
// course contre l'horloge. C'est la seule façon autorisée de changer le
// texte d'un bouton de confirmation déjà monté.
export function setHoldLabel(btn, label) {
  const span = btn.querySelector('.hold-btn__label');
  if (span) span.textContent = label;
  // Le chemin maintien porte un aria-label explicite (le remplissage est
  // en aria-hidden) ; le chemin tap tire son nom de son contenu.
  if (btn.hasAttribute('aria-label')) btn.setAttribute('aria-label', label);
}

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

  // S5 article 5 · L'indice d'activation en deux temps est porté par le
  // bouton lui-même : une technologie d'assistance l'annonce avec le nom
  // du bouton, avant le premier essai, plutôt qu'après coup.
  const btn = el('button', {
    class: `hold-btn ${cls}`, 'aria-label': label, 'aria-description': UI.gesture_assist_hint,
  }, [
    el('span', { class: 'hold-btn__fill', 'aria-hidden': 'true' }),
    el('span', { class: 'hold-btn__label' }, label),
  ]);

  // Suit si un maintien ou un clavier est en attente de résolution, pour
  // savoir si un relâchement doit jouer l'animation d'annulation (jamais
  // après une confirmation déjà survenue : pas de "rebond" après succès).
  let holdPending = false;

  // Aucune annonce à la validation : l'appelant annonce déjà le nouvel
  // état (speakStep, live/controller.js). Deux annonces coup sur coup au
  // moment où la personne enchaine sur l'étape suivante seraient du bruit,
  // et le bruit est précisément ce dont souffre le public visé.
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
      // B3 · Chemin assistif armé, pas encore confirmé. S5 article 5 :
      // l'état armé se voit (is-armed) ET s'entend. Sans l'annonce, une
      // personne sous VoiceOver active, n'obtient rien, et n'a aucun moyen
      // de savoir que l'app attend une seconde activation.
      haptics.buzz('tap');
      btn.classList.add('is-armed');
      announce(UI.gesture_armed);
    },
    now: clock.now, setTimeoutFn: clock.setTimeout, clearTimeoutFn: clock.clearTimeout,
  });

  function cancelVisual() {
    if (!holdPending) return; // déjà confirmé ou jamais armé : rien à annuler
    holdPending = false;
    holdActive = false;
    // S5 article 5 · Un appui interrompu n'avance rien et n'écrit rien
    // (R3). Le dire est le seul moyen, sans voir l'écran, de distinguer
    // « j'ai relâché trop tôt » de « l'app ne répond pas ».
    announce(UI.gesture_released);
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

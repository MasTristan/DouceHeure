// Machine d'état pure du geste de confirmation (S2-le-geste.md, DEC-07/DEC-08).
// Isole la logique d'intention de son câblage DOM, pour que R2 soit testable
// sans navigateur. holdButton() (ui.js) et les écrans du chevet sont un
// câblage DOM mince par-dessus ce module.
//
// R2 : « une confirmation est valide si elle est intentionnelle et non
// ambiguë ». Chaque modalité obtient cette garantie par le moyen qui lui
// convient, aucune n'en est dispensée :
//   - maintien (pointer)  : HOLD_MS de pression continue
//   - clavier              : keydown arme, keyup valide, un keydown avec
//                            repeat (répétition automatique) est ignoré
//   - assistif (click)     : deux activations atomiques distinctes en moins
//                            de ASSIST_WINDOW_MS (VoiceOver, Switch Control)
//   - tap                  : une seule activation atomique suffit (réglage
//                            de motricité, pas une réponse d'accessibilité)
//
// B2 : avant ce module, le clavier confirmait au premier keydown, sans garde
// sur e.repeat, ce qui permettait de traverser une matinée entière touche
// maintenue et de remplir step.real de mesures d'une minute (R3).
// B3 : avant ce module, aucun chemin `click` n'existait en mode hold, donc
// l'activation VoiceOver (pointerdown/pointerup quasi instantanés puis
// click) n'aboutissait jamais.

export const HOLD_MS = 600;
export const ASSIST_WINDOW_MS = 8000;

export function createConfirmControl({ onConfirm, onArm, mode = 'hold', holdMs = HOLD_MS, now = Date.now }) {
  let holdTimer = null;
  let assistArmedAt = null;

  function clearHold() {
    if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
  }

  function confirmViaHold() {
    holdTimer = null;
    assistArmedAt = null; // une confirmation par maintien remet l'etat assistif a plat
    onConfirm();
  }

  function pointerDown() {
    if (mode === 'tap') return; // le tap se confirme au click, pas au maintien
    clearHold();
    holdTimer = setTimeout(confirmViaHold, holdMs);
  }
  function pointerUp() { clearHold(); }
  function pointerCancel() { clearHold(); }

  // B2 : keydown arme le minuteur, keyup valide, une repetition automatique
  // (e.repeat) n'a aucun effet et ne relance pas le minuteur.
  function keyDown(e) {
    if (mode === 'tap') return;
    if (e && e.repeat) return;
    if (holdTimer) return; // deja arme par une pression precedente
    holdTimer = setTimeout(confirmViaHold, holdMs);
  }
  function keyUp() { clearHold(); }

  // B3 : chemin assistif, une activation atomique (click synthetise par une
  // technologie d'assistance, ou un click normal). En mode tap, une seule
  // activation confirme. En mode hold, deux activations distinctes en moins
  // de ASSIST_WINDOW_MS confirment : la premiere arme et peut etre annoncee
  // (onArm), la seconde valide. Un click isole n'avance jamais rien.
  function click() {
    if (mode === 'tap') { onConfirm(); return; }
    const t = now();
    if (assistArmedAt !== null && t - assistArmedAt <= ASSIST_WINDOW_MS) {
      assistArmedAt = null;
      onConfirm();
      return;
    }
    assistArmedAt = t;
    if (onArm) onArm();
  }

  function reset() {
    clearHold();
    assistArmedAt = null;
  }

  return { pointerDown, pointerUp, pointerCancel, keyDown, keyUp, click, reset };
}

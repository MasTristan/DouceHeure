// J1 découpe étape 6 · Trajet (F5). Écran plat : aucune règle de calcul
// (S1 §4).

import { el, wordmark, toast } from '../ui/dom.js';
import { render } from '../ui/shell.js';
import { pick, UI } from '../copy.js';
import { loadState, saveState } from '../store.js';
import { confirmArrival } from '../travel.js';
import * as speech from '../speech.js';
import * as haptics from '../haptics.js';
import { nav } from '../ui/nav.js';

export function showTrip(session) {
  const message = pick('trip_road');
  speech.speak(message);

  const screen = el('main', { class: 'screen' }, [
    wordmark(),
    el('div', { style: 'flex:1' }),
    el('h1', { class: 't-hero', style: 'text-align:center' }, message),
    el('div', { class: 'spacer-md' }),
    el('p', { class: 't-body', style: 'text-align:center' }, UI.trip_close_hint),
    el('div', { style: 'flex:1' }),
    el('button', {
      class: 'btn btn--primary',
      onclick: () => {
        const s = loadState();
        const ok = confirmArrival(s);
        saveState(s);
        haptics.buzz('tap');
        if (ok) toast(UI.trip_label, pick('trip_arrived'));
        nav.feedback(session);
      },
    }, UI.trip_arrived_cta),
    el('div', { class: 'spacer-sm' }),
    el('button', { class: 'btn btn--ghost', onclick: () => nav.feedback(session) }, UI.feedback_label),
  ]);
  render(screen, 'trip');
}

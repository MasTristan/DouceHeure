// J1 découpe étape 6 · Accueil v2 (spec v2 §9). Écran plat, mais c'est le
// carrefour de l'app : toute navigation vers un autre écran plat passe par
// le registre ui/nav.js (jamais d'import direct entre écrans, pour éviter
// un cycle avec ce fichier).

import { el, wordmark, toast } from '../ui/dom.js';
import { render, resetScreen, applySettings } from '../ui/shell.js';
import { UI, pick } from '../copy.js';
import { loadState, saveState, getProfile, nextDepartureProfile } from '../store.js';
import { confirmArrival, tripStatus } from '../travel.js';
import { disarmBedside, missedWake } from '../bedside.js';
import { icon } from '../icons.js';
import * as audio from '../audio.js';
import * as speech from '../speech.js';
import * as haptics from '../haptics.js';
import * as scene from '../scene.js';
import { clock } from '../clock.js';
import { nowMinutes } from '../now.js';
import { showBedsideSetup } from '../night/setup.js';
import { showStudio } from '../studio.js';
import { nav } from '../ui/nav.js';

export function showHome() {
  const state = loadState();
  applySettings(state);
  scene.applyScene(scene.resolveScene(state.settings, new Date().getHours()));
  scene.resetLight();
  speech.cancel();
  audio.stopAmbient();

  const nextProfile = nextDepartureProfile(state, nowMinutes());
  const others = (state.profiles || []).filter((p) => p.id !== nextProfile?.id);
  const isEvening = scene.currentScene() === 'evening';
  const trip = tripStatus(state.pendingTrip);

  const title = state.name ? UI.home_title_with_name(state.name) : UI.home_title_anon;
  const children = [wordmark(), el('div', { class: 'spacer-lg' })];

  // Bannière "Bien arrivé ?" (F5) : trajet en attente confirmable.
  if (trip.status === 'open') {
    children.push(
      el('div', { class: 'card card--accent' }, [
        el('div', { class: 't-title' }, UI.home_arrived_banner),
        el('div', { class: 'spacer-sm' }),
        el('div', { style: 'display:flex; gap:10px' }, [
          el('button', {
            class: 'btn btn--primary', style: 'flex:1',
            onclick: () => {
              const s = loadState();
              const ok = confirmArrival(s);
              saveState(s);
              haptics.buzz('tap');
              if (ok) toast(UI.home_arrived_banner, pick('trip_arrived'));
              showHomeFresh();
            },
          }, UI.home_arrived_yes),
          el('button', {
            class: 'btn btn--ghost', style: 'flex:1',
            onclick: () => {
              // "Pas encore" : on laisse le trajet ouvert, purge automatique après 4h.
              const card = document.querySelector('.card--accent');
              if (card) card.remove();
            },
          }, UI.home_arrived_no),
        ]),
      ]),
      el('div', { class: 'spacer-md' }),
    );
  }

  // Réveil manqué (F1) : l'app a été tuée pendant la nuit.
  if (state.bedside && missedWake(state.bedside, clock.now())) {
    const bsProfile = getProfile(state, state.bedside.profileId) || nextProfile;
    children.push(
      el('div', { class: 'card card--accent' }, [
        el('div', { class: 't-title' }, UI.home_missed_wake),
        el('div', { class: 'spacer-sm' }),
        el('button', {
          class: 'btn btn--primary',
          onclick: () => {
            const s = loadState();
            disarmBedside(s.bedside);
            saveState(s);
            audio.unlock();
            speech.unlock();
            nav.preview(bsProfile?.id);
          },
        }, UI.home_missed_wake_cta),
      ]),
      el('div', { class: 'spacer-md' }),
    );
  }

  children.push(
    el('h1', { class: 't-display' }, title),
    el('div', { class: 'spacer-lg' }),
  );

  // Carte principale : prochain départ.
  if (nextProfile) {
    const stepCount = nextProfile.steps.filter((s) => s.active).length;
    children.push(
      el('div', { class: 'card next-departure' }, [
        el('div', { class: 't-label' }, UI.home_next_label),
        el('div', { class: 'spacer-sm' }),
        el('div', { class: 'next-departure__head' }, [
          icon(nextProfile.icon, 'icon--lg'),
          el('div', {}, [
            el('div', { class: 't-title' }, nextProfile.name),
            el('div', { class: 't-meta' },
              `${stepCount} étapes` + (nextProfile.defaults.arrival ? ` · arrivée ${nextProfile.defaults.arrival}` : '')),
          ]),
        ]),
        el('div', { class: 'spacer-md' }),
        el('button', {
          class: 'btn btn--primary',
          onclick: () => {
            const s = loadState();
            s.activeProfileId = nextProfile.id;
            saveState(s);
            nav.preview(nextProfile.id);
          },
        }, UI.home_next_cta),
      ]),
      el('div', { class: 'spacer-md' }),
    );
  }

  // Pills des autres départs.
  if (others.length) {
    children.push(
      el('div', { style: 'display:flex; gap:8px; flex-wrap:wrap' },
        others.map((p) =>
          el('button', {
            class: 'pill',
            onclick: () => {
              const s = loadState();
              s.activeProfileId = p.id;
              saveState(s);
              nav.preview(p.id);
            },
          }, [icon(p.icon), el('span', {}, p.name)])
        )
      ),
      el('div', { class: 'spacer-md' }),
    );
  }

  // Le soir : carte "Préparer demain" (F1).
  if (isEvening) {
    children.push(
      el('div', { class: 'card card--accent' }, [
        el('div', { class: 't-label' }, UI.home_evening_label),
        el('div', { class: 'spacer-sm' }),
        el('div', { class: 't-title' }, UI.home_evening_title),
        el('p', { class: 't-body t-body--sm', style: 'margin-top:6px' }, UI.home_evening_sub),
        el('div', { class: 'spacer-md' }),
        el('button', { class: 'btn btn--soft', onclick: () => showBedsideSetup() }, UI.bedside_cta),
      ]),
      el('div', { class: 'spacer-md' }),
    );
  }

  children.push(
    el('div', { style: 'flex:1' }),
    el('div', { class: 'home-links' }, [
      el('button', { class: 'btn btn--soft', onclick: () => nav.mornings() }, UI.home_mornings_link),
      el('button', { class: 'btn btn--soft', onclick: showStudio }, UI.home_studio_link),
      el('button', { class: 'btn btn--soft', onclick: () => nav.settings() }, UI.home_settings_link),
    ]),
  );

  render(el('main', { class: 'screen stagger' }, children), 'home');
}

function showHomeFresh() {
  resetScreen();
  showHome();
}

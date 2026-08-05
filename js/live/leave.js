// J1 découpe étape 4 (Nour, R1 §1.4) · Le départ (spec v2 §7.7).

import { el, wordmark, announce } from '../ui/dom.js';
import { render } from '../ui/shell.js';
import { pick, UI } from '../copy.js';
import { fromMin } from '../time.js';
import { loadState, saveState, getProfile } from '../store.js';
import { startTrip } from '../travel.js';
import { MESSAGE_TEMPLATES, sendSignal } from '../social.js';
import * as scene from '../scene.js';
import * as audio from '../audio.js';
import * as speech from '../speech.js';
import * as haptics from '../haptics.js';
import { nav } from '../ui/nav.js';
import { liveNav, registerLive } from './registry.js';

export function renderLeave(slip) {
  const live = liveNav.getLive();
  const state = loadState();
  const profile = getProfile(state, live.profileId);
  const arrivalTxt = UI.leave_arrival(fromMin(live.arrivalMin));

  scene.setLight(1, slip > 2 ? 0.5 : 0.8); // pleine lumière : délivrance (R5)
  audio.setAmbientOpenness(1);

  if (!live.leaveAnnounced) {
    live.leaveAnnounced = true;
    live.leaveMessage = pick('leave');
    announce(`${UI.leave_title}. ${live.leaveMessage}`);
    speech.speak(`${UI.leave_title}. ${live.leaveMessage}`);
  }

  // Checklist du profil : cochable, pas bloquante.
  live.checklist = live.checklist || (profile?.checklist || []).map((c) => ({ ...c, done: false }));
  const checklist = live.checklist.length
    ? el('div', { class: 'card' }, [
        el('div', { class: 't-label' }, UI.leave_checklist_label),
        el('div', { class: 'spacer-sm' }),
        el('div', { class: 'checklist' }, live.checklist.map((item) =>
          el('button', {
            class: 'checklist-item' + (item.done ? ' is-done' : ''),
            'aria-pressed': item.done ? 'true' : 'false',
            onclick: (e) => {
              item.done = !item.done;
              haptics.buzz('tap');
              e.currentTarget.classList.toggle('is-done');
              e.currentTarget.setAttribute('aria-pressed', item.done ? 'true' : 'false');
            },
          }, [
            el('span', { class: 'checklist-item__box', 'aria-hidden': 'true' }),
            el('span', {}, item.label),
          ])
        )),
      ])
    : null;

  const contacts = state.contacts || [];
  const contactsSection = contacts.length > 0 ? buildLeaveContacts(contacts) : null;

  const screen = el('main', { class: 'screen screen--live' }, [
    wordmark(),
    el('div', { class: 'spacer-md' }),
    el('div', { class: 't-label' }, UI.leave_label),
    el('div', { class: 'spacer-sm' }),
    el('h1', { class: 't-hero' }, UI.leave_title),
    el('p', { class: 't-body', style: 'margin-top: 10px' }, live.leaveMessage),
    el('p', { class: 't-meta', style: 'margin-top: 8px' }, arrivalTxt),
    el('div', { class: 'spacer-md' }),
    checklist,
    checklist ? el('div', { class: 'spacer-md' }) : null,
    contactsSection,
    contactsSection ? el('div', { class: 'spacer-md' }) : null,
    el('div', { style: 'flex: 1' }),
    el('button', { class: 'btn btn--primary', onclick: departNow }, UI.leave_cta),
    el('div', { class: 'spacer-sm' }),
    el('button', { class: 'btn btn--ghost', onclick: () => liveNav.abortLive() }, UI.live_quit),
  ]);
  render(screen, 'leave');
}

function buildLeaveContacts(contacts) {
  const live = liveNav.getLive();
  const miniCards = contacts.map((c) => {
    const isSent = live.sentContactIds.has(c.id);
    const msg = MESSAGE_TEMPLATES[c.messageIdx ?? 0]();
    const initials = c.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';
    const hue = c.name.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % 360;

    return el('div', { class: 'social-mini-card' + (isSent ? ' is-sent' : '') }, [
      el('div', {
        class: 'social-avatar social-avatar--sm',
        style: `background: hsl(${hue}, 35%, 25%); color: hsl(${hue}, 60%, 75%);`,
      }, initials),
      el('div', { class: 'social-mini-info' }, [
        el('div', { class: 'social-mini-name' }, c.name),
        el('em', { class: 'social-mini-msg' }, `« ${msg} »`),
      ]),
      isSent
        ? el('div', { class: 'social-mini-sent' }, UI.social_sent)
        : el('button', {
            class: 'social-mini-send',
            onclick: (e) => {
              sendSignal(c);
              live.sentContactIds.add(c.id);
              e.currentTarget.replaceWith(el('div', { class: 'social-mini-sent' }, UI.social_sent));
            },
          }, UI.social_send),
    ]);
  });

  return el('div', { class: 'social-leave-section' }, [
    el('div', { class: 't-label', style: 'margin-bottom: 10px' }, UI.leave_contacts_label),
    el('div', { class: 'social-leave-list' }, miniCards),
  ]);
}

// "Je pars" : enregistre le départ du trajet (F5) puis enchaîne sur le bilan.
function departNow() {
  const live = liveNav.getLive();
  const state = loadState();
  startTrip(state, live.destinationId, live.transport);
  saveState(state);
  haptics.buzz('arrive');
  audio.cue('arrive');

  const session = {
    measurements: live.measurements,
    ctx: live.ctx,
    profileId: live.profileId,
    confirmedSteps: live.sequence
      .filter((s, i) => i < live.current && !s.skipped && s.key !== 'leave')
      .map((s) => ({ label: s.label, confirmed: true })),
  };
  liveNav.stopLiveSession();
  nav.trip(session);
}

registerLive({ renderLeave });

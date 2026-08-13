// J1 découpe étape 6 · Mes proches (contacts réels, rattachés au départ
// F5). Écran plat : aucune règle de calcul (S1 §4).

import { el, topbar } from '../ui/dom.js';
import { render } from '../ui/shell.js';
import { UI } from '../copy.js';
import { loadState, saveState } from '../store.js';
import { CHANNELS, MESSAGE_TEMPLATES } from '../social.js';
import { nav } from '../ui/nav.js';

export function showSocial() {
  let modalNode = null;

  function renderSocial() {
    const state = loadState();
    const contacts = state.contacts || [];

    function openModal(contact) {
      const draft = contact
        ? { ...contact }
        : { id: '', name: '', number: '', channel: 'sms', messageIdx: 0 };
      renderModal(draft);
    }

    function deleteContact(id) {
      const s = loadState();
      s.contacts = (s.contacts || []).filter((c) => c.id !== id);
      saveState(s);
      renderSocial();
    }

    const contactCards = contacts.map((c) => {
      const channel = CHANNELS.find((ch) => ch.key === c.channel) || CHANNELS[0];
      const msg = MESSAGE_TEMPLATES[c.messageIdx ?? 0]();
      const initials = c.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';
      const hue = c.name.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % 360;

      return el('div', { class: 'social-contact-card' }, [
        el('div', { class: 'social-card-header' }, [
          el('div', {
            class: 'social-avatar',
            style: `background: hsl(${hue}, 35%, 25%); color: hsl(${hue}, 60%, 75%);`,
          }, initials),
          el('div', { class: 'social-card-info' }, [
            el('div', { class: 'social-card-name' }, c.name),
            el('div', { class: 'social-card-meta' }, `${channel.label} · ${c.number}`),
          ]),
          el('button', { class: 'social-card-edit', onclick: () => openModal(c), 'aria-label': 'Modifier' }, '✎'),
          el('button', { class: 'social-card-delete', onclick: () => deleteContact(c.id), 'aria-label': 'Supprimer' }, '×'),
        ]),
        el('p', { class: 'social-card-preview' }, `« ${msg} »`),
      ]);
    });

    const screen = el('main', { class: 'screen stagger' }, [
      topbar(() => nav.settings()),
      el('div', { class: 'spacer-md' }),
      el('div', { class: 't-label' }, UI.social_label),
      el('div', { class: 'spacer-sm' }),
      el('h1', { class: 't-display' }, UI.social_title),
      el('div', { class: 'spacer-md' }),
      el('div', { class: 'callout callout--amber' }, [
        el('div', { class: 'callout__text' }, UI.social_privacy),
      ]),
      el('div', { class: 'spacer-md' }),
      contacts.length > 0 ? el('div', { class: 'social-contact-list' }, contactCards) : null,
      contacts.length > 0 ? el('div', { class: 'spacer-sm' }) : null,
      contacts.length < 5
        ? el('button', { class: 'social-add-btn', onclick: () => openModal(null) }, UI.social_add)
        : null,
      el('div', { style: 'flex: 1' }),
      el('div', { class: 'social-guardrail' }, [
        el('div', { class: 'social-guardrail__line' }),
        el('p', { class: 'social-guardrail__text' }, UI.social_guardrail),
      ]),
      el('div', { class: 'spacer-sm' }),
    ]);
    render(screen, 'social');
  }

  function renderModal(draft) {
    if (modalNode) modalNode.remove();
    const isNew = !draft.id;

    function closeModal() {
      if (!modalNode) return;
      const node = modalNode;
      modalNode = null;
      node.remove();
    }

    function save() {
      if (!draft.name.trim() || !draft.number.trim()) return;
      const s = loadState();
      s.contacts = s.contacts || [];
      if (isNew) {
        draft.id = Date.now().toString();
        s.contacts.push({ ...draft });
      } else {
        const idx = s.contacts.findIndex((c) => c.id === draft.id);
        if (idx >= 0) s.contacts[idx] = { ...draft };
      }
      saveState(s);
      closeModal();
      renderSocial();
    }

    const isTelegram = draft.channel === 'telegram';
    const nameInput = el('input', {
      class: 'text-input', type: 'text', placeholder: 'Prénom', value: draft.name,
      oninput: (e) => { draft.name = e.target.value; updateSaveBtn(); },
    });
    const numberInput = el('input', {
      class: 'text-input',
      type: isTelegram ? 'text' : 'tel',
      placeholder: isTelegram ? '@pseudo ou +33...' : '+33 6...',
      value: draft.number,
      oninput: (e) => { draft.number = e.target.value; updateSaveBtn(); },
    });
    const saveBtn = el('button', {
      class: 'btn btn--primary', style: 'flex:1',
      disabled: (!draft.name.trim() || !draft.number.trim()) ? true : null,
      onclick: save,
    }, isNew ? 'Ajouter' : 'Enregistrer');

    function updateSaveBtn() {
      saveBtn.disabled = !draft.name.trim() || !draft.number.trim();
    }

    const hasContactPicker = 'contacts' in navigator;
    async function pickContact() {
      try {
        const results = await navigator.contacts.select(['name', 'tel'], { multiple: false });
        if (!results?.length) return;
        const picked = results[0];
        if (picked.name?.[0]) {
          draft.name = picked.name[0].trim().split(/\s+/)[0];
          nameInput.value = draft.name;
        }
        if (picked.tel?.[0]) {
          draft.number = picked.tel[0].trim();
          numberInput.value = draft.number;
        }
        updateSaveBtn();
      } catch { /* annulé */ }
    }

    const sheet = el('div', { class: 'studio-modal__sheet' }, [
      el('div', { class: 'studio-modal__handle' }),
      el('div', { class: 't-label' }, isNew ? 'Nouveau proche' : 'Modifier'),
      el('div', { class: 'spacer-sm' }),
      hasContactPicker
        ? el('button', { class: 'social-picker-btn', onclick: pickContact }, 'Depuis mes contacts')
        : null,
      hasContactPicker ? el('div', { class: 'spacer-sm' }) : null,
      el('div', { class: 't-label', style: 'margin-bottom:6px' }, 'Prénom'),
      nameInput,
      el('div', { class: 'spacer-sm' }),
      el('div', { class: 't-label', style: 'margin-bottom:6px' }, 'Canal préféré'),
      el('div', { class: 'social-channel-grid' }, CHANNELS.map((ch) =>
        el('button', {
          class: 'pill' + (draft.channel === ch.key ? ' is-on' : ''),
          onclick: () => { draft.channel = ch.key; renderModal(draft); },
        }, ch.label)
      )),
      el('div', { class: 'spacer-sm' }),
      el('div', { class: 't-label', style: 'margin-bottom:6px' }, 'Numéro ou pseudo'),
      numberInput,
      el('div', { class: 'spacer-sm' }),
      el('div', { class: 't-label', style: 'margin-bottom:6px' }, 'Message envoyé'),
      el('div', { class: 'social-template-list' }, MESSAGE_TEMPLATES.map((tpl, i) =>
        el('button', {
          class: 'social-template-item' + (draft.messageIdx === i ? ' is-selected' : ''),
          onclick: () => { draft.messageIdx = i; renderModal(draft); },
        }, el('em', {}, `« ${tpl()} »`))
      )),
      el('div', { class: 'spacer-md' }),
      el('div', { style: 'display:flex;gap:10px' }, [
        el('button', { class: 'btn btn--ghost', style: 'flex:1', onclick: closeModal }, 'Annuler'),
        saveBtn,
      ]),
    ]);

    modalNode = el('div', {
      class: 'studio-modal',
      onclick: (e) => { if (e.target === modalNode) closeModal(); },
    }, sheet);

    document.body.appendChild(modalNode);
    setTimeout(() => nameInput.focus(), 60);
  }

  renderSocial();
}

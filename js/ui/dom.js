// J1 découpe étape 1 (Nour, R1 §1.4) · Helpers DOM sans état de module.
// Aucune de ces fonctions ne lit ni n'écrit une variable partagée : elles
// ne dépendent que de leurs arguments et du DOM global. C'est ce qui les
// rend extraites en premier, avant tout ce qui touche à `live`/`night`.

import { UI } from '../copy.js';

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null && v !== false) node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of [].concat(children)) {
    if (c == null || c === false) continue;
    node.appendChild(typeof c === 'string' || typeof c === 'number'
      ? document.createTextNode(String(c))
      : c);
  }
  return node;
}

export function wordmark() {
  return el('div', { class: 'wordmark' }, [
    el('span', { class: 'wordmark__dot' }),
    el('span', { class: 'wordmark__name' }, UI.wordmark),
  ]);
}

export function topbar(onBack) {
  return el('div', { class: 'studio-topbar' }, [
    wordmark(),
    el('button', { class: 'studio-back-btn', onclick: onBack }, '← Retour'),
  ]);
}

export function toast(title, body) {
  const t = el('div', { class: 'toast' }, [
    el('div', {}, [
      el('div', { class: 'toast__title' }, title),
      body ? el('div', { class: 'toast__body' }, body) : null,
    ]),
  ]);
  document.body.appendChild(t);
  setTimeout(() => {
    t.style.transition = 'opacity 220ms';
    t.style.opacity = '0';
    setTimeout(() => t.remove(), 240);
  }, 2600);
}

// Annonce pour lecteurs d'écran (aria-live, spec v2 §16).
export function announce(text) {
  let region = document.getElementById('live-region');
  if (!region) {
    region = el('div', { id: 'live-region', class: 'visually-hidden', 'aria-live': 'polite' });
    document.body.appendChild(region);
  }
  region.textContent = text;
}

export function settingRow(label, value, onToggle) {
  return el('div', { class: 'setting-row' }, [
    el('div', { class: 't-body', style: 'color: var(--text)' }, label),
    el('button', {
      class: 'toggle ' + (value ? 'is-on' : 'is-off'),
      role: 'switch',
      'aria-checked': value ? 'true' : 'false',
      'aria-label': label,
      onclick: () => onToggle(!value),
    }, [el('span', { class: 'toggle__thumb' })]),
  ]);
}

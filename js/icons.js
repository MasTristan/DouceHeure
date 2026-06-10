// Iconographie maison (spec v2 §3.3) : helper d'accès au sprite SVG
// inliné dans index.html. Trait monoline 1.75, terminaisons rondes,
// couleur currentColor.

export const ICON_NAMES = [
  'alarm', 'moon', 'sun', 'star', 'shower', 'outfit', 'breakfast', 'coffee',
  'care', 'bag', 'keys', 'door', 'bike', 'bus', 'metro', 'car', 'walk',
  'suitcase', 'headset', 'sport', 'heart', 'settings',
];

const NS = 'http://www.w3.org/2000/svg';

// Renvoie un élément <svg class="icon"><use href="#i-name"/></svg>.
export function icon(name, cls = '') {
  const safe = ICON_NAMES.includes(name) ? name : 'star';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', ('icon ' + cls).trim());
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS(NS, 'use');
  use.setAttribute('href', `#i-${safe}`);
  svg.appendChild(use);
  return svg;
}

// Icônes proposées pour personnaliser une étape ou un profil.
export const STEP_ICON_CHOICES = [
  'sun', 'shower', 'outfit', 'breakfast', 'coffee', 'care', 'bag', 'keys',
  'sport', 'heart', 'star', 'headset', 'suitcase', 'moon', 'door', 'walk',
];

export const TRANSPORT_ICONS = {
  walk: 'walk',
  bike: 'bike',
  car: 'car',
  transit: 'bus',
};

// Module social : canaux, templates de messages, génération de liens natifs.
// Pas de DOM ici, pas d'effet de bord caché.

export const CHANNELS = [
  { key: 'sms',      label: 'SMS',      emoji: '💬' },
  { key: 'whatsapp', label: 'WhatsApp', emoji: '🟢' },
  { key: 'imessage', label: 'iMessage', emoji: '🫧' },
  { key: 'telegram', label: 'Telegram', emoji: '✈️' },
];

export const MESSAGE_TEMPLATES = [
  () => `Je suis parti(e) à l'heure ce matin 🌿`,
  () => `Bonne journée en chemin, je t'embrasse ☀️`,
  () => `Je pars maintenant, on se parle plus tard 🫶`,
  () => `Parti(e) à l'heure ! La journée commence bien.`,
];

export function buildLink(contact) {
  const msg = encodeURIComponent(MESSAGE_TEMPLATES[contact.messageIdx ?? 0]());
  const num = contact.number.replace(/\s/g, '');

  switch (contact.channel) {
    case 'whatsapp':
      return `https://wa.me/${num.replace('+', '')}?text=${msg}`;
    case 'telegram':
      return num.startsWith('@')
        ? `https://t.me/${num.slice(1)}?text=${msg}`
        : `https://t.me/+${num.replace('+', '')}`;
    case 'imessage':
    case 'sms':
    default:
      // Format universel. Sur iOS certaines versions préfèrent sms:NUM?body=MSG.
      return `sms:${num}&body=${msg}`;
  }
}

// Ouvre la messagerie native via window.open pour ne pas fermer la PWA.
export function sendSignal(contact) {
  window.open(buildLink(contact), '_blank');
}

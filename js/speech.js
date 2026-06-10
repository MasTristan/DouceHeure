// F2 · Guidage vocal : wrapper de speechSynthesis, 100 % on-device.
// R1 s'applique au vocal : jamais de durée ni de temps restant prononcé.
// Les chaînes prononcées sont EXACTEMENT les chaînes affichées (copy.js).

import * as audio from './audio.js';

let settings = { enabled: false, rate: 1, voiceURI: null };

const hasApi = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

export function configure(voiceSettings) {
  settings = { ...settings, ...(voiceSettings || {}) };
}

export function isEnabled() {
  return settings.enabled && hasApi();
}

// Voix françaises disponibles. getVoices() peut être vide au premier appel
// sur iOS : l'appelant peut réessayer sur l'évènement voiceschanged.
export function frenchVoices() {
  if (!hasApi()) return [];
  return speechSynthesis.getVoices().filter((v) => v.lang?.toLowerCase().startsWith('fr'));
}

// Sélection robuste : voix mémorisée si encore présente, sinon première fr.
function pickVoice() {
  const voices = frenchVoices();
  if (!voices.length) return null;
  if (settings.voiceURI) {
    const saved = voices.find((v) => v.voiceURI === settings.voiceURI);
    if (saved) return saved;
  }
  return voices[0];
}

// Utterance silencieuse dans la chaîne d'un geste utilisateur :
// déverrouille la synthèse pour le reste de la session (contrainte iOS).
export function unlock() {
  if (!hasApi()) return;
  try {
    const u = new SpeechSynthesisUtterance('');
    u.volume = 0;
    speechSynthesis.speak(u);
  } catch { /* muet */ }
}

// Prononce un texte. cancel() d'abord : pas de file d'attente qui s'empile.
// Duck de la nappe ambiante pendant la parole.
export function speak(text) {
  if (!isEnabled() || !text) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'fr-FR';
    u.rate = Math.min(1.1, Math.max(0.8, settings.rate || 1));
    const voice = pickVoice();
    if (voice) u.voice = voice;
    u.onstart = () => audio.duckAmbient(true);
    u.onend = () => audio.duckAmbient(false);
    u.onerror = () => audio.duckAmbient(false);
    speechSynthesis.speak(u);
  } catch { /* muet */ }
}

export function cancel() {
  if (hasApi()) {
    try { speechSynthesis.cancel(); } catch { /* muet */ }
  }
  audio.duckAmbient(false);
}

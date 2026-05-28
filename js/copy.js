// Source de vérité unique pour tous les textes affichés.
// Chaque clé a un pool de N messages. pick(key) tire au sort
// sans répéter deux fois de suite le même message.

const lastPicked = {};

export function pick(key) {
  const pool = COPY[key];
  if (!pool || pool.length === 0) return '';
  if (pool.length === 1) return pool[0];
  let idx;
  do { idx = Math.floor(Math.random() * pool.length); }
  while (idx === lastPicked[key]);
  lastPicked[key] = idx;
  return pool[idx];
}

export const COPY = {

  wakeup: [
    "La journée commence. Prends le temps de revenir.",
    "Pas de rush. Tu as exactement le temps qu'il faut.",
    "Je suis là. Commence doucement.",
    "Chaque matin recommence. Celui-ci aussi.",
  ],

  shower: [
    "Ce moment chaud rien que pour toi.",
    "Profites-en. C'est fait pour ça.",
    "L'eau chaude, le silence. Ta parenthèse.",
    "Prends tout le temps de ta douche. Je surveille le reste.",
  ],

  outfit: [
    "La tenue qui te donne envie d'y aller.",
    "Choisis ce dans quoi tu te sens toi.",
    "Quelques minutes pour te construire.",
    "Ce que tu mets dit quelque chose. Choisis bien.",
  ],

  breakfast: [
    "Mange quelque chose de bien. Pour de vrai.",
    "Le carburant de tout le reste.",
    "Ce n'est pas optionnel. Prends soin de toi.",
    "Un bon matin commence par là.",
  ],

  grooming: [
    "Ton moment de soin. Prends-le.",
    "Pas besoin de te justifier. C'est important.",
    "La version de toi que tu veux présenter.",
    "Ce détail qui change tout.",
  ],

  bag: [
    "Clés, téléphone, ce dont tu as besoin. Pas plus.",
    "Check rapide. Rien oublié.",
    "Rassemble-toi. Tu es presque prêt(e).",
    "Le sac, les clés, et tu es entier(e).",
  ],

  ready: [
    "Dernière vérification. Tu as tout.",
    "Presque. Encore une seconde.",
    "Clés en main. C'est le moment.",
    "Tu as pensé à tout. Je m'en suis assuré(e).",
  ],

  leave: [
    "C'est le moment. Tu es prêt(e).",
    "Bonne route. Tu vas assurer.",
    "Je t'ai gardé toute la marge qu'il faut. Pars serein(e).",
    "Le plus dur c'était de se lever. Le reste, c'est bon.",
  ],

  nudge: [
    "Toujours en cours ? Pas de souci, prends le temps.",
    "Je suis là. Quand tu es prêt(e), dis-le moi.",
    "Aucune urgence. Je t'attends.",
    "Tu as le temps. Confirme quand c'est bon pour toi.",
  ],

  slip: [
    "On a pris un peu plus de temps. Ta marge absorbe. La suite est prête.",
    "Pas d'inquiétude, j'ai réajusté la suite.",
    "Un peu plus long que prévu. C'est géré.",
  ],

  feedback_early: [
    "Tu avais de la marge. Je le note pour la prochaine fois.",
    "En avance. Je m'en souviens.",
  ],

  feedback_ontime: [
    "Pile. C'est exactement ça.",
    "Parfait. On recommence comme ça.",
  ],

  feedback_late: [
    "Un peu serré. Je préviendrai plus tôt la prochaine fois. C'est pour ça que je suis là.",
    "Noté. La prochaine fois, je t'avance le signal.",
  ],

};

export const UI = {

  // Écran d'accueil
  home_title_with_name: (name) => `${name}, à quelle heure dois-tu être là ?`,
  home_title_anon: "À quelle heure dois-tu être là ?",
  home_cta: "Préparer mon départ",
  home_routine_label: "Ton rituel",
  home_routine_sub: "Tout est prêt. Lance ton guide du jour.",
  home_routine_cta: "Lancer mon rituel",
  home_routine_link: "Mon rituel",
  home_social_link: "Mes proches",

  // Écran aperçu
  preview_label: "Ton départ",
  preview_arrival_label: "Heure d'arrivée",
  preview_transport_label: "Comment tu t'y rends",
  preview_travel_label: "Durée du trajet",
  preview_subtitle: (time) => `Lève-toi vers ${time} et tout s'enchaîne.`,
  preview_body: "Je te guiderai à la voix. Tu n'as rien à surveiller.",
  preview_wakelock_notice: "Pose ton téléphone où tu peux le voir. Je m'occupe du reste à la voix. Si tu me fermes, je t'attends sans bruit.",
  preview_margin_notice: "Une marge de sécurité est déjà là-dedans. Tu arriveras serein(e).",
  preview_sequence_label: "Ta séquence",
  preview_cta: "Lancer mon guide",
  preview_back: "Retour",
  preview_learned: (mins) => `Appris : ${mins} min`,

  // Transports
  transport_walk: "À pied",
  transport_bike: "Vélo",
  transport_car: "Voiture",
  transport_transit: "Transports",

  // Mode live
  live_current_label: "En ce moment",
  live_next_prefix: "ensuite ·",
  live_confirm_idle: (nextLabel) => `J'ai fini · passer à ${nextLabel}`,
  live_confirm_suggested: (nextLabel) => `J'enchaîne · ${nextLabel}`,
  live_confirm_leave: "C'est bon, je pars",
  live_confirm_hint_idle: "L'app attend ton signal. Elle n'avance jamais sans toi.",
  live_confirm_hint_suggested: "C'est le bon moment, mais rien ne presse. Confirme quand tu y es.",
  live_quit: "Quitter le guide",

  // Écran départ
  leave_label: "C'est le moment",
  leave_title: "C'est le moment de partir.",
  leave_cta: "Je pars maintenant",
  leave_arrival: (time) => `Arrivée prévue pour ${time}.`,
  leave_slip: (time) => `On a pris un peu plus de temps. Ta marge a absorbé. Arrivée pour ${time}.`,

  // Feedback
  feedback_label: "Tu y es",
  feedback_title: "Comment ça s'est passé ?",
  feedback_body: "Une question. Elle me sert à mieux te préparer la prochaine fois.",
  feedback_cta_idle: "Choisis une réponse",
  feedback_cta_ready: "Terminer",
  feedback_early_label: "En avance, tranquille",
  feedback_ontime_label: "Pile à l'heure",
  feedback_late_label: "Un peu juste",

  // Insight
  insight_label: "Doucement, ça apprend",
  insight_rate: (pct) => `Tu es à l'heure ${pct}% du temps.`,
  insight_first: "Première sortie enregistrée.",
  insight_learned_title: "Ce que j'ai appris sur toi",
  insight_learned_empty: "Encore quelques départs et je te montrerai tes vraies durées.",
  insight_learned_privacy: "Calculé sur ton téléphone. Tes données ne sortent jamais d'ici.",
  insight_history_label: "Tes 7 dernières sorties",
  insight_back: "Retour à l'accueil",
  insight_was: (mins) => `était ${mins}`,
  insight_mean: (mins) => `${mins} min`,
  insight_mean_var: (mins, variance) => `${mins} min (±${variance})`,

  // Routine
  routine_label: "Mon rituel",
  routine_title: "Ton trajet habituel",
  routine_body: "Configure-le une fois. Je le proposerai les bons jours sans que tu y penses.",
  routine_arrival_label: "Heure d'arrivée",
  routine_travel_label: "Durée du trajet",
  routine_days_label: "Jours",
  routine_evening_label: "Aperçu du soir",
  routine_evening_sub: "Un rappel doux la veille de ta première sortie.",
  routine_cta: "Enregistrer mon rituel",
  routine_clear: "Retirer le rituel",
  routine_back: "Retour",
  routine_saved: "Rituel enregistré.",
  routine_cleared: "Rituel retiré.",

  // Social (maquette)
  social_label: "Mes proches",
  social_mockup_banner: "Cette fonction est conçue mais pas encore active. Elle arrivera après validation du reste.",
  social_title: "Un fil ténu vers tes proches",
  social_body: "Un proche peut recevoir un signal discret quand tu pars à l'heure. Rien d'autre : pas de localisation, pas de retard partagé.",
  social_signal_label: "Bien parti(e) à l'heure",
  social_signal_sub: "C'est tout ce que ton proche verra.",
  social_guardrail: "Le social célèbre. Il ne surveille pas.",
  social_back: "Retour",

  // Nom
  name_placeholder: "Comment tu t'appelles ?",
  name_cta: "Commencer",

  // Wordmark
  wordmark: "Douce heure",
};

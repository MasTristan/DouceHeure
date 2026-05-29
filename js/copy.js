// js/copy.js
// Source de vérité unique pour tous les textes affichés.
// Ton : lucide, direct, légèrement complice. Zéro métaphore spa.
// Règles : pas de métaphore corporelle/spirituelle, pas d'adjectifs
// émotionnels inutiles, humour par la lucidité pas par les blagues,
// max deux phrases par message, souvent une seule.

// ─── MOTEUR DE VARIATION ────────────────────────────────────────
// Tire au sort sans répéter deux fois de suite le même message.

const _last = {};

export function pick(key) {
  const pool = COPY[key];
  if (!pool || pool.length === 0) return "";
  if (pool.length === 1) return pool[0];
  let idx;
  do {
    idx = Math.floor(Math.random() * pool.length);
  } while (idx === _last[key]);
  _last[key] = idx;
  return pool[idx];
}

// ─── MESSAGES PAR ÉTAPE ─────────────────────────────────────────

export const COPY = {

  wakeup: [
    "C'est parti. Doucement.",
    "Le monde peut attendre deux minutes.",
    "Yep, c'est le matin.",
    "Tu t'es levé(e). C'est déjà ça.",
  ],

  shower: [
    "Douche. Tu sais comment ça marche.",
    "L'eau chaude, puis la suite.",
    "Prends le temps qu'il faut. Pas plus.",
    "La meilleure partie du matin pour beaucoup de gens. Profites-en.",
  ],

  outfit: [
    "Qu'est-ce qu'on met aujourd'hui.",
    "Une tenue. N'importe laquelle ira.",
    "Le truc que tu porteras toute la journée. Choisis bien-ish.",
    "Pas besoin que ce soit parfait.",
  ],

  breakfast: [
    "Mange quelque chose.",
    "Ton cerveau fonctionne mieux avec du carburant, c'est prouvé.",
    "Même un truc rapide. C'est suffisant.",
    "Petit-déj. On ne négocie pas avec ça.",
  ],

  grooming: [
    "Deux minutes pour toi. Pas trois, deux.",
    "La partie où tu décides de ce que les autres voient en premier.",
    "Fais ce que t'as à faire.",
    "On s'occupe du reste.",
  ],

  bag: [
    "Clés. Téléphone. Le reste.",
    "Check rapide : t'as tout ?",
    "Le moment où on réalise qu'on a oublié quelque chose.",
    "Sac. Clés. C'est tout ce qui compte là.",
  ],

  ready: [
    "Clés en main ?",
    "Vérifie une dernière fois. Juste une.",
    "Presque.",
    "C'est bon.",
  ],

  leave: [
    "C'est l'heure.",
    "Bonne route.",
    "Tu l'as fait.",
    "Vas-y, t'es prêt(e).",
  ],

  nudge: [
    "Toujours là ? Pas de souci.",
    "Tu prends le temps qu'il te faut.",
    "On est pas pressés. Enfin si, un peu. Mais ça va.",
    "Confirme quand c'est bon.",
  ],

  slip: [
    "On a pris un peu plus de temps. C'est absorbé, la suite est ajustée.",
    "Légèrement hors plan. Rien de grave, j'ai recalculé.",
  ],

  feedback_early: [
    "En avance. Je note.",
    "Avec de la marge. Bon réflexe.",
  ],

  feedback_ontime: [
    "Pile. Exactement ça.",
    "Dans les temps. C'est tout ce qu'on demandait.",
  ],

  feedback_late: [
    "Un peu serré. La prochaine fois je préviens plus tôt.",
    "Juste. On ajuste pour la prochaine.",
  ],

  // Apprentissage progressif (affiché sur l'écran insight
  // selon le nombre de sessions)
  learning_1:  "C'est notre première sortie ensemble. Je commence à apprendre.",
  learning_5:  "Je commence à te connaître.",
  learning_10: "Je te connais assez bien maintenant.",

};

// ─── TEXTES UI FIXES ────────────────────────────────────────────
// Ces textes ne varient pas. Un seul endroit pour les modifier.

export const UI = {

  // Écran zéro (premier lancement)
  zero_headline: "Certains matins, le temps fait ce qu'il veut.",
  zero_subline:  "Je suis là pour ça.",
  zero_cta:      "C'est parti",

  // Accueil
  home_title_with_name: (name) => `${name}, à quelle heure dois-tu être là ?`,
  home_title_anon:      "À quelle heure dois-tu être là ?",
  home_cta:             "Préparer mon départ",
  home_profile_hint:    (emoji, name, count) =>
    `${emoji} ${name} · ${count} étapes`,
  home_routine_label:   "Rituel du jour",
  home_routine_sub:     "Tout est prêt. Lance.",

  // Aperçu
  preview_subtitle:       (time) => `Lève-toi vers ${time}.`,
  preview_body:           "Je guide étape par étape. Tu n'as rien à surveiller.",
  preview_wakelock:       "Pose ton téléphone où tu peux le voir. Je guide à la voix. Si tu fermes l'app, j'attends sans sonner.",
  preview_margin:         "Marge de sécurité incluse.",
  preview_cta:            "C'est parti",

  // Live
  live_label:             "En ce moment",
  live_next_prefix:       "ensuite ·",
  live_confirm_idle:      (next) => `Passer à ${next}`,
  live_confirm_suggested: (next) => `C'est bon · ${next}`,
  live_confirm_leave:     "Je pars",
  live_hint_idle:         "L'app attend ton signal.",
  live_hint_suggested:    "C'est le bon moment. Confirme quand tu y es.",
  live_skip:              "Passer",
  live_stop:              "Aujourd'hui c'est différent.",
  live_stop_confirm:      "Ok. À demain.",

  // Départ
  leave_title:     "C'est l'heure.",
  leave_cta:       "Je pars",
  leave_arrival:   (time) => `Arrivée prévue pour ${time}.`,
  leave_slip:      (time) => `La marge a absorbé. Arrivée pour ${time}.`,
  leave_signal:    "Prévenir quelqu'un ?",

  // Feedback
  feedback_title:        "Ça s'est passé comment ?",
  feedback_body:         "Une question. Elle sert à calibrer la prochaine fois.",
  feedback_cta_idle:     "Choisis",
  feedback_cta_ready:    "Ok",
  feedback_early_label:  "En avance",
  feedback_ontime_label: "À l'heure",
  feedback_late_label:   "Un peu juste",

  // Insight
  insight_rate:    (pct) => `À l'heure ${pct}% du temps.`,
  insight_first:   "Première sortie. On commence.",
  insight_learned: "Ce que j'ai appris",
  insight_privacy: "Calculé sur ton téléphone. Rien ne sort d'ici.",
  insight_history: "Les 7 dernières sorties",

  // Studio
  studio_title:   "Compose ta routine",
  studio_body:    "Glisse pour réordonner. Touche pour modifier.",
  studio_add:     "Ajouter une étape",
  studio_save:    "Sauvegarder",
  studio_saved:   "✓ Sauvegardé",
  studio_preview: "Prévisualiser",
  studio_total:   (n, dur) => `${n} étapes · ${dur} min`,

  // Mes proches
  social_title:    "Mes proches",
  social_subtitle: "Un fil ténu vers ceux qui comptent.",
  social_body:     "Quand tu pars à l'heure, tu peux choisir de le dire.",
  social_privacy:  "L'app ouvre ta messagerie avec le message prêt. Tu envoies toi-même. Rien ne part sans ton accord.",
  social_add:      "Ajouter un proche",
  social_sent:     "✓ Messagerie ouverte",
  social_send:     "🌿 Envoyer",
  social_guardrail:"Signal positif uniquement. Jamais de retard, jamais de position.",

  // Routine récurrente
  routine_title:  "Trajet habituel",
  routine_body:   "Configure une fois. Je propose les bons jours.",
  routine_save:   "Enregistrer",
  routine_evening:"Rappel du soir",

};

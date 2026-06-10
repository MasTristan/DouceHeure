// js/copy.js
// Source de vérité unique pour tous les textes affichés ET prononcés (F2 :
// les chaînes vocales sont les mêmes que les chaînes affichées).
// Ton : lucide, direct, légèrement complice. Zéro métaphore spa.
// Règles : R1 jamais de durée ni de temps restant, R5 jamais de reproche,
// max deux phrases par message, souvent une seule. Pas de tiret cadratin.

// ─── MOTEUR DE VARIATION ────────────────────────────────────────
// Tire au sort sans répéter deux fois de suite le même message.

const _last = {};

export function pick(key) {
  const pool = COPY[key];
  if (!pool || pool.length === 0) return '';
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
    'Le monde peut attendre deux minutes.',
    "Yep, c'est le matin.",
    "Tu t'es levé(e). C'est déjà ça.",
  ],

  shower: [
    'Douche. Tu sais comment ça marche.',
    "L'eau chaude, puis la suite.",
    "Prends le temps qu'il faut. Pas plus.",
    'La meilleure partie du matin pour beaucoup de gens. Profites-en.',
  ],

  outfit: [
    "Qu'est-ce qu'on met aujourd'hui.",
    "Une tenue. N'importe laquelle ira.",
    'Le truc que tu porteras toute la journée. Choisis bien-ish.',
    'Pas besoin que ce soit parfait.',
  ],

  breakfast: [
    'Mange quelque chose.',
    "Ton cerveau fonctionne mieux avec du carburant, c'est prouvé.",
    "Même un truc rapide. C'est suffisant.",
    'Petit-déj. On ne négocie pas avec ça.',
  ],

  grooming: [
    'Deux minutes pour toi. Pas trois, deux.',
    'La partie où tu décides de ce que les autres voient en premier.',
    "Fais ce que t'as à faire.",
    "On s'occupe du reste.",
  ],

  bag: [
    'Clés. Téléphone. Le reste.',
    "Check rapide : t'as tout ?",
    "Le moment où on réalise qu'on a oublié quelque chose.",
    "Sac. Clés. C'est tout ce qui compte là.",
  ],

  ready: [
    'Clés en main ?',
    'Vérifie une dernière fois. Juste une.',
    'Presque.',
    "C'est bon.",
  ],

  // Étape libre créée dans le studio : messages génériques.
  free: [
    "À toi de jouer. C'est ton étape.",
    'Tu sais quoi faire.',
    "C'est le moment pour ça.",
  ],

  leave: [
    "C'est l'heure.",
    'Bonne route.',
    "Tu l'as fait.",
    "Vas-y, t'es prêt(e).",
  ],

  suggested: [
    'Quand tu es prêt(e).',
    "C'est le bon moment. Confirme quand tu y es.",
  ],

  nudge: [
    'Toujours là ? Pas de souci.',
    "Tu prends le temps qu'il te faut.",
    'On est pas pressés. Enfin si, un peu. Mais ça va.',
    "Confirme quand c'est bon.",
  ],

  slip: [
    "On a pris un peu plus de temps. C'est absorbé, la suite est ajustée.",
    "Légèrement hors plan. Rien de grave, j'ai recalculé.",
  ],

  // F6 · Imprévu
  pause: [
    'On reprend quand tu veux.',
    'Le plan attend avec toi.',
  ],
  pause_resumed: [
    "C'est reparti. La suite est recalée.",
    'On reprend là où on en était.',
  ],

  // F3 · Rattrapage. Aucun chiffre de retard, jamais (R1, R5).
  rescue_title: [
    'Matin chargé. On allège ?',
  ],
  rescue_body: [
    'Quelques étapes confort peuvent attendre demain. Tu choisis.',
  ],

  feedback_early: [
    'En avance. Je note.',
    'Arrivé(e) avant tout le monde. Bon réflexe.',
  ],

  feedback_ontime: [
    'Pile. Exactement ça.',
    "Dans les temps. C'est tout ce qu'on demandait.",
  ],

  feedback_late: [
    'Un peu serré. La prochaine fois je préviens plus tôt.',
    'Juste. On ajuste pour la prochaine.',
  ],

  // F1 · Mode chevet
  goodmorning: [
    'Bonjour.',
  ],
  wake_again: [
    'Quand tu veux.',
  ],

  // F5 · Trajet
  trip_road: [
    'Bonne route.',
    'À tout à l\'heure.',
  ],
  trip_arrived: [
    'Bien arrivé(e). Je retiens le trajet.',
    'Noté. Le prochain plan en profite.',
  ],

};

// ─── TEXTES UI FIXES ────────────────────────────────────────────
// Ces textes ne varient pas. Un seul endroit pour les modifier.

export const UI = {

  wordmark: 'Douce heure',

  // Onboarding (spec v2 §15)
  ob1_headline: 'Douce heure ne te presse pas.',
  ob1_subline: 'Elle marche à ton rythme, et apprend le tien.',
  ob1_name_label: 'Ton prénom (optionnel)',
  ob1_cta: 'Continuer',
  ob2_title: 'Ton premier départ',
  ob2_body: 'Choisis un point de départ. Tout se modifie après.',
  ob2_arrival_label: 'Arrivée à',
  ob2_transport_label: 'Transport',
  ob2_cta: 'Continuer',
  ob3_title: "L'honnêteté d'abord",
  ob3_body: "Pendant le guidage, l'écran reste allumé et l'app reste ouverte. Si tu la fermes, elle attend sans sonner. C'est le deal.",
  ob3_confirm_label: 'Geste de confirmation',
  ob3_hold: 'Appui tenu',
  ob3_hold_sub: 'Maintiens pour confirmer. Évite les faux taps.',
  ob3_tap: 'Tap simple',
  ob3_tap_sub: 'Un tap suffit. Plus direct.',
  ob3_voice_label: 'Guidage vocal',
  ob3_cta: "C'est parti",
  ob_skip: 'Passer',
  ob_tooltip: 'Tout part d\'ici. Bon matin.',

  // Accueil v2
  home_title_with_name: (name) => `${name}, on prépare ton départ ?`,
  home_title_anon: 'On prépare ton départ ?',
  home_next_label: 'Prochain départ',
  home_next_cta: 'Préparer ce départ',
  home_other_profiles: 'Autres départs',
  home_mornings_link: 'Tes matins',
  home_studio_link: 'Le studio',
  home_settings_link: 'Réglages',
  home_evening_label: 'Ce soir',
  home_evening_title: 'Préparer demain',
  home_evening_sub: "L'app te réveille en douceur et enchaîne sur le matin.",
  home_arrived_banner: 'Bien arrivé(e) ?',
  home_arrived_yes: 'Oui, bien arrivé(e)',
  home_arrived_no: 'Pas encore',
  home_missed_wake: 'Le matin a commencé sans nous ?',
  home_missed_wake_cta: 'Commencer le matin',

  // Aperçu
  preview_subtitle: (time) => `Lève-toi vers ${time}.`,
  preview_body: 'Je guide étape par étape. Tu n\'as rien à surveiller.',
  preview_arrival_label: 'Arrivée à',
  preview_transport_label: 'Transport',
  preview_travel_label: 'Trajet estimé (minutes)',
  preview_travel_known: 'Le trajet, je connais. Je m\'en occupe.',
  preview_destination_label: 'Destination',
  preview_destination_none: 'Sans destination',
  preview_destination_add: '+ Nouvelle destination',
  preview_destination_prompt: 'Un nom pour cette destination ?',
  preview_sequence_label: 'Le déroulé',
  preview_wakelock_notice: "L'écran restera allumé pendant le guidage. Pose le téléphone où tu le vois.",
  preview_cta: "C'est parti",
  preview_back: 'Retour',
  preview_learned: 'Calé sur tes vraies durées.',

  // Live
  live_current_label: 'En ce moment',
  live_next_prefix: 'ensuite ·',
  live_hold_hint: 'Maintiens pour confirmer',
  live_tap_hint: 'Touche pour confirmer',
  live_confirm: (next) => next ? `C'est fait · ${next}` : "C'est fait",
  live_drawer_open: 'La suite',
  live_drawer_title: 'Les étapes restantes',
  live_drawer_skip: "Pas aujourd'hui",
  live_drawer_pause: 'Imprévu',
  live_drawer_close: 'Fermer',
  live_pause_title: 'On reprend quand tu veux',
  live_pause_cta: 'Reprendre',
  live_rescue_lighten: 'Alléger',
  live_rescue_keep: 'Garder tout',
  live_quit: "Aujourd'hui c'est différent.",
  live_quit_confirmed: 'Ok. À demain.',

  // Départ (spec v2 §7.7)
  leave_label: 'Le départ',
  leave_title: "C'est l'heure",
  leave_arrival: (time) => `Arrivée prévue pour ${time}.`,
  leave_slip: (time) => `Arrivée prévue pour ${time}.`,
  leave_checklist_label: 'Avant de fermer la porte',
  leave_contacts_label: 'Prévenir quelqu\'un ?',
  leave_cta: 'Je pars',

  // Trajet (F5)
  trip_label: 'En chemin',
  trip_arrived_cta: 'Je suis arrivé(e)',
  trip_close_hint: "Tu peux fermer l'app. Je redemanderai à la prochaine ouverture.",

  // Feedback
  feedback_label: 'Le bilan',
  feedback_title: 'Ça s\'est passé comment ?',
  feedback_body: 'Une question. Elle sert à calibrer la prochaine fois.',
  feedback_cta_idle: 'Choisis',
  feedback_cta_ready: 'Ok',
  feedback_early_label: 'En avance',
  feedback_ontime_label: "À l'heure",
  feedback_late_label: 'Un peu juste',

  // Carte du matin (spec v2 §11)
  card_title: 'La carte du matin',
  card_body: "Une image, générée ici, qui ne sort que si tu l'envoies.",
  card_share: 'Partager la carte',
  card_skip: 'Pas cette fois',
  card_downloaded: 'Image enregistrée.',

  // Tes matins (spec v2 §10)
  mornings_label: 'Tes matins',
  mornings_title: 'Le ciel de tes départs',
  mornings_empty: 'Premier départ à venir. Le ciel se remplira.',
  mornings_count: (n) => n === 1 ? '1 départ accompagné' : `${n} départs accompagnés`,
  mornings_learned_title: "Ce que l'app a appris",
  mornings_learned_empty: "Encore rien. Quelques matins et ça vient.",
  mornings_learned_step: (label, dayName) => dayName
    ? `${label}, ça prend son temps le ${dayName}. Le plan en tient compte.`
    : `${label}, l'app connaît. Le plan en tient compte.`,
  mornings_learned_travel: (transport, dest) => `${transport} vers ${dest}, l'app connaît.`,
  mornings_privacy: 'Calculé sur ton téléphone. Rien ne sort d\'ici.',
  mornings_back: 'Retour',
  mornings_all_profiles: 'Tous',

  // F1 · Mode chevet
  bedside_label: 'Mode chevet',
  bedside_title: 'Préparer demain',
  bedside_wake_label: 'Lever à',
  bedside_profile_label: 'Le matin qui suit',
  bedside_sound_label: 'Son de réveil',
  bedside_honest: "L'écran reste allumé en très basse lumière. Branche le téléphone.",
  bedside_honest2: "Si le téléphone s'éteint pendant la nuit, l'app ne peut pas se relancer seule. Elle te le proposera à l'ouverture.",
  bedside_cta: 'Bonne nuit',
  bedside_cancel: 'Pas ce soir',
  bedside_night_hint: 'Appui long pour quitter',
  bedside_quit_confirm: 'Quitter le mode chevet ?',
  bedside_quit_yes: 'Quitter',
  bedside_quit_no: 'Rester',
  bedside_wake_hold: 'Maintiens pour te lever',
  bedside_morning_cta: 'Commencer le matin',
  bedside_not_yet: 'Pas encore',

  // Studio v2
  studio_label: 'Le studio',
  studio_title: 'Compose tes départs',
  studio_body: 'Glisse pour réordonner, touche pour modifier. Tout est sauvegardé.',
  studio_profiles_label: 'Mes départs',
  studio_add_profile: '+ Départ',
  studio_archetype_title: 'Quel genre de départ ?',
  studio_steps_label: (n) => `Étapes · ${n}`,
  studio_core: 'essentiel',
  studio_comfort: 'confort',
  studio_add_step: 'Ajouter une étape libre',
  studio_max_steps: 'Maximum 8 étapes atteint',
  studio_checklist_label: 'Checklist de départ',
  studio_checklist_add: '+ Ajouter un objet',
  studio_checklist_placeholder: "Nom de l'objet",
  studio_defaults_label: 'Par défaut',
  studio_default_arrival: 'Arrivée habituelle',
  studio_default_transport: 'Transport habituel',
  studio_default_destination: 'Destination habituelle',
  studio_preview: 'Aperçu du plan',
  studio_delete_profile: 'Supprimer ce départ',
  studio_back: 'Retour',

  // Réglages
  settings_label: 'Réglages',
  settings_title: 'Comme tu préfères',
  settings_name: 'Prénom',
  settings_scene: 'Lumière',
  settings_scene_auto: 'Auto',
  settings_scene_dawn: 'Aube',
  settings_scene_day: 'Plein jour',
  settings_scene_evening: 'Veillée',
  settings_confirm: 'Confirmation',
  settings_confirm_hold: 'Appui tenu',
  settings_confirm_tap: 'Tap simple',
  settings_sound: 'Sons',
  settings_ambient: 'Nappe sonore pendant le guidage',
  settings_haptics: 'Vibrations',
  settings_readable: 'Mode lisible',
  settings_voice: 'Guidage vocal',
  settings_voice_rate: 'Débit de la voix',
  settings_voice_pick: 'Voix',
  settings_voice_none: 'Aucune voix française disponible sur cet appareil.',
  settings_contacts: 'Mes proches',
  settings_backup_label: 'Tes données',
  settings_export: 'Exporter mes données',
  settings_import: 'Importer des données',
  settings_import_confirm: 'Remplacer toutes les données actuelles ?',
  settings_import_ok: 'Données importées.',
  settings_import_bad: 'Fichier non reconnu. Rien n\'a été modifié.',
  settings_shortcuts_title: 'Automatiser avec Raccourcis iOS',
  settings_shortcuts_body: "Un raccourci peut ouvrir l'app prête à lancer. Copie cette URL et adapte-la :",
  settings_shortcuts_copy: "Copier l'URL type",
  settings_shortcuts_copied: 'Copiée.',
  settings_install_title: "Installer sur l'écran d'accueil",
  settings_install_step1: '1. Ouvre cette page dans Safari.',
  settings_install_step2: '2. Touche le bouton Partager.',
  settings_install_step3: "3. Choisis « Sur l'écran d'accueil ».",
  settings_privacy: 'Tout reste sur ton téléphone. Aucune donnée ne sort.',
  settings_back: 'Retour',

  // Mes proches (contacts réels, rattachés au départ)
  social_label: 'Mes proches',
  social_title: 'Prévenir sans y penser',
  social_privacy: "L'app ouvre ta messagerie avec le message prêt. Tu envoies toi-même. Rien ne part sans ton accord.",
  social_add: '+ Ajouter un proche',
  social_send: 'Ouvrir',
  social_sent: '✓ envoyé',
  social_guardrail: 'Signal positif uniquement. Jamais de retard, jamais de position.',

  // Transports
  transport_walk: 'À pied',
  transport_bike: 'Vélo',
  transport_car: 'Voiture',
  transport_transit: 'Transports',

  // Divers
  toast_update: 'Mise à jour disponible. Elle s\'appliquera à la prochaine ouverture.',
  jours: ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'],

};

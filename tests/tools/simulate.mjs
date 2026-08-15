// J2 · Simulateur de matins, reproductible, zéro dépendance (ADR-001).
//
// Le projet ne collecte rien, par choix (00-vision.md §1, point 6), et ce
// choix ne bouge pas. Le substitut est ici : un modèle explicite, écrit,
// qui pilote le CODE DE PRODUCTION sans le modifier, et qui donne des
// chiffres reproductibles au lieu d'opinions.
//
// Ce fichier est la source des chiffres cités dans les specs (« un matin
// sur deux est en retard au jour 1 », « 24 minutes d'avance en régime
// établi »). Avant lui, ces nombres vivaient dans un compte rendu de
// réunion et personne ne pouvait les recalculer.
//
// ─── LE MODÈLE, ET CE QU'IL ASSUME ────────────────────────────────
//
// Un utilisateur simulé a, pour chaque étape, une durée VRAIE moyenne et
// un bruit jour à jour. L'app, elle, ne connait que `est`, la valeur
// déclarative de l'archétype. Le biais de déclaration est le rapport
// entre les deux : c'est la variable qui commande tout (S3 §1).
//
// Trois hypothèses assumées, à connaitre avant de citer un chiffre :
//
// 1. L'utilisateur simulé SUIT l'app : il se lève à l'heure de lever
//    proposée et confirme chaque étape dès qu'il l'a finie. C'est le cas
//    favorable. Un utilisateur réel se lève parfois plus tard, et ce
//    simulateur ne le modélise pas.
// 2. Le biais porte sur les durées de préparation, pas sur le trajet.
//    « Combien de temps prend ta douche » est une question introspective ;
//    « combien de temps pour aller au bureau » porte sur un trajet répété
//    et connu. `travelBias` permet de tester l'autre hypothèse, il vaut 1
//    par défaut.
// 3. Le temps de trajet réel est tiré autour de sa moyenne vraie ; le
//    buffer de transport de `buildPlan` est de la réserve pure, il ne
//    correspond à aucune minute réellement passée.

import { buildPlan, TRANSPORT_BUFFER } from '../../js/plan.js';
import { recordDurations, recordOutcome } from '../../js/predict.js';
import { defaultState, ARCHETYPES, makeProfileFromArchetype } from '../../js/store.js';
import { toMin, fromMin } from '../../js/time.js';

// ─── Aléatoire reproductible ──────────────────────────────────────
// mulberry32 : court, sans dépendance, et surtout identique d'une
// exécution à l'autre. Un harnais de calibration dont les chiffres
// bougent entre deux exécutions ne prouve rien.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Box-Muller, tronquée à +/- 3 écarts-types : une durée de préparation
// n'a pas de queue infinie.
function normal(rng, mean, sd) {
  const u = Math.max(rng(), 1e-9);
  const v = rng();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return mean + Math.max(-3, Math.min(3, z)) * sd;
}

// ─── Un utilisateur simulé ────────────────────────────────────────

const DEFAULT_PROFILE = {
  archetype: 1,        // matin classique
  arrival: '09:00',
  transport: 'walk',
  declaredTravel: 20,
};

// `stepBias` : rapport durée vraie / durée déclarée. 1.4 signifie que la
// personne met 40 % de plus que ce que l'app croit. Tiré par utilisateur
// autour de `stepBias`, pour que la population ne soit pas homogène.
export function makeUser(rng, opts = {}) {
  const {
    stepBias = 1.4, stepBiasSpread = 0.25,
    noiseRatio = 0.18, travelBias = 1, travelNoise = 0.15,
    latenessScore = 0.5,
  } = opts;

  const state = defaultState();
  state.latenessScore = latenessScore;
  const profile = makeProfileFromArchetype(ARCHETYPES[opts.archetype ?? DEFAULT_PROFILE.archetype], 'p');
  state.profiles = [profile];
  state.activeProfileId = 'p';

  const bias = Math.max(1, normal(rng, stepBias, stepBiasSpread));
  const truth = {};
  for (const step of profile.steps) {
    if (!step.active) continue;
    truth[step.key] = {
      mean: step.est * bias,
      sd: Math.max(0.6, step.est * bias * noiseRatio),
    };
  }
  const declaredTravel = opts.declaredTravel ?? DEFAULT_PROFILE.declaredTravel;
  return {
    state,
    truth,
    bias,
    declaredTravel,
    trueTravel: { mean: declaredTravel * travelBias, sd: Math.max(1, declaredTravel * travelBias * travelNoise) },
    arrival: opts.arrival ?? DEFAULT_PROFILE.arrival,
    transport: opts.transport ?? DEFAULT_PROFILE.transport,
  };
}

// L'heure de lever que la personne DÉCLARE quand on la lui demande.
// Ce n'est pas une estimation, c'est l'heure à laquelle elle se lève
// réellement aujourd'hui : la somme de ses vraies durées, de son vrai
// trajet, et du battement qu'elle se laisse. Une personne sujette au
// retard chronique se laisse peu de battement, et c'est précisément ce
// qui la met en retard. C'est aussi pourquoi la question marche : elle
// porte sur un événement observable, pas sur une durée introspective.
export function declaredWakeTime(user, slack = 5) {
  const truePrep = Object.values(user.truth).reduce((a, t) => a + t.mean, 0);
  return fromMin(Math.round(toMin(user.arrival) - (truePrep + user.trueTravel.mean + slack)));
}

// ─── Un matin ─────────────────────────────────────────────────────

// Rend le résultat d'un matin ET met à jour l'état de l'utilisateur
// exactement comme le ferait une vraie session (R3 : seules des durées
// réellement écoulées sont écrites).
export function simulateMorning(user, ctx, rng) {
  const profile = user.state.profiles.find((p) => p.id === user.state.activeProfileId);
  const plan = buildPlan(
    profile.steps, user.arrival, user.declaredTravel, user.transport,
    user.state.latenessScore, ctx, null,
  );

  // L'utilisateur se lève à l'heure proposée et enchaine les étapes.
  let cursor = plan.startMin;
  const measurements = [];
  for (const step of plan.sequence) {
    if (step.key === 'leave') continue;
    const t = user.truth[step.key];
    const real = Math.max(1, Math.round(normal(rng, t.mean, t.sd)));
    cursor += real;
    measurements.push({ stepKey: step.key, v: real });
  }
  const leaveActual = cursor;
  const travelActual = Math.max(1, Math.round(normal(rng, user.trueTravel.mean, user.trueTravel.sd)));
  const arrivalActual = leaveActual + travelActual;

  // Positif = en avance, négatif = en retard.
  const advance = plan.arrivalMin - arrivalActual;
  const status = advance < 0 ? 'late' : advance <= 5 ? 'ontime' : 'early';

  recordDurations(user.state, measurements, { ...ctx, profileId: profile.id });
  recordOutcome(user.state, status, { ...ctx, profileId: profile.id });

  return {
    advance,
    status,
    late: advance < 0,
    // Combien de temps avant l'heure d'arrivée la personne doit se lever.
    // C'est le prix quotidien du plan, et la moitié oubliée de la cible
    // d'ADR-002 : on n'achète pas la ponctualité à n'importe quel prix.
    riseLead: plan.arrivalMin - plan.startMin,
    startMin: plan.startMin,
    margin: plan.margin,
  };
}

// ─── Une population sur plusieurs matins ──────────────────────────

// Les jours avancent du lundi au vendredi puis reprennent : le contexte
// (`day`, `type`) que `predict` utilise pour segmenter doit varier comme
// dans la vraie vie, sinon la segmentation n'est jamais exercée.
function ctxForDay(dayIndex) {
  const day = (dayIndex % 5) + 1; // 1 = lundi .. 5 = vendredi
  return { day, type: 'work' };
}

export function simulate({ users = 300, mornings = 25, seed = 1, ...opts } = {}) {
  const rng = makeRng(seed);
  // byDay[d] = tous les résultats du matin d, tous utilisateurs confondus.
  const byDay = Array.from({ length: mornings }, () => []);

  for (let u = 0; u < users; u++) {
    const user = makeUser(rng, opts);
    for (let d = 0; d < mornings; d++) {
      byDay[d].push(simulateMorning(user, ctxForDay(d), rng));
    }
  }
  return byDay;
}

// ─── Lecture des résultats ────────────────────────────────────────

const mean = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

export function summarize(dayResults) {
  return {
    lateRate: dayResults.filter((r) => r.late).length / dayResults.length,
    meanAdvance: mean(dayResults.map((r) => r.advance)),
    meanRiseLead: mean(dayResults.map((r) => r.riseLead)),
    meanMargin: mean(dayResults.map((r) => r.margin)),
  };
}

// Régime établi : les derniers matins, quand le FIFO de 8 est plein et que
// la prédiction a convergé.
export function summarizeSteady(byDay, lastN = 8) {
  return summarize(byDay.slice(-lastN).flat());
}

// Sortie lisible en ligne de commande, pour instruire une décision sans
// avoir à écrire un test d'abord.
export function report(byDay, label = '') {
  const lines = [];
  if (label) lines.push(label);
  lines.push('jour | en retard | avance moy. | lever avant arrivée');
  for (const [i, day] of byDay.entries()) {
    if (i > 2 && i < byDay.length - 1 && i % 5 !== 0) continue;
    const s = summarize(day);
    lines.push(`${String(i + 1).padStart(4)} | ${(s.lateRate * 100).toFixed(0).padStart(8)}% `
      + `| ${s.meanAdvance.toFixed(1).padStart(11)} | ${s.meanRiseLead.toFixed(0).padStart(19)}`);
  }
  const steady = summarizeSteady(byDay);
  lines.push(`régime établi : ${(steady.lateRate * 100).toFixed(0)}% en retard, `
    + `${steady.meanAdvance.toFixed(1)} min d'avance, lever ${steady.meanRiseLead.toFixed(0)} min avant l'arrivée, `
    + `marge moyenne ${steady.meanMargin.toFixed(1)}`);
  return lines.join('\n');
}

// Exécutable directement : node tests/tools/simulate.mjs
if (process.argv[1] && process.argv[1].endsWith('simulate.mjs')) {
  console.log(report(simulate({ seed: 1 }), 'Utilisateur qui sous-estime ses durées (biais moyen 1,4) :'));
  console.log();
  console.log(report(simulate({ seed: 1, stepBias: 1, stepBiasSpread: 0 }), 'Le même, s\'il déclarait juste :'));
  console.log();
  const first = simulate({ seed: 1 })[0];
  console.log(`Heure de lever moyenne au jour 1 : ${fromMin(Math.round(mean(first.map((r) => r.startMin))))}`);
}

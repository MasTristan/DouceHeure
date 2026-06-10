# CLAUDE.md

Contexte permanent pour Claude Code. Lis ce fichier en entier au début de chaque session avant d'écrire du code. En cas de conflit entre ce fichier et une demande ponctuelle, signale-le au lieu de coder en silence.

---

## 1. Ce qu'on construit

**Douce heure** : une web app d'aide à la ponctualité pour des personnes sujettes au retard chronique et à la cécité temporelle (profils TDAH inclus). Elle réveille (mode chevet), guide la préparation étape par étape, apprend les durées réelles ET les trajets réels, et gère tous les départs de la journée, sans jamais presser ni culpabiliser.

Ce n'est pas un minuteur. La valeur tient dans trois moteurs : un guidage à confirmation manuelle qui reste synchronisé avec le réel, un apprentissage on-device des durées réelles de l'utilisateur, et un apprentissage des trajets réels par destination et transport.

La spécification Pro Max v2 fait foi pour le détail. Ce fichier est le résumé permanent ; la spec est la référence. Quand un comportement est ambigu ici, va voir la spec, puis les règles produit ci-dessous.

---

## 2. Règles produit non négociables

Ces cinq règles tranchent toute décision. Une fonctionnalité qui en viole une est refusée, même si elle parait utile.

- **R1. Guider vers l'action, jamais vers le temps.** Aucun compte à rebours, aucune durée restante affichée nulle part, ni prononcée par la voix (F2). Les messages disent quoi faire, pas combien de temps il reste. Une heure cible (heure de départ, heure de lever) est autorisée ; un décompte jamais.
- **R2. Ne jamais présumer qu'une étape est finie.** L'app n'avance jamais seule entre les étapes. L'étape courante ne change que sur confirmation explicite (appui tenu 600 ms par défaut, tap simple en option d'accessibilité). Cette règle s'étend au réveil : seul l'appui tenu lance la session du matin.
- **R3. N'apprendre que du réel.** Le moteur d'apprentissage n'enregistre que des durées réellement mesurées entre deux confirmations, et des trajets réellement mesurés entre "Je pars" et "Je suis arrivé" (bornés à [5, 180] min). Un appui interrompu, une étape sautée, une étape polluée par un imprévu (F6) : aucune écriture.
- **R4. Marge de sécurité invisible.** Un buffer adaptatif est intégré au calcul du départ mais n'est jamais affiché ni nommé à l'utilisateur. Le seuil du mode rattrapage (F3) est lui aussi interne et jamais affiché.
- **R5. Apaiser, jamais culpabiliser.** Aucune formulation négative, aucun score punitif, aucun streak qui se casse, aucun retard chiffré. Le réveil n'escalade jamais en son. Tout retard est accueilli sans drame.

**Test unique de toute décision** : est-ce que cela aide une personne anxieuse à arriver à l'heure sans la presser ? Si ce n'est pas un oui évident, ne le fais pas.

---

## 3. Décisions d'architecture verrouillées

Ne pas rediscuter ni contourner sans validation explicite.

- **Cible principale : iPhone** (Safari iOS standalone). Android compatible mais secondaire. Tester d'abord le comportement iOS.
- **Distribution : web app ajoutée à l'écran d'accueil** via le menu Partage de Safari. Pas d'App Store, pas de compte développeur Apple.
- **Coût strictement nul.** Aucun serveur, aucune infrastructure, aucune dépendance payante, aucun backend, aucun service tiers. Les polices sont auto-hébergées : zéro requête tierce.
- **Guidage app ouverte uniquement.** Sur iOS, une web app ne notifie pas de façon fiable quand elle est fermée. Le guidage et le réveil fonctionnent au premier plan seulement. Deux conséquences obligatoires : Wake Lock pendant la session et la nuit (mode chevet), et prévenir honnêtement l'utilisateur avant.
- **Stack : HTML / CSS / JavaScript vanilla, zéro dépendance runtime, zéro bundler.** APIs navigateur uniquement : Wake Lock, Web Audio, Web Speech (speechSynthesis), Vibration, Web Share, File. Le `package.json` ne sert qu'aux tests node. Le Service Worker sert uniquement au cache hors-ligne, jamais aux notifications.
- **Budgets** : JS total < 220 KB non minifié, canvas ambiant à 12 fps max, First Paint < 1 s sur iPhone 12.

---

## 4. Architecture du repo

```
douce-heure/
  index.html              # point d'entrée unique + sprite SVG des icônes
  manifest.webmanifest    # standalone, icônes
  service-worker.js       # cache hors-ligne UNIQUEMENT, versionné
  package.json            # type:module pour les tests node, rien d'autre
  css/
    fonts.css             # @font-face des polices auto-hébergées
    tokens.css            # variables de design, 4 scènes via [data-scene]
    base.css              # reset, layout, échelle typo, fond vivant
    components.css        # boutons, cartes, pills, live, chevet, studio
  js/
    store.js              # état persistant localStorage v2 + migrate()
    time.js               # toMin, fromMin
    predict.js            # apprentissage on-device + predictTravel + marge
    plan.js               # séquence à rebours + rattrapage (F3)
    travel.js             # destinations + pendingTrip (F5)
    bedside.js            # logique temporelle du mode chevet (F1)
    backup.js             # export/import JSON validé (F7)
    audio.js              # signatures pentatoniques, nappe, son de réveil
    speech.js             # guidage vocal speechSynthesis (F2)
    haptics.js            # patterns navigator.vibrate
    scene.js              # scènes, lumière de session, canvas ambiant
    icons.js              # helper du sprite SVG maison
    card.js               # carte du matin, canvas 1080x1920 + partage
    wakelock.js           # maintien écran allumé
    social.js             # liens sms/mailto vers les proches (réels)
    ui.js                 # rendu des écrans, navigation
    studio.js             # compositeur de départs
    app.js                # orchestration, démarrage, paramètres d'URL (F8)
  assets/
    fonts/                # woff2 auto-hébergés (Fraunces, Outfit, Atkinson)
  tests/                  # tests node (node --test tests/*.test.mjs)
  CLAUDE.md               # ce fichier
```

**Séparation stricte** : la logique métier (`store`, `time`, `predict`, `plan`, `travel`, `bedside`, validation de `backup`) ne touche jamais au DOM. Le rendu (`ui`, `studio`) ne contient aucune règle de calcul. Cette séparation rend la logique testable sans navigateur. Ne pas la casser.

---

## 5. Modèle de données v2

État unique sérialisé en JSON dans une seule clé localStorage. Ne pas éclater en plusieurs clés. Champ `version: 2` obligatoire, migration automatique depuis v1 au premier chargement (`store.js`, `migrate(state)`).

```
{
  version: 2,
  name, latenessScore,               // latenessScore: 0 ponctuel -> 1 chronique
  onboarded: bool,
  settings: {
    confirmMode: 'hold'|'tap',       // défaut 'hold'
    scene: 'auto'|'dawn'|'day'|'evening',
    ambient, haptics, readable, sound: bool,
    voice: { enabled, rate, voiceURI }
  },
  profiles: [ { id, name, icon,      // icon: clé du sprite SVG
    steps: [ { key, label, icon, emoji|null, est, active, fixed,
               kind: 'core'|'comfort',
               real: [ { v, day, type } ] } ],   // max 8, FIFO
    checklist: [ { id, label, done } ],
    defaults: { arrival|null, transport, destinationId|null } } ],
  activeProfileId,
  destinations: [ { id, label,
    byTransport: { [transport]: { real: [ { v, day } ] } } } ],  // max 8, FIFO
  bedside: { wakeTime, profileId, lightLeadMin, sound, armedWakeTs? } | null,
  pendingTrip: { leaveTs, destinationId, transport } | null,
  history: [ { ts, status, day, type, profileId } ],
  routine, contacts
}
```

Règles R3 appliquées au modèle : on n'écrit dans `step.real` que des durées mesurées en live entre deux confirmations ; on n'écrit dans `destinations[].byTransport[].real` que des trajets mesurés entre "Je pars" et "Je suis arrivé", bornés à [5, 180] minutes (hors bornes : rejet silencieux). `pendingTrip` est purgé après 4 h sans écriture.

---

## 6. Pièges connus (à ne jamais réintroduire)

- **Le bug de la douche.** Symptôme : l'app passe seule à l'étape suivante. Cause : faire avancer l'étape courante sur une horloge théorique. **Correctif imposé et permanent : l'horloge sert UNIQUEMENT à savoir si on est dans les temps. Elle ne change JAMAIS l'étape courante. Seul un geste de confirmation accompli avance.** Vaut aussi pour le réveil (l'aube ne lance jamais le live) et la reprise d'imprévu. Toute régression est bloquante.
- **Appui interrompu.** Un appui tenu relâché avant 600 ms n'avance rien et n'écrit rien. Pas d'écriture partielle.
- **Marge affichée.** Ne jamais laisser fuiter la marge de sécurité ni le seuil de rattrapage dans une chaine affichable OU prononçable (R4). Test automatique dans `tests/copy.test.mjs`.
- **Compte à rebours déguisé.** Pas de "il reste X min", pas de timer visible, ni à l'écran ni en voix (R1).
- **Autoplay audio iOS.** AudioContext et speechSynthesis doivent être déverrouillés dans la chaîne d'un geste utilisateur (tap de lancement du live, "Bonne nuit" du chevet). Le matin, si le contexte est suspendu malgré tout : repli lumière + vibration, son restauré au premier tap. Ne jamais supposer que le son partira sans geste préalable.
- **pendingTrip qui pollue.** Un trajet en attente hors bornes [5, 180] min ou vieux de plus de 4 h ne donne JAMAIS de mesure. Purge silencieuse, pas de toast d'erreur.
- **Scène Nuit par l'horloge.** La scène `night` n'est JAMAIS choisie par l'heure locale ni par les réglages : uniquement par le mode chevet (F1). L'horloge ne pilote que dawn/day/evening.
- **localStorage éclaté.** Tout l'état dans une seule clé. Pas de multiplication de clés.
- **Mesures théoriques injectées.** Ne jamais nourrir le modèle avec `est` ou une estimation déclarative comme si c'était une mesure réelle (R3).
- **Requête réseau de données perso.** Aucune. Aucune requête tierce non plus : les polices sont auto-hébergées. Vérifiable dans l'onglet réseau.

---

## 7. Conventions de code

- **Français** pour tous les textes affichés à l'utilisateur et les commentaires de logique métier. Noms de variables et fonctions en anglais court.
- **Pas de tiret cadratin** (le caractère long) nulle part, ni dans le code, ni dans les textes affichés, ni dans les commentaires. Utiliser un point médian ou une virgule.
- **Tous les textes affichés ET prononcés viennent de `copy.js`** (la voix F2 prononce exactement les chaînes affichées). Ton : lucide, direct, légèrement complice. Le moment de partir est un soulagement, pas une alarme (R5).
- **Fonctions pures** dans la logique métier : entrées, sortie, pas d'effet de bord caché. Facilite les tests.
- **Pas de magie implicite.** Préférer du code lisible et explicite à du code court et malin.
- **Aucune couleur en dur** hors de `tokens.css` : quatre scènes, un seul fichier de tokens.

---

## 8. Algorithmes clés (résumé, détail dans la spec)

- **`predict(step, ctx)`** : durée à utiliser = moyenne pondérée des mesures réelles segmentées par contexte (jour, type), pondération croissante avec le nombre de mesures. Rend aussi la variance. Si aucune mesure : estimation initiale, variance 0.
- **`predictTravel(destination, transport, ctx, fallback)`** : même logique pour les trajets, segmentée par jour et par transport. `buildPlan` consomme cette durée à la place de la valeur déclarative dès que `confidence > 0`.
- **`safetyMargin(totalVariance, latenessScore, varBoost)`** : `round(3 + min(totalVariance*0.8*varBoost, 10) + latenessScore*8)`. `varBoost = 1.5` pour une destination encore jamais mesurée. Invisible (R4).
- **`buildPlan(...)`** : place les étapes à rebours depuis l'heure de départ, elle-même = arrivée moins trajet (prédit ou déclaré) moins buffer transport moins marge.
- **Avancement live** : `suggested` quand `elapsed >= dur`. `nudge` quand `elapsed >= max(dur*1.6, dur+4)`. La confirmation mesure `now - startedAt`, l'enregistre (sauf pollution F6), recale la lumière de scène, incrémente l'étape. Jamais d'avancement automatique.
- **Rattrapage (F3)** : si la projection de départ dépasse le départ planifié de `max(6, marge)` minutes, UNE proposition par session d'alléger les étapes `kind:'comfort'` restantes. Jamais les `core` ni les `fixed`. Aucun chiffre affiché.
- **Chevet (F1)** : cible de réveil = timestamp absolu recalculé à chaque tick de 30 s (aucune dérive). Aube logicielle sur `lightLeadMin` minutes, son montant sur 90 s, "Pas encore" = re-proposition lumineuse silencieuse après 5 min.

---

## 9. Workflow attendu

- **Construire dans l'ordre des jalons de la spec v2** (§18). Ne pas sauter d'étape.
- **Après chaque jalon, faire passer les tests node** : `node --test tests/*.test.mjs`. Ils couvrent predict, predictTravel, buildPlan, rescue, travel, bedside, migrate, backup et les règles de chaînes (R1/R4/R5).
- **Tester sur iPhone réel** avant toute livraison. La recette complète est dans la spec, §19. Le bug de la douche, l'appui interrompu et l'absence de compte à rebours sont des tests bloquants. Le mode chevet exige une nuit réelle branchée.
- **Vérifier l'onglet réseau** : aucune requête de données personnelles, aucune requête tierce.

---

## 10. Ce qui est hors périmètre

Ne pas implémenter sans demande explicite : notifications en arrière-plan ou push, backend ou serveur, compte utilisateur, synchronisation multi-appareils, météo, itinéraires, gamification et streaks, import .ics, étapes parallèles, intégration calendrier tiers. L'écran social factice a été supprimé en v2 : seuls les contacts de prévenance réels (sms/mailto) existent, rattachés à l'écran de départ.

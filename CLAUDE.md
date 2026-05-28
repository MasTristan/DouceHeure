# CLAUDE.md

Contexte permanent pour Claude Code. Lis ce fichier en entier au début de chaque session avant d'écrire du code. En cas de conflit entre ce fichier et une demande ponctuelle, signale-le au lieu de coder en silence.

---

## 1. Ce qu'on construit

**Douce heure** : une web app d'aide à la ponctualité pour des personnes sujettes au retard chronique et à la cécité temporelle (profils TDAH inclus). Elle guide la préparation du matin étape par étape, à la voix et à l'écran, sans jamais presser ni culpabiliser.

Ce n'est pas un minuteur. La valeur tient dans deux moteurs : un guidage à confirmation manuelle qui reste synchronisé avec le réel, et un apprentissage on-device des durées réelles de l'utilisateur.

La spécification d'implémentation complète fait foi pour le détail. Ce fichier est le résumé permanent ; la spec est la référence. Quand un comportement est ambigu ici, va voir la spec, puis les règles produit ci-dessous.

---

## 2. Règles produit non négociables

Ces cinq règles tranchent toute décision. Une fonctionnalité qui en viole une est refusée, même si elle parait utile.

- **R1. Guider vers l'action, jamais vers le temps.** Aucun compte à rebours, aucune durée restante affichée nulle part. Les messages disent quoi faire, pas combien de temps il reste.
- **R2. Ne jamais présumer qu'une étape est finie.** L'app n'avance jamais seule entre les étapes. L'étape courante ne change que sur confirmation explicite par tap. Rappel doux si silence prolongé, mais sans avancer.
- **R3. N'apprendre que du réel.** Le moteur d'apprentissage n'enregistre que des durées réellement mesurées entre deux confirmations. Jamais de durée théorique ou estimée injectée comme mesure.
- **R4. Marge de sécurité invisible.** Un buffer adaptatif est intégré au calcul du départ mais n'est jamais affiché ni nommé à l'utilisateur.
- **R5. Apaiser, jamais culpabiliser.** Aucune formulation négative, aucun score punitif, aucun streak qui se casse. Tout retard est accueilli sans drame.

**Test unique de toute décision** : est-ce que cela aide une personne anxieuse à arriver à l'heure sans la presser ? Si ce n'est pas un oui évident, ne le fais pas.

---

## 3. Décisions d'architecture verrouillées

Ne pas rediscuter ni contourner sans validation explicite.

- **Cible principale : iPhone** (Safari iOS). Android compatible mais secondaire. Tester d'abord le comportement iOS.
- **Distribution : web app ajoutée à l'écran d'accueil** via le menu Partage de Safari. Pas d'App Store, pas de compte développeur Apple, pas de lien d'installation complexe.
- **Coût strictement nul.** Aucun serveur, aucune infrastructure, aucune dépendance payante, aucun backend.
- **Guidage app ouverte uniquement.** Sur iOS, une web app ne notifie pas de façon fiable quand elle est fermée. Décision fondateur : le guidage fonctionne au premier plan seulement. Deux conséquences obligatoires : maintenir l'écran allumé via Wake Lock pendant la session, et prévenir honnêtement l'utilisateur avant de lancer le guide.
- **Stack : HTML / CSS / JavaScript vanilla, zéro dépendance.** Pas de framework, pas de bundler, pas de npm install pour le runtime. Fichiers statiques servables tels quels. Le Service Worker sert uniquement au cache hors-ligne, jamais aux notifications.

---

## 4. Architecture du repo

```
douce-heure/
  index.html              # point d'entrée unique
  manifest.webmanifest    # standalone, icônes
  service-worker.js       # cache hors-ligne UNIQUEMENT
  css/
    tokens.css            # variables de design (source de vérité visuelle)
    base.css              # reset, layout, écrans
    components.css        # boutons, cartes, pills, toasts
  js/
    store.js              # état persistant localStorage + accès
    time.js               # toMin, fromMin
    predict.js            # apprentissage on-device + marge invisible
    plan.js               # construction de la séquence à rebours
    audio.js              # signatures sonores Web Audio
    wakelock.js           # maintien écran allumé
    ui.js                 # rendu des écrans, navigation
    app.js                # orchestration, démarrage
  assets/                 # icônes
  CLAUDE.md               # ce fichier
```

**Séparation stricte** : la logique métier (`store`, `time`, `predict`, `plan`) ne touche jamais au DOM. Le rendu (`ui`) ne contient aucune règle de calcul. Cette séparation rend la logique testable sans navigateur. Ne pas la casser.

---

## 5. Modèle de données

État unique sérialisé en JSON dans une seule clé localStorage. Ne pas éclater en plusieurs clés.

```
{
  name, sound, latenessScore,        // latenessScore: 0 ponctuel -> 1 chronique, défaut 0.5
  steps: [ { key, label, emoji, est, active, fixed,
             real: [ { v, day, type } ] } ],   // real: max 8, FIFO
  history: [ { ts, status, day, type } ],       // status: early|ontime|late
  routine: { arrival, transport, travel, days[], evening } | null
}
```

Règle R3 appliquée au modèle : on n'écrit dans `step.real` que des durées mesurées pendant le live. Une étape non confirmée pendant une session ne reçoit aucune mesure.

---

## 6. Pièges connus (à ne jamais réintroduire)

- **Le bug de la douche.** Symptôme : l'app passe seule à l'étape suivante alors que l'utilisateur est encore sur la précédente, puis croit qu'il y est depuis X minutes. Cause : faire avancer l'étape courante sur une horloge théorique. **Correctif imposé et permanent : l'horloge sert UNIQUEMENT à savoir si on est dans les temps. Elle ne change JAMAIS l'étape courante. Seul un tap de confirmation avance.** Toute régression sur ce point est bloquante.
- **Marge affichée.** Ne jamais laisser fuiter la marge de sécurité dans une chaine affichable (R4).
- **Compte à rebours déguisé.** Pas de "il reste X min", pas de timer visible, même sous une autre forme (R1).
- **localStorage éclaté.** Tout l'état dans une seule clé. Pas de multiplication de clés.
- **Mesures théoriques injectées.** Ne jamais nourrir le modèle avec `est` comme si c'était une mesure réelle (R3).
- **Requête réseau de données perso.** Aucune. Seules requêtes tolérées : polices et fichiers statiques de l'app. Vérifiable dans l'onglet réseau.

---

## 7. Conventions de code

- **Français** pour tous les textes affichés à l'utilisateur et les commentaires de logique métier. Noms de variables et fonctions en anglais court.
- **Pas de tiret cadratin** (le caractère long) nulle part, ni dans le code, ni dans les textes affichés, ni dans les commentaires. Utiliser un point médian ou une virgule.
- **Ton des messages utilisateur** : chaleureux, jamais impératif sec. "C'est le moment de ta douche, prends ce temps pour toi", pas "Va te doucher". Le moment de partir est un soulagement, pas une alarme (R5).
- **Fonctions pures** dans la logique métier : entrées, sortie, pas d'effet de bord caché. Facilite les tests.
- **Pas de magie implicite.** Préférer du code lisible et explicite à du code court et malin. Les futurs lecteurs incluent des humains non experts.

---

## 8. Algorithmes clés (résumé, détail dans la spec)

- **`predict(step, ctx)`** : durée à utiliser = moyenne pondérée des mesures réelles segmentées par contexte (jour, type), pondération croissante avec le nombre de mesures. Rend aussi la variance. Si aucune mesure : rend l'estimation initiale, variance 0.
- **`safetyMargin(totalVariance, latenessScore)`** : `round(3 + min(totalVariance*0.8, 10) + latenessScore*8)`. Invisible (R4).
- **`buildPlan(...)`** : place les étapes à rebours depuis l'heure de départ, elle-même = arrivée moins trajet moins buffer transport moins marge.
- **Avancement live** : `suggested` quand `elapsed >= dur`. `nudge` quand `elapsed >= max(dur*1.6, dur+4)`. `confirmNext()` mesure `now - startedAt`, l'enregistre, recale la fin de séquence, incrémente l'étape. Jamais d'avancement automatique.

---

## 9. Workflow attendu

- **Construire dans l'ordre des étapes de build de la spec** (socle, état/temps, moteurs, live, feedback, son/rituel/social). Ne pas sauter d'étape.
- **Après chaque étape, faire passer ses critères d'acceptation** avant de continuer.
- **Tester sur iPhone réel** avant toute livraison. La recette complète est dans la spec, section tests. Le bug de la douche et l'absence de compte à rebours sont des tests bloquants.
- **Vérifier l'onglet réseau** : aucune requête de données personnelles.

---

## 10. Ce qui est hors périmètre

Ne pas implémenter sans demande explicite : notifications en arrière-plan, backend ou serveur, compte utilisateur, synchronisation multi-appareils, logique sociale réelle (l'écran social reste une maquette visuelle avec bandeau explicite), gamification, intégration calendrier tiers, synthèse vocale parlée.

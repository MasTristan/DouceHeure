# Douce heure

Web app d'aide à la ponctualité pour les personnes sujettes au retard chronique et à la cécité temporelle, profils TDAH inclus. Elle réveille (mode chevet), guide la préparation étape par étape, apprend les durées réelles et les trajets réels, et gère tous les départs de la journée, sans jamais presser ni culpabiliser.

Ce n'est pas un minuteur. La valeur tient dans trois moteurs : un guidage à confirmation manuelle qui reste synchronisé avec le réel, un apprentissage on-device des durées réelles de l'utilisateur, et un apprentissage des trajets réels par destination et transport.

## Principes produit

Cinq règles tranchent toute décision.

- **R1.** Guider vers l'action, jamais vers le temps. Aucun compte à rebours, aucune durée restante affichée ni prononcée.
- **R2.** Ne jamais présumer qu'une étape est finie. L'app n'avance qu'à la confirmation explicite de l'utilisateur (appui tenu 600 ms par défaut). Vaut aussi pour le réveil.
- **R3.** N'apprendre que du réel. Seules les durées mesurées entre deux confirmations et les trajets mesurés entre "Je pars" et "Je suis arrivé" alimentent le modèle.
- **R4.** Marge de sécurité invisible. Un buffer adaptatif est intégré au calcul mais jamais affiché ni nommé.
- **R5.** Apaiser, jamais culpabiliser. Aucun score punitif, aucun streak qui se casse, aucun retard chiffré, jamais de sonnerie brutale.

## Fonctionnalités v2

- **Mode chevet (F1)** : le téléphone passe la nuit en charge, écran en quasi-noir OLED. Aube logicielle progressive, son de réveil génératif montant sur 90 s, puis enchaînement direct sur le guidage du matin. Sans aucune notification.
- **Guidage vocal (F2)** : speechSynthesis on-device, prononce exactement les textes affichés. Off par défaut.
- **Mode rattrapage (F3)** : quand le matin déborde, une proposition unique et douce d'alléger les étapes confort. Jamais de chiffre de retard.
- **Départs généralisés (F4)** : jusqu'à 6 profils complets (étapes, checklist, destination, transport, heure d'arrivée), archétypes à la création.
- **Trajets réels (F5)** : destinations apprises par mode de transport, mesures bornées [5, 180] min, le réel remplace le déclaratif.
- **Bouton imprévu (F6)** : pause explicite, aucune mesure polluée n'entre dans le modèle.
- **Export et import (F7)** : sauvegarde JSON locale, validation stricte à l'import.
- **Pont Raccourcis iOS (F8)** : paramètres d'URL `?profil=`, `&arrivee=HH:MM`, `&go=1`, `&chevet=HH:MM`.
- **Carte du matin** : image générée localement, partagée seulement si l'utilisateur le décide.
- **Lumière Vivante** : trois scènes diurnes pilotées par l'horloge, une scène Nuit réservée au chevet, fond canvas ambiant avec repli CSS. La progression du matin est de la lumière, jamais un chiffre.

## Architecture

- Cible principale : iPhone, Safari iOS standalone. Compatible Android.
- Distribution : web app ajoutée à l'écran d'accueil. Pas d'App Store, pas de backend, pas de compte.
- Coût : strictement nul. Aucun serveur, aucune dépendance, aucun service tiers. Polices auto-hébergées.
- Guidage app ouverte uniquement. Wake Lock pendant la session et la nuit, l'utilisateur est prévenu avant.
- Stack : HTML, CSS et JavaScript vanilla, zéro dépendance runtime, zéro bundler. Service Worker pour le cache hors-ligne seulement.

## Structure du repo

```
douce-heure/
  index.html              point d'entrée unique + sprite SVG des icônes
  manifest.webmanifest    standalone, icônes
  service-worker.js       cache hors-ligne uniquement, versionné
  package.json            type:module pour les tests node, rien d'autre
  css/
    fonts.css             polices auto-hébergées (@font-face)
    tokens.css            variables de design, 4 scènes
    base.css              reset, layout, échelle typo, fond vivant
    components.css        boutons, cartes, pills, live, chevet, studio
  js/
    store.js              état persistant localStorage v2 + migration
    time.js               utilitaires toMin, fromMin
    now.js                contexte temporel courant (ctxNow, nowMinutes)
    predict.js            apprentissage on-device + trajets + marge invisible
    plan.js               séquence à rebours + rattrapage
    travel.js             destinations + trajets en attente
    bedside.js            logique temporelle du mode chevet
    learned.js            ce que l'app a appris, en données pures
    backup.js             export/import JSON validé
    audio.js              signatures pentatoniques, nappe, son de réveil
    speech.js             guidage vocal
    haptics.js            patterns de vibration
    scene.js              scènes, lumière de session, canvas ambiant
    icons.js              helper du sprite SVG maison
    card.js               carte du matin (canvas + partage)
    wakelock.js           maintien écran allumé
    social.js             liens vers les proches (sms, WhatsApp...)
    clock.js              horloge et minuteries injectables
    confirm-control.js    machine d'état du geste de confirmation
    live.js               décision pure d'avancement du guidage en direct
    copy.js                tous les textes affichés et prononcés
    studio.js             compositeur de départs
    app.js                point de composition : démarrage, paramètres d'URL
    ui/                   dom.js, shell.js, nav.js, gesture.js (socle du rendu)
    live/                 état et rendu du guidage en direct (F2/F3/F4)
    night/                état et rendu du mode chevet (F1)
    screens/              les huit écrans plats (onboarding, accueil, aperçu...)
  assets/fonts/           woff2 auto-hébergés
  tests/                  tests node de la logique pure
```

La logique métier (`store`, `time`, `now`, `predict`, `plan`, `travel`, `bedside`, `learned`) ne touche jamais au DOM. Le rendu (`ui/*`, `live/*`, `night/*`, `screens/*`, `studio`) ne contient aucune règle de calcul.

## État des données

Tout l'état tient dans une seule clé localStorage, sérialisée en JSON (schéma v2, migration automatique depuis v1). Aucune donnée ne quitte l'appareil. Après le premier chargement, l'app fonctionne entièrement hors-ligne, polices comprises : aucune requête tierce.

## Lancer en local

L'app est entièrement statique. Servir le dossier avec n'importe quel serveur HTTP :

```bash
python3 -m http.server 8080
```

Puis ouvrir `http://localhost:8080`. Pour tester l'installation sur l'écran d'accueil, le Wake Lock et le mode chevet, ouvrir l'URL depuis un appareil mobile derrière HTTPS.

## Tests

Logique pure testée sans navigateur :

```bash
node --test tests/*.test.mjs
```

Couvre : predict, predictTravel, safetyMargin, buildPlan, rattrapage, bornes des trajets, purge du pendingTrip, phases du chevet, migration v1 vers v2, export/import, et les règles de chaînes (aucun temps restant, aucune marge nommée, aucun tiret cadratin).

## Tests d'acceptation bloquants

À valider sur appareil réel avant toute livraison.

- L'étape courante n'avance jamais seule, y compris au réveil et après une pause imprévu.
- Un appui tenu interrompu n'avance rien et n'écrit rien.
- Aucun compte à rebours ni durée restante n'apparait à l'écran ni dans la voix.
- La marge de sécurité et le seuil de rattrapage n'apparaissent dans aucune chaine.
- Trajet : mesure écrite uniquement dans [5, 180] min, trajet en attente purgé après 4 h.
- Mode chevet : nuit complète branchée, écran allumé, aube et son à l'heure, audio fonctionnel au matin.
- L'écran reste allumé pendant toute la session de guidage.
- Mode avion après premier chargement : tout fonctionne, polices et voix système comprises.
- L'onglet réseau ne montre aucune requête contenant des données utilisateur, aucune requête tierce.
- Export puis import sur un appareil vierge : état strictement identique.

## Périmètre

Hors périmètre tant que non demandé : notifications en arrière-plan ou push, backend, compte utilisateur, synchronisation multi-appareils, météo, itinéraires, gamification, import .ics, étapes parallèles, intégration calendrier tiers.

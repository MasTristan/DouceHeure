# Douce heure

Web app d'aide à la ponctualité pour les personnes sujettes au retard chronique et à la cécité temporelle, profils TDAH inclus. Elle guide la préparation du matin étape par étape, sans jamais presser ni culpabiliser.

Ce n'est pas un minuteur. La valeur tient dans deux moteurs : un guidage à confirmation manuelle qui reste synchronisé avec le réel, et un apprentissage on-device des durées réelles de l'utilisateur.

## Principes produit

Cinq règles tranchent toute décision.

- **R1.** Guider vers l'action, jamais vers le temps. Aucun compte à rebours, aucune durée restante affichée.
- **R2.** Ne jamais présumer qu'une étape est finie. L'app n'avance qu'à la confirmation explicite de l'utilisateur.
- **R3.** N'apprendre que du réel. Seules les durées mesurées entre deux confirmations alimentent le modèle.
- **R4.** Marge de sécurité invisible. Un buffer adaptatif est intégré au calcul mais jamais nommé.
- **R5.** Apaiser, jamais culpabiliser. Aucun score punitif, aucun streak qui se casse.

## Architecture

- Cible principale : iPhone, Safari iOS. Compatible Android.
- Distribution : web app ajoutée à l'écran d'accueil. Pas d'App Store, pas de backend, pas de compte.
- Coût : strictement nul. Aucun serveur, aucune dépendance payante.
- Guidage app ouverte uniquement. Wake Lock pendant la session, l'utilisateur est prévenu avant.
- Stack : HTML, CSS et JavaScript vanilla, zéro dépendance runtime. Service Worker pour le cache hors-ligne seulement.

## Structure du repo

```
douce-heure/
  index.html              point d'entrée unique
  manifest.webmanifest    standalone, icônes
  service-worker.js       cache hors-ligne uniquement
  css/
    tokens.css            variables de design
    base.css              reset, layout, écrans
    components.css        boutons, cartes, pills, toasts
  js/
    store.js              état persistant localStorage
    time.js               utilitaires toMin, fromMin
    predict.js            apprentissage on-device + marge invisible
    plan.js               construction de la séquence à rebours
    audio.js              signatures sonores Web Audio
    wakelock.js           maintien écran allumé
    ui.js                 rendu des écrans, navigation
    app.js                orchestration, démarrage
  assets/                 icônes
```

La logique métier (`store`, `time`, `predict`, `plan`) ne touche jamais au DOM. Le rendu (`ui`) ne contient aucune règle de calcul.

## État des données

Tout l'état tient dans une seule clé localStorage, sérialisée en JSON. Aucune donnée ne quitte l'appareil. Les seules requêtes réseau autorisées sont le chargement des polices et des fichiers statiques de l'app.

## Lancer en local

L'app est entièrement statique. Servir le dossier avec n'importe quel serveur HTTP :

```bash
python3 -m http.server 8080
```

Puis ouvrir `http://localhost:8080`. Pour tester l'installation sur l'écran d'accueil et le Wake Lock, ouvrir l'URL depuis un appareil mobile derrière HTTPS.

## Tests d'acceptation bloquants

À valider sur appareil réel avant toute livraison.

- L'étape courante n'avance jamais seule, quel que soit le temps écoulé.
- Aucun compte à rebours ni durée restante n'apparait à l'écran.
- La marge de sécurité n'apparait dans aucune chaine affichable.
- L'écran reste allumé pendant toute la session de guidage.
- L'onglet réseau ne montre aucune requête contenant des données utilisateur.

## Périmètre

Hors périmètre tant que non demandé : notifications en arrière-plan, backend, compte utilisateur, synchronisation multi-appareils, logique sociale réelle, gamification, intégration calendrier tiers, synthèse vocale parlée.

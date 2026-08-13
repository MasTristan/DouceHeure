# Douce heure · Vision de reprise

Document d'ouverture. Écrit par la nouvelle direction du projet, après lecture intégrale
du code, des tests et de la spec Pro Max v2. Il fixe le diagnostic, la thèse produit et le
cap des prochains jalons. Il ne remplace pas `CLAUDE.md` (les règles R1 à R5 et les
décisions d'architecture restent verrouillées) : il dit quoi faire de ce socle.

> **Révisé après la réunion d'arbitrage.** Cinq membres sur six ont contesté le
> séquencement de ce document, depuis cinq angles indépendants, sans s'être concertés. J'ai
> concédé. Les passages corrigés sont signalés en place ; le détail des décisions et de ce
> qui les a emportées est dans `reunions/r2-arbitrage.md`. Le cap n'a pas bougé, son ordre
> d'exécution oui.

---

## 1. État des lieux, sans complaisance

Le projet n'a pas été abandonné parce qu'il était mauvais. Il a été abandonné en haut de
la courbe : la v2 a livré beaucoup, d'un coup, et personne n'est resté pour voir ce que ça
donnait au bout de trois semaines.

**Ce qui est solide et qu'on ne touche pas.**

- Un point de vue. R1 à R5 ne sont pas des slogans, ils sont écrits pour être opposables.
  **Corrigé après R2, et la correction compte** : `tests/copy.test.mjs` couvre 246 chaînes
  de `copy.js`, donc R1, R4 et R5 partiellement. Il ne couvre ni la cinquantaine de
  littéraux français qui vivent hors du fichier, ni R2, ni R3. **Sur cinq règles, une et
  demie sont réellement exécutables par une machine.** J'avais écrit le contraire, et c'est
  la moitié rassurante de la phrase qui était fausse. On ne finance jamais la protection de
  ce qu'on croit déjà protégé.
- La séparation métier / rendu tient réellement. `predict`, `plan`, `travel`, `bedside`,
  `store` sont purs et testés hors navigateur. 41 tests verts.
- Zéro dépendance, zéro serveur, zéro requête tierce. Contrainte tenue jusqu'au bout,
  polices auto-hébergées comprises. C'est un actif rare et il se défend.
- Le mode chevet est calculé sur un timestamp absolu, pas sur un compteur qui dérive.
  C'est la bonne décision et elle est déjà prise.

**Ce qui menace le projet, par ordre de gravité.**

1. **La première semaine est le point faible, et c'est là que l'utilisateur décide.**
   Le moteur d'apprentissage garde 8 mesures par étape, en FIFO, alimentées une fois par
   jour. Il lui faut donc environ huit matins pour avoir un avis. Une personne qui teste
   une app de ponctualité tranche au troisième. Aujourd'hui, jour 1 à jour 7, l'app tourne
   sur des estimations déclaratives : elle est exactement aussi bonne qu'un post-it, au
   moment précis où elle doit prouver qu'elle est autre chose.
2. **`ui.js` fait 2 006 lignes et n'est couvert par aucun test.** *Corrigé après R2* :
   j'avais écrit que c'était « le seul fichier où les régressions R1 et R2 peuvent naître ».
   C'est inexact, et cette inexactitude est ce qui rendait mon ordre dangereux. Elles
   naissent dans `liveStatus()`, `confirmNext()` et `nightTick()`, soit **environ 25 lignes
   réellement décisionnelles sur 2 006**. Le reste est du montage de nœuds : pénible à lire,
   quasi incapable de faire avancer une étape tout seul. Conséquence directe sur le plan :
   on extrait et on teste les 25 lignes d'abord, on découpe les 2 006 ensuite.
3. **Aucune intégration continue.** Les tests existent et personne ne les exécute
   automatiquement. La qualité tient à la discipline d'une équipe qui n'est plus là.
4. **La liste `ASSETS` du service worker est maintenue à la main.** Un fichier JS ajouté
   et oublié, et l'app casse hors-ligne, silencieusement, chez les seuls utilisateurs qui
   ont vraiment installé le produit.
5. **Des boîtes de dialogue natives** (`confirm`, `prompt`) restent dans quatre chemins,
   dont la sortie du mode chevet en pleine nuit et la suppression d'un départ. Un
   `confirm()` système à 3 h du matin, dans une app dont la promesse est de ne jamais
   agresser, est une contradiction de marque.
6. **Rien ne dit si l'app fonctionne.** Pas de télémétrie, par choix, et ce choix est bon.
   Mais il n'existe aucun substitut : ni protocole de test utilisateur, ni recette
   longue-durée, ni miroir local honnête. On construit à l'aveugle.

Aucun de ces six points n'est une fonctionnalité manquante. C'est le diagnostic central :
**le projet n'a pas besoin de plus de produit, il a besoin de tenir.**

**Cette liste était incomplète, et c'est le principal apport de la réunion d'ouverture.**
Huit défauts vérifiés dans le code n'y figuraient pas, dont les deux plus graves du projet :
les mesures du matin sont perdues dès que l'utilisateur ferme l'app, ce que l'app elle-même
lui propose de faire ; et le chemin clavier confirme instantanément, ce qui viole R2 et
remplit la mémoire du modèle de fausses durées d'une minute. S'y ajoutent une fuite de Wake
Lock qui empêche l'écran de s'éteindre après la première session, et l'impossibilité de
confirmer quoi que ce soit sous VoiceOver. Ils forment le jalon J0, décrit dans
`specs/S0-ce-qui-saigne.md`. Coût cumulé : moins de 150 lignes.

---

## 2. La thèse

> Douce heure n'a pas à être excellente au bout d'un mois.
> Elle doit être **supportable dès le premier matin** et **évidente au septième**.

Trois convictions en découlent, et elles arbitrent tout le cycle.

**Le concurrent n'est pas une autre app, c'est l'abandon au jour 4.** Toute décision se
juge à son effet sur les sept premiers matins. Une fonctionnalité brillante qui n'agit
qu'au bout d'un mois passe après une friction retirée au jour 2.

*Nuance imposée par R2, et elle est sévère.* Cette formule est juste pour la majorité et
aveugle pour une minorité. Pour une personne qui utilise VoiceOver, l'abandon n'est pas au
jour 4 : il est au matin 1, étape 1, parce qu'aucune confirmation n'est possible. Aucun
travail sur la première semaine ni sur l'estimateur ne l'atteindra jamais, puisqu'elle
n'atteindra jamais la deuxième étape. J'avais classé l'accessibilité comme une qualité à
ajouter à un produit qui fonctionne ; pour ces gens, le produit ne fonctionne pas du tout.

**L'honnêteté est un moteur, pas une politesse.** L'app dit déjà la vérité sur le Wake
Lock, et cette phrase (« C'est le deal ») est la meilleure du produit. On étend le
principe : l'app doit savoir dire ce qu'elle ne sait pas encore, sans jamais lâcher un
chiffre (R1, R4). C'est difficile, c'est précisément pour ça que ça a de la valeur.

**Le silence est un livrable.** Pas de notification, pas de streak, pas de décompte, pas
de serveur, pas de compte : ce qui n'existe pas dans cette app en est le produit. Donc
chaque jalon doit **retirer** au moins une chose. Une roadmap qui n'additionne que des
écrans est une roadmap qui a perdu le fil.

*Reformulé après R2.* La règle comptait des écrans ; elle doit compter **des décisions
prises après le réveil**. C'est plus exigeant et mieux ciblé : J2 retire le réglage de durée
par étape, c'est-à-dire une question à laquelle l'utilisateur ne peut pas bien répondre.

---

## 3. Ce qu'on refuse pour ce cycle

Pour que le cap tienne, il faut nommer ce qui ne sera pas fait, même si c'est demandé.

- Aucun backend, aucun compte, aucune synchronisation. Non négociable.
- Aucune notification en arrière-plan. La contrainte iOS est réelle, et l'honnêteté sur
  cette limite vaut mieux qu'un contournement fragile.
- **Aucune nouvelle destination de navigation.** Le produit a déjà onze surfaces. Le cycle
  se joue en profondeur, pas en largeur. *Reformulé après R2* : la version initiale disait
  « aucun nouvel écran principal », ce qui aurait interdit une feuille de confirmation
  éphémère qui **remplace** quatre dialogues système et en fait disparaître trois autres. La
  règle interdit toujours un douzième écran, et autorise les surfaces qui réduisent le
  compte.
- Aucune gamification, aucun score visible, aucun historique chiffré de retard.
- Android reste secondaire. On teste iOS d'abord, toujours.

---

## 4. Les jalons

*Réordonnés après R2.* La version initiale comptait quatre jalons et plaçait la découpe de
`ui.js` en tête. Un jalon est apparu devant tous les autres, J1 a été retourné, et deux
éléments sont remontés de J4. Le détail des raisons est dans `reunions/r2-arbitrage.md`.

### J0 · Ce qui saigne
*Nouveau. Huit défauts vérifiés, aucun n'était dans mon diagnostic d'ouverture.*

Les mesures perdues à la fermeture de l'app, le contournement de R2 au clavier qui
empoisonne le modèle, l'impossibilité de confirmer sous VoiceOver, la fuite de Wake Lock,
l'écriture d'état sans garde, le repli mort du service worker, la destination jamais
retenue, la scène Nuit atteignable par un import. Moins de 150 lignes cumulées. Un défaut,
un commit, un test, chaque test éprouvé au rouge.

Spec : `specs/S0-ce-qui-saigne.md`.

### J1 · Socle de confiance
*Retourné. L'ordre est la spec.*

Intégration continue d'abord, dans la première heure. Puis le filet de tests contre le
`ui.js` actuel non modifié, qui fixe le comportement d'aujourd'hui comme référence. Puis
l'extraction des vingt-cinq lignes réellement décisionnelles en machine à états pure. Et
seulement ensuite la découpe par écran. Les quatre dialogues natifs disparaissent ici, pas
en J4 : ce sont des murs bloquants et non simulables, posés sur les deux chemins les plus
destructeurs de l'app.

**Clause d'arrêt.** Si le temps manque, on livre jusqu'à l'extraction et on s'arrête. Un
`ui.js` de 2 006 lignes dont la décision d'avancement est pure et testée vaut mieux qu'un
`ui.js` en vingt fichiers dont personne ne teste l'avancement.

Critère de sortie : quatre conditions vérifiables, dont **le filet éprouvé au rouge sur une
branche jetable**. Mon critère initial, « on peut modifier `ui.js` sans peur », était un
sentiment : il ne se contrôle pas, donc il se déclare, donc il se déclare vrai.

Spec : `specs/S1-socle-de-confiance.md`, et `specs/S2-le-geste.md` pour le composant de
confirmation.

### J2 · La première semaine
*Le jalon le plus important du cycle, et sa cause est maintenant chiffrée.*

Simulations sur le code de production : **un matin sur deux est en retard au jour 1**. Mais
si le même utilisateur déclarait ses durées exactes, ce serait 6 %. **La totalité de
l'échec du premier jour vient du biais de déclaration, pas du moteur.** Demander « combien
de temps prend ta douche » à une personne en cécité temporelle, et bâtir un plan dessus,
est le vice de conception central du produit.

D'où la pièce maîtresse du jalon : ne plus jamais demander une durée. Demander deux heures
d'horloge que la personne connaît réellement. Et retourner le comportement au jour 1, où
la marge est aujourd'hui minimale au moment où l'app est la plus ignorante.

Critère de sortie, révisé : *un testeur qui n'a jamais vu l'app arrive à l'heure au premier
essai, et au septième matin son heure de lever a bougé sans qu'il ait eu à régler quoi que
ce soit.* J'avais écrit qu'il devait « savoir dire ce que l'app a appris de lui » : ça
fabrique de la gamification et ça contredit le §3 ci-dessus. Le progrès se constate, il ne
se raconte pas.

Spec : `specs/S3-la-premiere-semaine.md`.

### J3 · Un moteur qui mérite son nom
*Le diagnostic est plus dur que je ne l'avais écrit.*

Le moteur ne converge pas vers la ponctualité, il converge vers l'avance : **24 minutes
d'avance quotidienne pour un lever 25 minutes plus tôt qu'au premier jour**. Et sa marge
« adaptative » est en réalité une constante, parce que son terme de variance est saturé
**99,8 %** du temps, faute de composer les écarts-types correctement.

Une cible de calibration est donc écrite pour la première fois : 90 % d'arrivées à l'heure
pour 10 minutes d'avance moyenne, contre 97 % pour 24 minutes. J'échange délibérément trois
points de ponctualité contre un quart d'heure de sommeil quotidien.

Critère de sortie : la cible tenue en intégration continue, sur plusieurs profils simulés.

Spec : `specs/S4-le-moteur.md`, décision : `decisions/ADR-002`.

### J4 · Le corps de l'app
*Allégé de ce qui est remonté en J0 et J1.*

Ce qui reste : Dynamic Type, contrastes, forme définitive de la feuille de confirmation,
ergonomie nocturne complète, et la nuit réelle sur appareil réel.

Critère de sortie : la recette de la spec, §19, en entier sur appareil réel, nuit comprise,
VoiceOver compris.


## 5. Comment on travaille

- **La spec Pro Max v2 fait foi**, `CLAUDE.md` résume, ce document donne le cap. En cas de
  conflit, on le signale, on ne code pas en silence.
- **Toute décision structurante devient une ADR** dans `docs/decisions/`. Une page, la
  décision, ce qu'on abandonne en la prenant.
- **Le test unique reste le test unique** : est-ce que ça aide une personne anxieuse à
  arriver à l'heure sans la presser ? Si ce n'est pas un oui évident, non.
- **Chaque jalon retire quelque chose.** On le note explicitement dans la spec du jalon.

---

## 6. Ce qui me ferait dire qu'on a réussi

Pas un nombre d'utilisateurs. Trois phrases, entendues d'une personne réelle :

1. « Je ne me demande plus si je vais être en retard. »
2. « Je ne sais pas comment elle sait, mais elle sait. »
3. « Elle ne m'a jamais engueulé. »

Le reste est de l'ingénierie.

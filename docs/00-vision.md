# Douce heure · Vision de reprise

Document d'ouverture. Écrit par la nouvelle direction du projet, après lecture intégrale
du code, des tests et de la spec Pro Max v2. Il fixe le diagnostic, la thèse produit et le
cap des quatre prochains jalons. Il ne remplace pas `CLAUDE.md` (les règles R1 à R5 et les
décisions d'architecture restent verrouillées) : il dit quoi faire de ce socle.

---

## 1. État des lieux, sans complaisance

Le projet n'a pas été abandonné parce qu'il était mauvais. Il a été abandonné en haut de
la courbe : la v2 a livré beaucoup, d'un coup, et personne n'est resté pour voir ce que ça
donnait au bout de trois semaines.

**Ce qui est solide et qu'on ne touche pas.**

- Un point de vue. R1 à R5 ne sont pas des slogans : ils sont exécutables, et
  `tests/copy.test.mjs` les fait respecter par la machine. Peu de produits ont ça.
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
2. **`ui.js` fait 2 006 lignes et concentre tout le risque.** C'est le seul fichier où les
   régressions R1 et R2 peuvent naître, et c'est le seul qui n'est couvert par aucun test.
   Le bug de la douche, s'il revient, reviendra là.
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

---

## 2. La thèse

> Douce heure n'a pas à être excellente au bout d'un mois.
> Elle doit être **supportable dès le premier matin** et **évidente au septième**.

Trois convictions en découlent, et elles arbitrent tout le cycle.

**Le concurrent n'est pas une autre app, c'est l'abandon au jour 4.** Toute décision se
juge à son effet sur les sept premiers matins. Une fonctionnalité brillante qui n'agit
qu'au bout d'un mois passe après une friction retirée au jour 2.

**L'honnêteté est un moteur, pas une politesse.** L'app dit déjà la vérité sur le Wake
Lock, et cette phrase (« C'est le deal ») est la meilleure du produit. On étend le
principe : l'app doit savoir dire ce qu'elle ne sait pas encore, sans jamais lâcher un
chiffre (R1, R4). C'est difficile, c'est précisément pour ça que ça a de la valeur.

**Le silence est un livrable.** Pas de notification, pas de streak, pas de décompte, pas
de serveur, pas de compte : ce qui n'existe pas dans cette app en est le produit. Donc
chaque jalon doit **retirer** au moins une chose. Une roadmap qui n'additionne que des
écrans est une roadmap qui a perdu le fil.

---

## 3. Ce qu'on refuse pour ce cycle

Pour que le cap tienne, il faut nommer ce qui ne sera pas fait, même si c'est demandé.

- Aucun backend, aucun compte, aucune synchronisation. Non négociable.
- Aucune notification en arrière-plan. La contrainte iOS est réelle, et l'honnêteté sur
  cette limite vaut mieux qu'un contournement fragile.
- **Aucun nouvel écran principal.** Le produit a déjà onze surfaces. Le cycle se joue en
  profondeur, pas en largeur.
- Aucune gamification, aucun score visible, aucun historique chiffré de retard.
- Android reste secondaire. On teste iOS d'abord, toujours.

---

## 4. Les quatre jalons

### J1 · Socle de confiance
*Rien de visible pour l'utilisateur. Tout pour qui reprendra le code dans six mois.*

Intégration continue qui exécute les tests à chaque poussée. Découpe de `ui.js` en modules
de rendu par écran, sans changer un pixel. Tests de non-régression au niveau du DOM sur les
deux règles qui font le produit : l'étape n'avance jamais seule (R2), aucune durée restante
n'apparaît à l'écran (R1). Vérification automatique que la liste `ASSETS` du service worker
couvre bien tous les fichiers livrés.

Critère de sortie : on peut modifier `ui.js` sans peur.

### J2 · La première semaine
*Le jalon le plus important du cycle.*

Refonte du parcours jour 1 à jour 7. L'app doit être utile sans données, honnête sur son
ignorance, et visiblement plus juste au septième matin qu'au premier. Cela recouvre
l'onboarding, le premier plan, la façon de parler de l'incertitude sans chiffre, et le
moment où l'app peut enfin dire « le trajet, je connais ».

Critère de sortie : un testeur qui n'a jamais vu l'app arrive à l'heure au premier essai,
et sait dire au septième matin ce que l'app a appris de lui.

### J3 · Un moteur qui mérite son nom
*L'apprentissage est la promesse. Aujourd'hui c'est une moyenne sur huit points.*

Estimateur robuste aux matins aberrants, mémoire plus longue et pondérée par la
récence, segmentation contextuelle assumée, et surtout **calibration de la marge
invisible** : arriver à l'heure, oui, mais sans se lever quarante minutes trop tôt. Le
tout validé par des tests de calibration sur des historiques simulés, pas par intuition.

Critère de sortie : sur des historiques simulés de plusieurs profils, la marge converge
vers le juste et le taux d'arrivée à l'heure ne se paie pas en réveils absurdes.

### J4 · Le corps de l'app
*Ce qu'on touche, ce qu'on entend, ce qui se passe la nuit.*

Accessibilité réelle : le geste d'appui tenu doit être utilisable sous VoiceOver et avec
une motricité imparfaite, sans jamais tomber dans le tap accidentel que R2 interdit.
Suppression des dialogues natifs. Respect de la taille de texte système. Et la nuit :
le mode chevet doit survivre à une vraie nuit branchée, sur un vrai iPhone.

Critère de sortie : la recette de la spec, §19, passe en entier sur appareil réel, nuit
comprise.

---

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

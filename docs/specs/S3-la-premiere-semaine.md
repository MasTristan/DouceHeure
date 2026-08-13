# S3 · La première semaine

**Jalon** : J2 · **Propriétaire** : Léa Ferrand · **Moteur** : chantier J3 · **Chaînes** : Camille Ndiaye

Le jalon le plus important du cycle. Il traite le seul problème que ni la fiabilité ni la
qualité du moteur ne peuvent résoudre : **l'app est mauvaise exactement quand l'utilisateur
décide de la garder.**

---

## 1. Le fait qui commande tout

Simulations sur le code de production (`docs/reunions/r1-moteur-temporel.md`) :

| | matins en retard, jour 1 | jour 2 | régime établi |
|---|---|---|---|
| utilisateur qui **sous-estime** ses durées | **50 %** | 38 % | 3 % |
| le même, s'il déclarait **juste** | 6 % | 7 % | 3 % |

**La totalité de l'échec du premier jour vient du biais de déclaration, pas du moteur.** Un
matin sur deux est en retard au jour 1, et la cause n'est pas que l'app n'a pas encore
appris : c'est qu'elle a cru l'utilisateur.

Or les personnes en cécité temporelle sous-estiment systématiquement leurs durées. Demander
« combien de temps prend ta douche ? » à ce public, et bâtir un plan dessus, est le vice de
conception central du produit. C'est le constat de Léa, et les chiffres le confirment plus
durement qu'elle ne l'avait formulé.

Aucun réglage de l'apprentissage ne corrige cela, puisque l'apprentissage n'a rien à se
mettre sous la dent avant le troisième jour.

---

## 2. Ne plus demander une durée

**Proposition retenue : le calibrage par deux heures d'horloge** (P3 de Léa), qui devient la
proposition centrale de J2.

**Principe.** On ne demande jamais à l'utilisateur combien de temps prend une étape. On lui
demande deux heures d'horloge qu'il connaît réellement : à quelle heure il se lève
habituellement, et à quelle heure il doit arriver. La différence est un budget observé, pas
une estimation introspective.

Ce budget est réparti sur les étapes actives selon les proportions par défaut, puis **mis à
l'échelle uniquement vers le haut**. On ne descend jamais en dessous des estimations par
défaut : une personne qui déclare se lever 40 minutes avant de partir ne se voit pas
attribuer un plan de 40 minutes, elle se voit attribuer un plan honnête et l'app le lui dit
dans l'Aperçu.

**Pourquoi ça marche.** « À quelle heure tu te lèves » est une question à laquelle une
personne en cécité temporelle répond juste, parce qu'elle porte sur un événement, pas sur une
durée. C'est exactement la distinction que R1 fait déjà : une heure cible est autorisée, un
décompte jamais.

**Ce qu'on retire en échange (DEC-12).** Le réglage de durée par étape disparaît du Studio,
définitivement. C'est une décision prise après le réveil en moins, et c'est la meilleure
sorte de suppression : elle retire une question à laquelle l'utilisateur ne peut pas bien
répondre.

---

## 3. Retourner le comportement au jour 1

**Constat.** `predict` sans mesure rend `variance: 0`. `safetyMargin` étant bâtie sur la
variance, **la marge est minimale au moment où l'app est la plus ignorante** : 7 minutes au
premier matin. Et le `varBoost = 1.5` documenté au §8 de `CLAUDE.md` multiplie zéro : le
gonflement conçu pour l'inconnu est inopérant dans le cas de l'inconnu total.

**Correctif, compatible R3.** Une **variance a priori**, décroissante avec la confiance, dans
`predict` uniquement :

```
variance_effective = variance_mesurée * confidence + variance_a_priori * (1 - confidence)
```

avec une variance a priori proportionnelle à `est`.

**R3 reste intacte** et c'est le point à ne pas se faire confisquer : aucune écriture dans
`step.real`. On ne fabrique pas de fausses mesures, on exprime une ignorance. La distinction
est la même que celle entre ne pas savoir et inventer.

Détail et calibration : `S4-le-moteur.md`, article 2.

---

## 4. Où l'incertitude a le droit d'exister

**ADR-003 s'applique intégralement.**

Pendant le guidage, **jour 1 et jour 30 sont indiscernables**. L'écran live n'exprime jamais
l'état de la connaissance du modèle. C'est un invariant testé
(`tests/live-invariance.test.mjs`), pas une intention.

L'incertitude s'exprime dans trois surfaces seulement, toutes hors du moment de l'action :
l'Aperçu, le Bilan, « Tes matins ».

**Règle d'écriture, de Camille.** L'honnêteté porte sur **l'état de la connaissance**, jamais
sur **la compensation**. L'app peut dire qu'elle ne connaît pas encore un trajet. Elle ne dit
jamais qu'elle a prévu large, ni qu'elle préfère être prudente : cette seconde famille fait
fuiter R4 par le sens, même sans lâcher un chiffre.

---

## 5. Fermer la boucle du trajet

Prérequis livré en J0 (B7) : l'Aperçu persiste la destination choisie. Sans cela,
`confirmArrival` refuse d'écrire et **F5 ne boucle jamais** pour qui ne va pas dans le
Studio.

En J2 s'ajoute la conséquence produit : le trajet déclaré n'est plus un réglage qu'on saisit,
c'est une valeur de départ que le réel corrige. L'Aperçu dit quand le réel a pris le relais
(`preview_travel_known` existe déjà et est conforme : il est dans une surface autorisée).

---

## 6. Le protocole de validation, sans télémétrie

L'app ne collecte rien, par choix, et ce choix ne bouge pas. Le substitut est un protocole
écrit, daté et reproductible.

- **6 à 8 testeurs** sur iPhone, 14 jours.
- **Mémo vocal quotidien** de trente secondes, le soir : ce qui s'est passé le matin.
- **Exports JSON à J1, J3, J7 et J14.** Le calendrier n'est pas négociable : le FIFO de 8
  écrase la première semaine avant la fin du test. Sans export à J3 et J7, la donnée de la
  période qui nous intéresse n'existe plus au moment où on la regarde.
- **Contrôle clé** : comparer `history.length` au nombre de matins déclarés dans les mémos.
  L'écart mesure B1 sans avoir à instrumenter B1. Après correction, l'écart doit être nul.

**Ce protocole ne démarre qu'après J0.** Observer un produit qui perd ses mesures (B1) et
n'apprend jamais ses trajets (B7) revient à mesurer les bugs, pas le produit.

---

## 7. Critère de sortie de J2

Révisé en R2 sur l'objection de Camille, qui a montré que ma formulation initiale fabriquait
de la gamification et contredisait le §3 de ma propre vision.

> Un testeur qui n'a jamais vu l'app **arrive à l'heure au premier essai**, et au septième
> matin **son heure de lever a bougé sans qu'il ait eu à régler quoi que ce soit.**

Le progrès se constate, il ne se raconte pas.

**Réserve honnête à lever, soulevée par Léa.** Sous le plafond actuel de marge (21 minutes),
« arriver à l'heure au premier essai » n'est pas atteignable pour un utilisateur qui
sous-estime de 30 minutes, et ne pourrait l'être qu'en trichant sur la marge, ce que J3
punit ensuite. C'est exactement pourquoi l'article 2 (ne plus demander une durée) est la
pièce maîtresse de ce jalon, et non l'article 3. **Si l'article 2 échoue, le critère de
sortie est hors d'atteinte et le jalon doit être rouvert, pas déclaré atteint.**

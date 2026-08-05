# S4 · Le moteur

**Jalon** : J3 · **Propriétaire** : Sacha Roy · **Cible** : ADR-002

L'apprentissage est la promesse centrale du produit. C'est aujourd'hui une moyenne sur huit
points, dont le terme adaptatif est mort.

Ordre imposé par DEC-11 : rapport valeur sur coût, pas élégance.

---

## Article 1 · Composer les variances correctement

**Deux lignes. Le meilleur rapport du projet.**

**Constat.** `buildPlan` (`js/plan.js:29`) additionne les **écarts-types** des étapes.
Additionner des écarts-types surestime la dispersion de leur somme ; la composition correcte
est la racine de la somme des variances.

Sur un profil réaliste : somme des écarts-types **21,0 min**, racine de la somme des variances
**9,1 min**, soit une surestimation d'un facteur **2,31**.

**Conséquence mesurée.** En régime établi, sur 300 utilisateurs simulés :

```
variance totale moyenne vue par buildPlan : 18,9 min
terme de variance avant plafond           : 15,1 min   (plafond = 10)
part des matins où le plafond est atteint : 99,8 %
```

Le terme de variance est **saturé 99,8 % du temps**. Il ne transporte aucune information. La
marge « adaptative » vaut en permanence `3 + 10 + latenessScore * 8` : c'est une constante,
et elle l'est depuis l'origine.

**Correctif.** `totalVariance = sqrt(somme des variances de chaque étape + variance du trajet)`.
Avec la composition correcte, le terme vaut `9,1 * 0,8 = 7,3`, donc **sous le plafond**, donc
de nouveau sensible aux données. C'est le changement qui rend la marge adaptative pour la
première fois.

**À signaler à la recette.** Cette correction **réduit** la marge en régime établi, donc
rapproche l'heure de lever de l'heure d'arrivée. L'utilisateur le ressentira, dans le bon
sens. Il ne doit sous aucune forme en être informé (R4).

**Tests.** `safetyMargin` n'est plus saturée dans plus de 20 % des cas simulés en régime
établi. La cible d'ADR-002 est tenue.

---

## Article 2 · Variance a priori au démarrage à froid

**Constat.** `predict` sans mesure rend `variance: 0`, donc la marge est **minimale au
moment où l'app est la plus ignorante** : 7 minutes au premier matin, 11 pour une personne
au `latenessScore` maximal. Et `varBoost = 1.5` multiplie zéro : inopérant dans le seul cas
pour lequel il a été écrit.

**Correctif.**

```
variance_effective = variance_mesurée * confidence + variance_a_priori * (1 - confidence)
```

`variance_a_priori` proportionnelle à `est`. Le facteur exact est calibré par simulation
contre ADR-002, pas choisi à l'intuition.

**R3 est intacte et doit le rester explicitement.** Aucune écriture dans `step.real`. On
n'injecte pas de mesure, on exprime une ignorance dans le calcul. Cette distinction est la
frontière du droit de veto de Sacha : toute proposition qui la franchit est refusée, quels
que soient ses résultats.

**`varBoost` disparaît**, remplacé par ce mécanisme qui couvre le même besoin et fonctionne
dans le cas total. C'est ce que J3 retire (DEC-12).

**Tests.** La marge décroît de façon monotone avec la confiance, à variance mesurée
constante. Au jour 1, elle est supérieure à celle du régime établi.

---

## Article 3 · Estimateur robuste

**Constat.** Une douche à 45 minutes au lieu de 19, un jour sur dix :

| jour | retard moyen | lever avant l'arrivée |
|---|---|---|
| 8 (avant) | -23,7 | 117,7 |
| 10 (le jour même) | +1,9 | 117,7 |
| 14 (après) | -27,2 | **121,1** |
| 20 (FIFO purgée) | -23,7 | 117,6 |

L'effet est modéré, environ 3,4 minutes, mais il persiste **huit jours**, soit toute la
profondeur du FIFO. À raison d'un matin aberrant sur dix, le moteur est contaminé la plupart
du temps.

Une moyenne sur huit points n'a aucune défense contre une valeur extrême.

**Correctif.** Médiane ou moyenne tronquée. Le choix se tranche par balayage de paramètres
contre ADR-002, pas par préférence. Contrainte : rester lisible et pur, testable en node.

**Tests.** Une mesure aberrante isolée déplace la prédiction de moins de X minutes, X calibré
par simulation. La contamination ne dépasse pas Y jours.

---

## Article 4 · Segmentation et mémoire

**Le moins urgent des quatre**, et il le reste : les trois premiers articles le rendent bien
plus utile qu'il ne l'est aujourd'hui.

**Segmentation.** `predict` filtre par `r.day === ctx.day || r.type === ctx.type`. Le OU est
très permissif : avec `type` constant sur les jours ouvrés, il ne segmente rien du tout. À
instruire : un ET avec repli progressif, ou une pondération continue plutôt qu'un filtre
binaire.

**Mémoire.** Le FIFO de 8 donne environ une semaine et demie d'historique à raison d'une
mesure par jour ouvré. Une étape faite le lundi et le jeudi n'a que quatre souvenirs de
chacun. À instruire : allonger, et pondérer par la récence plutôt que de couper net.

**Contrainte de taille.** Allonger la mémoire fait grossir la clé `localStorage`, ce qui
alimente B5. Les deux se traitent ensemble, ou la mémoire ne s'allonge pas.

---

## Article 5 · Le harnais de calibration

**Livrable** : `tests/calibration.test.mjs`, bloquant en CI au même titre que les tests R2.

Il simule plusieurs profils sur 20 à 25 matins, avec un générateur reproductible, et vérifie
la cible d'ADR-002 :

- **au moins 90 %** des matins à l'heure ou en avance ;
- **avance moyenne inférieure ou égale à 10 minutes** ;
- au jour 1, la part de matins en retard reste sous un seuil à fixer après l'article 2 (elle
  est de **50 %** aujourd'hui).

Les seuils font échouer la construction. Toute modification de `predict`, `predictTravel`,
`safetyMargin` ou `buildPlan` passe par ce harnais avant fusion.

**Le script de simulation existe déjà.** Il a servi à produire les chiffres de ce document et
de `docs/reunions/r1-moteur-temporel.md`, en important le code de production sans le
modifier. Il devient un test du dépôt.

---

## Critère de sortie de J3

La cible d'ADR-002 est tenue en CI, sur plusieurs profils simulés, et le terme de variance
n'est plus saturé. La marge est redevenue ce qu'elle prétend être depuis l'origine : une
fonction de ce que l'app sait.

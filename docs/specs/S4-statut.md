# S4 · Statut : le moteur mérite son nom

Jalon J3 livré. La cible d'ADR-002 est tenue en intégration continue.

## La cible

> 90 % des matins à l'heure ou en avance, pour une avance moyenne inférieure ou égale à
> 10 minutes.

**Mesuré : 92 % pour 9,9 minutes.** Avant J3 : 98 % pour 17,3 minutes, obtenus en faisant
lever les gens 110 minutes avant leur heure d'arrivée. J'ai échangé six points de ponctualité
contre sept minutes d'avance inutile et six minutes de sommeil quotidien, exactement le
troc qu'ADR-002 décrivait.

Vérifié par `tests/calibration.test.mjs`, bloquant en CI. Toute modification de `predict`,
`predictTravel`, `safetyMargin` ou `buildPlan` passe par ce harnais.

## Les articles

| Article | État |
|---|---|
| 1 · Composer les variances correctement | fait. Le terme de variance n'est plus saturé : il était au plafond 99,8 % du temps, il ne l'atteint plus jamais sur les profils simulés |
| 2 · Variance a priori au démarrage à froid | fait. `varBoost` retiré (DEC-12) |
| 3 · Estimateur robuste | fait. Moyenne tronquée symétrique, tranchée par balayage sur deux critères |
| 4 · Segmentation et mémoire | **pas fait**, voir plus bas |
| 5 · Le harnais de calibration | fait, livré en J2 et complété ici |

## Article 4 : pourquoi il n'est pas fait

C'était déjà « le moins urgent des quatre » dans la spec, et il porte une contrainte que S4
énonce lui-même : allonger la mémoire fait grossir la clé `localStorage`, ce qui alimente B5.
« Les deux se traitent ensemble, ou la mémoire ne s'allonge pas. »

Le travail sur le stockage n'est pas dans ce cycle. L'article 4 attend donc un jalon qui
traite les deux, et il n'est pas ajouté à J4 pour faire nombre.

**Ce qui reste vrai et non traité** : la segmentation par `r.day === ctx.day || r.type ===
ctx.type` ne segmente rien du tout sur les jours ouvrés, puisque `type` y est constant. Le OU
est trop permissif. Personne ne doit croire que ce point est réglé.

## Deux écarts que le harnais consigne

**Le parcours sans destination ne tient pas la cible d'avance** : 11,6 minutes contre 9,9.
Sans destination, le trajet n'est jamais mesuré, l'app reste ignorante à vie sur ce terme et
le paie en marge tous les matins. C'est le parcours par défaut du produit. Un test le mesure
et échouera si l'écart change dans un sens comme dans l'autre.

C'est le meilleur argument produit pour F5 qu'on ait aujourd'hui, et il est chiffré :
**nommer sa destination rend 1,7 minute par matin, tous les matins.**

**La cible de performance n'est vérifiée par aucune machine.** ADR-005 a remplacé un budget
en octets mal instruit par deux budgets mieux ciblés, mais la vraie cible, First Paint sous
une seconde sur iPhone 12, se mesure sur un iPhone 12. Elle entre dans la recette de J4 au
même titre que VoiceOver et la nuit branchée.

## État du budget (ADR-005)

| | mesuré | budget | marge |
|---|---|---|---|
| code hors commentaires | 173 524 | 189 440 | 15 916 |
| poids transféré | 225 936 | 266 240 | 40 304 |

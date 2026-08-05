# ADR-002 · La cible de calibration du moteur

**Statut** : acceptée · **Date** : R2 · **Décideur** : direction du projet
**Instruit par** : le chantier moteur (`docs/reunions/r1-moteur-temporel.md`)

## Contexte

Le moteur apprend les durées réelles et calcule une marge de sécurité invisible (R4). Aucun
objectif de calibration n'est écrit nulle part : ni dans la spec, ni dans `CLAUDE.md`, ni
dans les tests.

Un moteur sans cible écrite optimise implicitement la seule chose qu'on lui reproche
visiblement : le retard. Cette optimisation a une solution triviale et mauvaise, partir très
tôt, et c'est ce que le moteur fait.

Simulations exécutées sur le code de production, 300 à 400 utilisateurs, 20 à 25 matins :

| régime | part des matins à l'heure | avance moyenne | lever avant l'arrivée |
|---|---|---|---|
| jour 1 | 50 % | +1,1 min de retard | 93 min |
| jour 2 | 62 % | -3,3 min | 97 min |
| régime établi | **97 %** | **-24 min** | **118 min** |

Le moteur converge donc vers « arriver 24 minutes en avance, tous les jours, en se levant 25
minutes plus tôt qu'au premier jour ».

La cause est arithmétique et non accidentelle : `leaveMin = arrivée - trajet - buffer -
marge`. Une fois les prédictions converties, la marge et le buffer ne sont pas de la réserve
mobilisable, ce sont des minutes **payées d'avance chaque matin**, qu'il y ait un imprévu ou
non. Elles servent les mauvais jours et sont facturées tous les jours.

## Décision

La cible de calibration du moteur est :

> **90 % des matins à l'heure ou en avance, pour une avance moyenne inférieure ou égale à
> 10 minutes.**

Elle est vérifiée par un test de calibration sur historiques simulés, exécuté en CI, avec des
seuils qui font échouer la construction en cas de régression.

## Justification

J'échange délibérément trois points de ponctualité contre un quart d'heure de sommeil
quotidien, et c'est le cœur de la décision.

Le produit s'adresse à des personnes en retard chronique. Une app qui les fait arriver
systématiquement une demi-heure trop tôt ne résout pas leur problème : elle le remplace par
une autre taxe, et celle-là se prélève **tous les jours, y compris les bons**. Le retard
coûte cher rarement ; l'avance systématique coûte peu, très souvent, et sur une population
qui a déjà un rapport difficile au lever.

Le test unique du projet s'applique ici sans ambiguïté : est-ce que se lever deux heures
avant son arrivée aide une personne anxieuse à arriver à l'heure sans la presser ? Elle
arrive à l'heure. Elle est pressée quand même, simplement plus tôt.

97 % n'est d'ailleurs pas un choix qui a été fait : c'est un effet de bord d'une formule dont
le terme adaptatif est saturé 99,8 % du temps. Personne n'a jamais décidé 97 %.

## Ce qu'on abandonne en la prenant

- Environ trois matins sur cent basculent du côté « juste » plutôt que « confortable ». C'est
  assumé et c'est le prix.
- Le mode rattrapage (F3) sera sollicité plus souvent, puisque le plan est plus serré. Il doit
  donc être bon, ce qui remonte sa qualité au rang de dépendance de cette ADR.
- La cible est une moyenne de population simulée. Elle ne garantit rien à un individu donné,
  et elle ne doit jamais être présentée à l'utilisateur, sous aucune forme (R4).

## Conséquences

- `tests/calibration.test.mjs` devient un test bloquant, au même titre que les tests R2.
- Toute modification de `safetyMargin`, `predict`, `predictTravel` ou `buildPlan` est
  mesurée contre cette cible avant d'être fusionnée.
- Les chiffres de cette ADR ne sont jamais affichés ni prononcés. R4 s'applique à ce document
  comme au reste : il est interne.

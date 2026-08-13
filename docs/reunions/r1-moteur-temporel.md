# R1 · Moteur temporel

**Note de séance.** Ce chantier revenait à Sacha Roy. Sa session a été interrompue avant
qu'il ne rende. J'ai repris l'analyse moi-même plutôt que de laisser J3 sans instruction :
le moteur est la promesse centrale du produit et l'arbitrage ne pouvait pas se tenir sans
chiffres. Les résultats ci-dessous viennent de simulations exécutées **sur le code de
production**, en important `js/plan.js` et `js/predict.js` sans les modifier.

Protocole : 300 à 400 utilisateurs simulés, 20 à 25 matins chacun, générateur reproductible.
Profil : six étapes, durées vraies tirées d'une loi normale, arrivée cible à 09:00, trajet
déclaré 20 min pour un trajet réel de 25 min, `latenessScore` initial 0.5. Hypothèse de Léa
retenue : l'utilisateur sous-estime ses durées d'environ 30 % à la déclaration.

---

## 1. Le démarrage à froid, chiffré

| jour | retard moyen | part des matins en retard | marge | lever avant l'arrivée |
|---|---|---|---|---|
| 1 | +1,1 min | **50 %** | 7,0 | 93 min |
| 2 | -3,3 min | **38 %** | 7,8 | 97 min |
| 3 | -15,4 min | 7 % | 16,6 | 110 min |
| 4 | -18,3 min | 4 % | 16,1 | 112 min |
| 5 | -21,5 min | 2 % | 15,8 | 116 min |
| 7 | -24,6 min | 1 % | 15,1 | 119 min |
| 20 | -23,8 min | 3 % | 14,3 | 118 min |

**Un matin sur deux est en retard au jour 1. Plus d'un sur trois au jour 2.** C'est
exactement la fenêtre où l'utilisateur décide de garder l'app ou non, et c'est la fenêtre
où elle est la moins bonne. La thèse de la vision est confirmée par les chiffres, et plus
durement que je ne l'avais formulée.

Contre-épreuve utile : si le même utilisateur déclarait ses durées **exactes**, le jour 1
tomberait à 6 % de retard au lieu de 50 %. **La totalité de l'échec du jour 1 vient du
biais de déclaration, pas du moteur.** C'est la validation la plus nette de l'analyse de
Léa : le vice est dans l'estimation initiale, et aucun réglage de l'apprentissage ne le
corrige, puisque l'apprentissage n'a rien à se mettre sous la dent avant le troisième jour.

---

## 2. Le moteur ne converge pas vers la ponctualité, il converge vers l'avance

C'est le résultat que je n'attendais pas et c'est le plus important du document.

En régime établi, l'app fait arriver l'utilisateur **24 minutes en avance, tous les jours**,
et le fait lever **118 minutes** avant son heure d'arrivée contre 93 au premier jour. Le
moteur apprend, et ce qu'il apprend coûte une demi-heure de sommeil par jour.

La mécanique est arithmétique, pas accidentelle. Une fois les prédictions convergées vers
les vraies durées, l'utilisateur termine sa préparation exactement à `leaveMin`. Or
`leaveMin = arrivée - trajet - buffer transport - marge`. La marge et le buffer ne sont pas
de la réserve mobilisable : ce sont **des minutes payées d'avance, chaque matin, qu'il y ait
un imprévu ou non**. Elles ne servent que les mauvais jours, elles sont facturées tous les
jours.

Il n'existe aujourd'hui aucun objectif de calibration écrit nulle part. Le moteur optimise
implicitement « ne jamais être en retard », ce qui a une solution triviale et mauvaise :
partir très tôt. C'est le trou que J3 doit boucher, et il se boucle en écrivant la cible,
pas en changeant l'estimateur.

---

## 3. La marge « adaptative » est en réalité une constante

`safetyMargin = round(3 + min(totalVariance * 0.8 * varBoost, 10) + latenessScore * 8)`.

Mesure en régime établi, 300 utilisateurs, jours 9 à 25 :

```
variance totale moyenne vue par buildPlan : 18,9 min
terme de variance avant plafond           : 15,1 min   (plafond = 10)
part des matins où le plafond est atteint : 99,8 %
```

**Le terme de variance est saturé 99,8 % du temps.** Il ne transporte aucune information :
la marge vaut `3 + 10 + latenessScore * 8` en permanence. Le seul paramètre encore vivant
est le `latenessScore`, alimenté par un ressenti déclaratif à trois boutons.

La cause est identifiée et c'est une erreur de composition. `buildPlan` (l.29) additionne
les **écarts-types** des étapes. Additionner des écarts-types surestime la dispersion de la
somme ; la composition correcte est la racine de la somme des variances. Sur le profil
simulé :

```
somme des écarts-types  = 21,0 min
racine somme variances  =  9,1 min
surestimation           = x 2,31
```

Avec la composition correcte, le terme vaudrait `9,1 * 0,8 = 7,3`, donc **sous le plafond de
10**, donc de nouveau sensible aux données. La correction rend la marge adaptative pour la
première fois. Elle est de deux lignes.

Corollaire à noter pour Camille et pour la recette : cette correction **réduit** la marge en
régime établi, donc rapproche l'heure de lever de l'heure d'arrivée. C'est un changement
que l'utilisateur ressentira, dans le bon sens, et qui ne doit surtout pas être annoncé
comme tel (R4).

---

## 4. Zéro donnée est lu comme zéro incertitude

Confirmation du point de Léa, avec les valeurs exactes :

```
predict sans mesure           -> { dur: est, variance: 0, confidence: 0 }
marge au jour 1, lateness 0.5 -> 7 min
marge au jour 1, lateness 1.0 -> 11 min
marge plafond absolue         -> 21 min
```

La marge est **minimale au moment où l'app est la plus ignorante**, parce qu'elle est bâtie
sur une dispersion observée et qu'aucune observation ne donne une dispersion nulle. C'est
une inversion complète du comportement souhaitable.

Et le `varBoost = 1.5` documenté au §8 de `CLAUDE.md` multiplie `totalVariance`. Au premier
matin, `totalVariance` vaut zéro. **Le gonflement conçu pour l'inconnu est inopérant dans le
cas de l'inconnu total.** Il ne sert que lorsque les étapes sont déjà connues et que seule
la destination est neuve.

Le correctif compatible R3 existe et il ne consiste pas à écrire de fausses mesures : c'est
une **variance a priori**, décroissante avec la confiance, dans `predict` uniquement. Aucune
écriture dans `step.real`, R3 intacte. Formulation proposée pour la spec :
`variance_effective = variance_mesurée * confidence + variance_a_priori * (1 - confidence)`,
avec une variance a priori proportionnelle à `est`.

---

## 5. Contamination par un matin aberrant

Une douche à 45 minutes au jour 10, sur une moyenne de 19 :

| jour | retard moyen | marge | lever avant l'arrivée |
|---|---|---|---|
| 8 (avant) | -23,7 | 14,7 | 117,7 |
| 10 (le jour même) | +1,9 | 14,3 | 117,7 |
| 14 (après) | **-27,2** | 14,7 | **121,1** |
| 20 (FIFO purgée) | -23,7 | 14,2 | 117,6 |

L'effet est modéré, environ 3,4 minutes de lever plus tôt, mais il persiste **huit jours**,
soit la profondeur du FIFO. À raison d'un matin aberrant sur dix, le moteur est donc
contaminé la plupart du temps. Une moyenne sur huit points n'a aucune défense contre une
valeur extrême. Une médiane ou une moyenne tronquée en aurait une, pour un coût de quelques
lignes.

---

## 6. Ce que je retiens pour J3

Par ordre de rapport valeur sur coût, et non par ordre d'élégance.

1. **Écrire l'objectif de calibration.** Sans cible chiffrée, le moteur optimise « jamais en
   retard » et la réponse optimale est « lève-toi deux heures avant ». Proposition à
   arbitrer : viser 90 % d'arrivées à l'heure pour une avance moyenne de 8 à 10 minutes,
   contre 97 % pour 24 minutes aujourd'hui.
2. **Composer les variances correctement.** Deux lignes. Débloque la seule partie
   réellement adaptative de la marge, qui est morte depuis le premier jour.
3. **Variance a priori au démarrage à froid.** Retourne le comportement au jour 1 sans
   toucher à R3.
4. **Estimateur robuste.** Médiane ou moyenne tronquée, contre la contamination sur huit
   jours.
5. **Mémoire plus longue et pondérée par la récence.** Le FIFO de 8 est court, mais c'est le
   moins urgent des cinq : les quatre premiers points le rendent bien plus utile.

Le point 1 n'est pas du code. C'est une décision, et elle m'appartient. Elle est rendue en
R2 et devient l'ADR 004.

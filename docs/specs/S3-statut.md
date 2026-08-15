# S3 · Statut : la première semaine

Jalon J2 livré, avec une réserve honnête sur son critère de sortie (voir plus bas).

## Ce qui est fait

**Article 2, la pièce maîtresse : on ne demande plus jamais une durée.** L'onboarding pose
deux heures d'horloge, le lever habituel et l'arrivée. `js/calibrate.js` met le déroulé à
l'échelle du budget observé, uniquement vers le haut. R3 est intacte : rien n'entre dans
`step.real`, on remplace une mauvaise déclaration par une meilleure.

**Ce que J2 retire (DEC-12).** Le réglage de durée par étape a disparu du Studio, et aussi du
formulaire de création d'étape, qui posait exactement la même mauvaise question. À la place,
une seule question à laquelle la personne peut répondre : son lever habituel, dans la carte
des valeurs par défaut du profil. N réglages retirés, un posé.

**Article 5 de S4, avancé ici.** `tests/tools/simulate.mjs` et `tests/calibration.test.mjs`.
Le critère de sortie de J2 se vérifie sur un iPhone avec une vraie personne et n'est pas
automatisable ; la cause qu'il traite, elle, est chiffrée. On ne peut pas tester la promesse,
on peut tester le mécanisme qui la rend possible.

**Le budget de performance devient mécanique** (`tests/budget.test.mjs`). Il n'était vérifié
par rien et J2 l'a dépassé sans que rien ne le signale.

## Ce que ça change, mesuré

| | jour 1 | jour 2 | jour 3 | régime établi | avance établie |
|---|---|---|---|---|---|
| avant | 71 % en retard | 58 % | 21 % | 1 % | 17,3 min |
| après | **4 %** | 4 % | 1 % | 1 % | 17,3 min |

Le régime établi est identique : le calibrage agit sur la fenêtre d'ignorance puis s'efface.
Détail, hypothèses du modèle et preuves au rouge dans `docs/recettes/journal.md`.

## Article 3 : la variance a priori n'est pas dans J2

S3 §3 décrivait la variance a priori comme faisant partie de ce jalon, tout en renvoyant sa
calibration à `S4-le-moteur.md`, article 2. Elle est traitée en J3, avec le reste du moteur,
pour une raison de méthode : son facteur doit être calibré par simulation contre ADR-002, et
la calibrer isolément avant la composition correcte des variances (S4 article 1) reviendrait
à régler un terme dont l'échelle va changer sous lui.

Ce n'est pas un abandon : c'est un report d'un article dont le rendement dépend d'un autre.
J3 le tient ou J3 n'est pas atteint.

## La réserve de S3 §7 est levée, en partie

Léa avait posé : *« arriver à l'heure au premier essai » n'est pas atteignable pour un
utilisateur qui sous-estime de 30 minutes, et ne pourrait l'être qu'en trichant sur la
marge.* Le harnais montre qu'elle avait raison sur le diagnostic et que l'article 2 lève
l'obstacle sans toucher à la marge : 4 % de matins en retard au jour 1, pour une marge
inchangée. La ponctualité du jour 1 n'est plus achetée à la marge, elle est achetée à une
meilleure question.

**Ce qui reste non vérifié**, et qui l'est par construction : la seconde moitié du critère de
sortie, *au septième matin son heure de lever a bougé sans qu'il ait eu à régler quoi que ce
soit*. Le simulateur le montre (le lever suit les mesures réelles dès le troisième matin),
mais un simulateur ne montre jamais qu'une personne réelle l'a vécu ainsi. Le protocole de
S3 §6, six à huit testeurs sur quatorze jours, reste à exécuter et n'a pas commencé.

## État du budget

224 884 octets sur 225 280. **Il reste 396 octets.** J3 doit retirer avant d'ajouter.

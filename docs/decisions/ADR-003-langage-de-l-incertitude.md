# ADR-003 · Où l'app a le droit de dire qu'elle ne sait pas

**Statut** : acceptée · **Date** : R2 · **Décideur** : direction du projet
**Demandeur** : Camille Ndiaye · **Concernés** : Léa Ferrand, Iris Tanaka

## Contexte

Le document de vision pose l'honnêteté comme un moteur : l'app doit savoir dire ce qu'elle ne
sait pas encore, sans jamais lâcher un chiffre (R1, R4). Les sept premiers matins, elle ne
sait effectivement rien des durées réelles de l'utilisateur.

Camille a opposé une objection que je n'avais pas anticipée : la pente naturelle de ce
principe rend l'app **plus bavarde au moment où elle sait le moins et où l'utilisateur est le
plus fragile**. Un guidage qui commente sa propre ignorance pendant que quelqu'un essaie de
s'habiller est une charge supplémentaire, pas une honnêteté.

## Décision

Deux règles.

**1. Pendant le guidage, jour 1 et jour 30 sont indiscernables.**
L'écran live n'exprime jamais l'état de la connaissance du modèle. Aucune variation de ton,
de contenu ou de rythme selon la confiance. C'est un invariant testable.

**2. L'incertitude ne s'exprime que dans trois surfaces**, toutes situées hors du moment de
l'action : l'Aperçu (avant), le Bilan (après), et « Tes matins » (à froid).

Règle d'écriture associée, retenue de Camille : **l'honnêteté porte sur l'état de la
connaissance, jamais sur la compensation.** L'app peut dire qu'elle ne connaît pas encore un
trajet. Elle ne dit jamais qu'elle a pris de la marge, ni qu'elle a prévu large, ni qu'elle
préfère être prudente. Cette seconde famille de formulations fait fuiter R4 par le sens même
quand elle ne lâche aucun chiffre.

## Justification

L'écran live est le seul moment où la personne **agit**. Agir n'a pas besoin de savoir ce que
la machine ignore. Toute information qui n'aide pas le geste en cours est du bruit, et le
bruit est précisément ce dont souffre le public visé.

La règle a un second effet, qui a emporté ma décision : elle rend R1 vérifiable par une
machine. « Jour 1 et jour 30 indiscernables » se teste en construisant le même plan avec un
modèle vide et un modèle nourri, et en comparant le DOM rendu. Un principe de ton devient un
invariant. Peu de règles éditoriales ont cette propriété.

## Ce qu'on abandonne en la prenant

- La possibilité de rassurer en direct quelqu'un qui doute du plan pendant qu'il le suit.
  Assumé : ce doute se traite dans l'Aperçu, avant de commencer.
- Une part de la promesse d'honnêteté, restreinte à trois surfaces au lieu de toutes.
- Mon propre critère de sortie de J2, qui demandait qu'au septième matin l'utilisateur
  « sache dire ce que l'app a appris de lui ». Camille a montré que ça fabrique de la
  gamification et contredit le §3 de la vision. Le critère devient : **son heure de lever a
  bougé sans qu'il ait eu à régler quoi que ce soit.** Le progrès se constate, il ne se
  raconte pas.

## Conséquences

- Un test de non-régression compare le rendu du live sous modèle vide et sous modèle nourri.
  Toute différence de chaîne est un échec.
- Les chaînes d'incertitude sont écrites par Camille et vivent dans `copy.js`, sous des clés
  explicitement rattachées à l'une des trois surfaces autorisées.
- Ce qui existe déjà dans ce registre (`preview_travel_known`, `preview_learned`) est conforme
  par construction : les deux sont dans l'Aperçu.

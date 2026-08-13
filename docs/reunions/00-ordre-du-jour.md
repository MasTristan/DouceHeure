# Rythme et ordre du jour des réunions

Trois réunions pour passer du diagnostic aux specs de développement. Pas quatre. Une
équipe de six sur un projet sans utilisateur actif n'a pas besoin d'un rituel, elle a
besoin d'un cap et de décisions écrites.

---

## R1 · Ouverture (diagnostic croisé)

**Format.** Chaque membre analyse le projet depuis son angle, sur pièces, en lisant le
code réel. Consigne explicite donnée à chacun : contester la vision de reprise là où il
n'est pas d'accord. Une réunion d'ouverture où tout le monde valide est une réunion ratée.

**Livrables attendus, un par personne, dans ce dossier.**

| Fichier | Auteur | Sujet |
|---|---|---|
| `r1-lea-recherche.md` | Léa Ferrand | Parcours jour 1 à jour 7, vice de l'estimation initiale, protocole sans télémétrie |
| `r1-nour-archi.md` | Nour Belkacem | Découpe de `ui.js`, service worker, fiabilité iOS longue durée, budgets |
| `r1-sacha-moteur.md` | Sacha Roy | Autopsie chiffrée du moteur, démarrage à froid, calibration de la marge |
| `r1-iris-interaction.md` | Iris Tanaka | Geste de confirmation et accessibilité, dialogues natifs, ergonomie du matin |
| `r1-milo-qualite.md` | Milo Vasseur | Cartographie du risque de régression, harnais anti bug de la douche, CI, recette |
| `r1-camille-editorial.md` | Camille Ndiaye | Ton, écriture pour la voix, vocabulaire de l'incertitude, fuites hors de `copy.js` |

**Question à laquelle R1 doit répondre.** Sur quoi se joue réellement la survie du produit :
la fiabilité, la première semaine, ou la qualité du moteur ?

---

## R2 · Arbitrage

**Format.** Je tranche. Chaque désaccord remonté en R1 est nommé, instruit, et clos par une
décision. Les décisions structurantes deviennent des ADR dans `docs/decisions/`.

**Points d'arbitrage anticipés avant même d'avoir lu les livrables.**

1. **Séquencement.** J1 (socle) avant J2 (première semaine) est mon choix. Il est
   contestable : refactorer avant de savoir quoi construire est un classique de l'équipe
   qui se rassure. À instruire.
2. **Le vice de l'estimation initiale.** Si les personnes en cécité temporelle
   sous-estiment leurs durées, alors l'estimation déclarative qui pilote les sept premiers
   jours est biaisée à la baisse par construction. R3 interdit d'injecter une estimation
   gonflée dans les mesures. Il faut trouver la sortie.
3. **Voix et écriture inclusive.** La spec impose que la voix prononce exactement la chaîne
   affichée. Les formes en « prêt(e) » sont mauvaises à l'oral. Soit on réécrit en
   épicène, soit on casse la règle. Arbitrage à rendre.
4. **Le geste de confirmation.** R2 impose l'appui tenu. L'accessibilité le conteste. La
   règle produit ne bouge pas, l'implémentation doit changer. Comment.
5. **Dépendances de test.** Milo voudra peut-être un outil pour tester le rendu. Nour a un
   droit de veto sur les dépendances. Trancher, et écrire la règle.

---

## R3 · Specs de développement

**Format.** Une spec par chantier, écrite pour être exécutable par quelqu'un qui n'a pas
assisté aux réunions. Chaque spec contient : le problème, le comportement attendu, les
fichiers touchés, les règles R1 à R5 engagées, les tests qui prouvent que c'est fait, ce
qu'on retire en échange, et les critères de sortie.

Destination : `docs/specs/`.

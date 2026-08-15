# S5 · Statut : cinq articles sur six

Jalon J4 **partiellement livré, et il ne peut pas l'être autrement dans cet environnement.**
Les articles 1 à 5 sont faits et vérifiés. L'article 6, la recette sur appareil réel, est le
vrai livrable du jalon et demande un iPhone.

## Ce qui est fait

| Article | État |
|---|---|
| 1 · Dynamic Type | fait. 77 tailles en pixels converties, racine branchée sur le réglage système, `--base-scale` retiré (DEC-12) |
| 2 · Contrastes | fait. 34 couleurs en dur tokenisées, deux échecs AAA réels trouvés et corrigés en scène Plein jour |
| 3 · Feuille, forme définitive | mécanique livrée en J1, ergonomie **à juger en recette** |
| 4 · Mode chevet actionnable | fait. Contenu lisible, luminosité et sortie atteignables au clavier |
| 5 · Chaînes du geste | fait, moins une, volontairement (voir plus bas) |
| 6 · Recette sur appareil réel | **pas fait, et c'est le critère de sortie** |

246 tests verts au début du jalon, 249 à la fin.

## Ce que J4 retire (DEC-12)

Le réglage de taille de texte dans l'app. La taille appartient au système, que la personne a
déjà réglé une fois pour tout son téléphone. Le mode lisible reste, requalifié : il change la
fonte pour une fonte dessinée pour la lisibilité et coupe l'italique, ce que le système ne
fait pas.

## Une chaîne de S2 §7 n'a pas été écrite

« Annulation en mode tap » nomme une fenêtre d'annulation qui n'existe pas : en mode tap,
`confirm-control.js` confirme au premier clic. L'introduire changerait la sémantique de R2 et
contredirait la promesse même du mode tap, « un tap suffit, plus direct ».

Ce n'est pas un oubli, c'est un refus argumenté : la spec présupposait un comportement absent.
Si la recette montre que le tap simple produit de vraies fausses confirmations, c'est une
décision à prendre, avec son ADR, pas une chaîne à ajouter en passant.

## Le critère de sortie n'est PAS atteint

> La recette de la spec v2 §19 passe en entier, sur appareil réel, VoiceOver compris et nuit
> branchée comprise, et le temps de premier rendu est mesuré et écrit.

Aucune des trois recettes n'a été exécutée. Elles ne sont pas automatisables, c'est
précisément pourquoi elles ont survécu à quatre jalons.

**Ce qui les rend maintenant utiles**, et ne l'était pas avant : les chemins qu'elles testent
existent enfin. VoiceOver avait besoin de J0 (les quatre chemins du geste), de J1 (le live
qui cesse de se reconstruire) et de J4 article 4 (le chevet lisible). Lancer la recette avant
aurait mesuré des bugs connus.

### Ce qu'il faut pour la lancer

1. Un iPhone, l'app installée sur l'écran d'accueil via le menu Partage de Safari.
2. Une session du matin complète, VoiceOver actif du début à la fin.
3. Une nuit, le téléphone branché, le mode chevet armé le soir.
4. Une mesure de temps avant premier rendu, app installée, en Low Power Mode.

Chaque échec produit un défaut nommé, avec son test quand c'est possible, et rouvre le jalon.
C'est la règle appliquée depuis J0.

## Ce qui reste ouvert après ce cycle

Repris de `S5-le-corps.md` §10, inchangé : l'article 4 de S4 (segmentation et mémoire, lié au
chantier stockage), le coût mesuré du parcours sans destination (1,7 minute par matin), et le
protocole de testeurs de S3 §6, qui n'a pas démarré.

## État du budget (ADR-005)

| | mesuré | budget | marge |
|---|---|---|---|
| code hors commentaires | 175 595 | 189 440 | 13 845 |
| poids transféré | 230 351 | 266 240 | 35 889 |

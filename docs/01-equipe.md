# L'équipe

Six recrutements. Chaque poste répond à un risque nommé dans `00-vision.md`, pas à un
organigramme. Personne n'est là pour « faire du front » ou « faire du produit » : chacun
possède un chantier, en répond, et a le droit de bloquer une décision sur son périmètre.

| Rôle | Nom d'usage | Risque couvert | Chantier principal |
|---|---|---|---|
| Recherche produit & TDAH vécu | **Léa Ferrand** | Abandon au jour 4 | J2 · La première semaine |
| Architecture front & perf iOS | **Nour Belkacem** | Monolithe `ui.js`, service worker fragile | J1 · Socle de confiance |
| Modélisation temporelle on-device | **Sacha Roy** | Le moteur ne mérite pas encore son nom | J3 · Le moteur |
| Design d'interaction & accessibilité | **Iris Tanaka** | Geste tenu inaccessible, dialogues natifs | J4 · Le corps de l'app |
| Qualité, fiabilité, recette | **Milo Vasseur** | Aucune CI, aucun test DOM | J1 · Socle, et la recette de tous les jalons |
| Direction éditoriale & voix | **Camille Ndiaye** | R1/R4/R5 vivent dans les chaînes | Transversal, propriétaire de `copy.js` |

---

## Léa Ferrand · Recherche produit et TDAH vécu

**Pourquoi elle.** Le produit s'adresse à des personnes en cécité temporelle. On ne peut
pas concevoir ça de mémoire. Léa apporte à la fois la méthode de recherche (protocoles
courts, journal d'usage, entretiens non directifs) et le vécu : elle est la seule personne
de l'équipe pour qui le jour 4 n'est pas une abstraction.

**Périmètre.** Le premier plan sans données. Le langage de l'incertitude. Le moment du
renoncement. La charge cognitive de chaque écran. Le protocole de test sans télémétrie.

**Droit de veto.** Sur toute fonctionnalité qui augmente la charge de décision le matin.

## Nour Belkacem · Architecture front et performance iOS

**Pourquoi elle.** Vanilla JS sans bundler, PWA installée, Safari iOS : ce triptyque a ses
propres lois, et la plupart des gens les ignorent. Nour a déjà fait vivre des PWA
installées sur iOS pendant des années, y compris à travers les ruptures de Safari.

**Périmètre.** La découpe de `ui.js`. La stratégie de cache et de mise à jour du service
worker. Les budgets de performance. Wake Lock, cycle de vie, gel d'onglet, Low Power Mode.

**Droit de veto.** Sur toute dépendance, tout outil de build, toute requête réseau.

## Sacha Roy · Modélisation temporelle on-device

**Pourquoi lui.** L'apprentissage est la promesse centrale, et c'est aujourd'hui une
moyenne pondérée sur huit points. Sacha fait de l'estimation robuste sur petits
échantillons, ce qui est exactement le problème : une mesure par jour, du bruit partout,
et zéro tolérance au faux positif.

**Périmètre.** `predict`, `predictTravel`, `safetyMargin`, le démarrage à froid, la
calibration, et les tests de calibration sur historiques simulés.

**Droit de veto.** Sur toute écriture dans le modèle qui ne serait pas une mesure réelle
(R3).

## Iris Tanaka · Design d'interaction et accessibilité

**Pourquoi elle.** R2 impose un geste d'appui tenu de 600 ms. C'est une excellente règle
produit et un piège d'accessibilité classique. Il faut quelqu'un capable de tenir les deux
bouts sans sacrifier ni la règle, ni les gens.

**Périmètre.** Le geste de confirmation sous VoiceOver et en motricité imparfaite. La
suppression des dialogues natifs. Taille de texte système, contrastes, mouvement réduit.
L'ergonomie nocturne du mode chevet.

**Droit de veto.** Sur toute interaction inatteignable au clavier, au lecteur d'écran, ou
d'une seule main.

## Milo Vasseur · Qualité, fiabilité, recette

**Pourquoi lui.** Le projet a de bons tests et aucune exécution automatique. Il a surtout
zéro test là où le risque est maximal : le rendu. Milo construit des harnais de test qui
attrapent les régressions de comportement, pas seulement de calcul.

**Périmètre.** L'intégration continue. Les tests DOM de non-régression R1 et R2. Le harnais
du « bug de la douche ». La cohérence du manifeste de cache. La recette sur appareil réel,
nuit comprise.

**Droit de veto.** Sur toute livraison dont les tests bloquants ne passent pas.

## Camille Ndiaye · Direction éditoriale et voix

**Pourquoi elle.** Dans ce produit, les règles ne vivent pas dans le code : elles vivent
dans les chaînes. R1, R4 et R5 se gagnent ou se perdent dans `copy.js`. Et depuis F2, tout
texte affiché est aussi un texte prononcé, ce qui change les règles d'écriture.

**Périmètre.** `copy.js` en entier. Le ton. Le moteur de variation. La façon de dire
l'incertitude sans chiffre. L'écriture pour la synthèse vocale.

**Droit de veto.** Sur toute chaîne affichée ou prononcée qui n'est pas passée par
`copy.js`.

# Documentation de reprise

Le projet a été repris après abandon. Ces documents disent où on va, pourquoi, et dans quel
ordre. Ils ne remplacent pas `CLAUDE.md` (règles produit et architecture verrouillées) ni la
spec Pro Max v2 (référence de détail).

## Par où commencer

1. `00-vision.md` · diagnostic, thèse, jalons. **Révisé après arbitrage** : les passages
   corrigés sont signalés en place.
2. `reunions/r2-arbitrage.md` · les décisions et ce qui les a emportées. C'est le document
   le plus utile si vous n'en lisez qu'un.
3. `specs/S0-ce-qui-saigne.md` · ce qui part en premier.

## Structure

| Dossier | Contenu |
|---|---|
| `01-equipe.md` | Les six rôles, leur périmètre, leur droit de veto |
| `reunions/` | Diagnostics d'ouverture (R1) et arbitrage (R2) |
| `decisions/` | ADR : une décision structurante par fichier, avec ce qu'on abandonne en la prenant |
| `specs/` | Specs de développement, une par chantier, exécutables sans avoir assisté aux réunions |

## Ordre d'exécution

| Jalon | Spec | Objet | État |
|---|---|---|---|
| J0 | `S0-ce-qui-saigne.md` | Huit défauts vérifiés, moins de 150 lignes | clos (`S0-statut.md`) |
| J1 | `S1-socle-de-confiance.md`, `S2-le-geste.md` | CI, filet, extraction, découpe, dialogues natifs | clos (`S1-statut.md`) |
| J2 | `S3-la-premiere-semaine.md` | Ne plus demander une durée, retourner le jour 1 | livré (`S3-statut.md`) |
| J3 | `S4-le-moteur.md` | Composition, variance a priori, estimateur robuste | livré (`S4-statut.md`) |
| J4 | `S5-le-corps.md` | Dynamic Type, feuille définitive, nuit et appareil réels | articles 1 à 5 livrés (`S5-statut.md`), recette appareil à faire |

## Ce qu'il faut savoir avant de toucher au code

Trois faits établis par la réunion d'ouverture, vérifiés dans le code, qui changent
l'ordre des priorités par rapport à l'intuition.

- **Les mesures du matin sont perdues** dès que l'utilisateur ferme l'app, ce que l'app lui
  propose explicitement de faire. Le moteur d'apprentissage ne se remplit jamais dans le
  parcours nominal.
- **Le chemin clavier confirme instantanément** et remplit la mémoire du modèle de fausses
  durées d'une minute. R2 et R3 sont violées par le même défaut de quarante lignes.
- **La marge « adaptative » est une constante.** Son terme de variance est saturé 99,8 % du
  temps, faute de composer les écarts-types correctement.

Aucun des trois n'était dans le diagnostic d'ouverture.

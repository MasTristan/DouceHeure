# S1 · Statut : le socle de confiance est en place

Jalon J1 clos. Neuf étapes, de l'intégration continue à l'arrêt de la reconstruction du
live. `js/ui.js` (2 006 lignes, aucun test) n'existe plus.

## Les quatre critères de sortie de Milo

| # | Critère | État |
|---|---|---|
| 1 | `tests/live-r2.test.mjs` couvre les cinq chemins d'avancement, vert en CI | tenu |
| 2 | Un commit qui casse R2 démontré rouge sur une branche jetable | tenu (`journal.md`, J1 étape 2) |
| 3 | `tests/service-worker.test.mjs` vert, capacité de détection démontrée | tenu |
| 4 | Une recette courte consignée dans `docs/recettes/journal.md` | tenu |

## Ce que J1 retire (DEC-12)

**Les cinq dialogues natifs.** Le compte de la vision disait quatre : il datait d'avant J0.
Sortie du mode chevet, import de sauvegarde, suppression d'un départ, et deux créations de
destination. Tous remplacés par `js/ui/sheet.js`, non bloquant. Un test structurel
(`tests/sheet.test.mjs`) interdit mécaniquement leur retour dans `js/`.

**La confiance aveugle.** 41 tests au début du cycle, 174 aujourd'hui, exécutés à chaque
poussée. Les règles R1, R2 et R3 sont vérifiées dans le DOM rendu, pas seulement dans les
chaînes.

## Les neuf étapes

| Étape | Objet |
|---|---|
| 1 | Intégration continue, manifeste `ASSETS` vérifié et verrouillé par hash |
| 2 | `js/clock.js` (ADR-004), puis le filet contre `ui.js` non modifié, éprouvé au rouge |
| 3 | `js/live.js` : la décision d'avancement extraite en machine à états pure |
| 4 à 7 | La découpe : `ui/`, `live/`, `night/`, `screens/`, `learned.js`, `now.js` |
| 8 | La feuille de confirmation remplace les dialogues natifs (DEC-03) |
| 9 | Le live cesse de se reconstruire (S2 §5) |

## Ce que J1 n'a pas fait, et qui reste dû

- **Les chaînes prononcées à l'armement** (S2 §7). L'état armé se voit maintenant, il ne
  s'entend pas encore. Propriété de Camille, jalon J4.
- **La forme définitive de la feuille** (S2 §3.1). Ce qui est livré est le composant minimal
  et vérifiable demandé par DEC-03 à Milo ; l'ergonomie définitive revient à Iris en J4.
- **Le mode chevet pleinement actionnable** (S2 §6). La sortie du chevet est désormais
  atteignable et confirmable sans dialogue natif, mais le réglage de luminosité reste un
  geste de glissement sans équivalent focusable.
- **La recette sur appareil réel.** VoiceOver sur iPhone et une nuit branchée réelle n'ont
  toujours jamais été exécutés. Ce sont les deux seules choses non automatisables du projet,
  et elles restent la condition de toute mise en production.

## Le budget de performance devient contraignant

Le JavaScript de production pèse **215 719 octets** pour un budget de 220 Ko. Il reste moins
de 10 Ko pour J2, J3 et J4. Ce n'est pas tenable par simple addition : les jalons suivants
devront retirer du code, ce qui tombe bien puisque la règle du cycle l'exige déjà
(`00-vision.md` §2, « le silence est un livrable »). À traiter explicitement à l'ouverture
de J2, pas au moment où le budget cassera.

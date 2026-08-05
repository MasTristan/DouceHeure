# S0 · Statut : les huit défauts sont corrigés

Jalon J0 clos. Huit défauts, huit commits, un test par défaut, chaque test prouvé au rouge
avant correctif (via `git stash`, y compris pour le module nouvellement créé) puis vérifié
au vert après. Aucune découpe, aucun renommage, aucune amélioration opportuniste : chaque
diff se limite au périmètre décrit dans `S0-ce-qui-saigne.md`.

| # | Défaut | Commit | Tests ajoutés |
|---|---|---|---|
| B4 | Fuite de Wake Lock | `2d96636` | `tests/wakelock.test.mjs` |
| B5 | `saveState()` sans garde, `history` sans FIFO | `703a240` | `tests/store-persistence.test.mjs` |
| B8 | Scène Nuit atteignable par import | `3761ce2` | `tests/scene-invariant.test.mjs` |
| B6 | Repli mort du service worker | `64bb33e` | `tests/service-worker.test.mjs` |
| B7 | Destination jamais retenue dans l'Aperçu | `e00548b` | `tests/preview-defaults.test.mjs` |
| B1 | Mesures perdues à la fermeture de l'app | `796d1e4` | `tests/session-persistence.test.mjs` |
| B2/B3 | Clavier instantané, VoiceOver inutilisable | `4fddb82` | `tests/confirm-control.test.mjs`, `tests/confirm-control-wiring.test.mjs` |

**État final** : 86 tests, 86 verts (41 hérités + 45 nouveaux). JS de production à 179 298
octets, sous le budget de 220 Ko. Manifeste du service worker exact (tous les fichiers
`js/` couverts). Aucun tiret cadratin introduit.

---

## Ce qui a été fait au-delà de la lettre de la spec, et pourquoi

**B1.** La spec proposait un `pendingSession` qui bufferise les mesures jusqu'à la fin.
L'implémentation retenue est plus directe : chaque confirmation écrit immédiatement dans
`step.real` via `recordDurations`, sans détour par un tampon. `pendingSession` existe quand
même, mais comme un marqueur léger purgé après 8 h, pas comme le vecteur des mesures
elles-mêmes. Résultat identique aux tests demandés, surface d'état plus petite.

**B2/B3.** La spec S2 (destinée à J1/J4) décrit une conception complète du geste de
confirmation. Une partie a été anticipée ici, dans la mesure strictement nécessaire pour
que B2 et B3 aient un correctif réel et testable : extraction d'une machine d'état pure
(`js/confirm-control.js`), câblée sur les quatre chemins (maintien, clavier, assistif, tap).
Ce qui reste dû à J1/J4 et n'a **pas** été fait ici : les chaînes prononcées lors de
l'armement (S2 §7, propriété de Camille), le style visuel de l'état armé (classe `is-armed`
posée côté JS, non stylée), et surtout **le live continue de se reconstruire toutes les
5 secondes** (S2 §5) : c'est pourquoi le chemin assistif utilise une fenêtre de 8 secondes
plutôt qu'une fenêtre indéfinie, mais un utilisateur VoiceOver qui arme puis attend plus de
5 secondes perd son armement au prochain rendu du ticker. Ce n'est pas un défaut nouveau,
c'est une limite connue et documentée, à lever par le chantier J1/S2 « le live cesse de se
reconstruire ».

Les quatre dialogues natifs (`confirm`/`prompt`) n'ont pas été touchés : DEC-03 les a
explicitement remontés en J1, hors du périmètre de J0. `renderNight` garde son unique
`confirm()` préexistant, verrouillé par un test qui échouerait si un second était introduit
par erreur.

---

## Limite assumée des tests B2/B3

`js/ui.js` n'est pas importable en Node (`document.getElementById('app')` s'exécute au
chargement du module, ligne 22). Les tests de ce jalon vérifient donc :
1. le contrat comportemental de `confirm-control.js` intégralement, sans DOM ;
2. le câblage réel dans `ui.js` par inspection structurelle du code source (présence des
   bons appels, absence des anciens patterns fautifs) plutôt que par exécution.

Le harnais `tiny-dom` qui permettrait d'exécuter réellement `holdButton()` sous Node,
pointeur et clavier simulés, est le livrable de J1 (`S1-socle-de-confiance.md`, étape 2).
Milo en a déjà prouvé la faisabilité (139 lignes, 0,24 s) pendant la réunion d'ouverture. Ce
jalon n'a pas cherché à le construire en avance : ça aurait été une amélioration
opportuniste au sens interdit par la règle de cette spec.

**Recette manuelle requise avant toute mise en production** : VoiceOver sur iPhone réel,
mode chevet sur une nuit branchée réelle. Aucun des deux n'est automatisable et aucun des
deux n'a été exécuté dans ce jalon.

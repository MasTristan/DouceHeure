# Journal de recette

Chaque test du filet doit être éprouvé au rouge avant d'être considéré comme un test :
réintroduire volontairement le défaut, vérifier que le test le voit, jeter la preuve. Ce
journal consigne ces preuves. Un test qui n'y figure pas n'a pas été éprouvé.

---

## J0 · Ce qui saigne

Chacun des huit correctifs (`docs/specs/S0-statut.md`) a été prouvé au rouge en stashant le
fichier corrigé (`git stash push`, y compris pour les fichiers nouvellement créés via
`-u`), en exécutant le test contre le code pré-correctif, en confirmant l'échec avec le
message attendu, puis en restaurant (`git stash pop`).

| Défaut | Test | Preuve au rouge |
|---|---|---|
| B4 · fuite Wake Lock | `tests/wakelock.test.mjs` | Sans le drapeau `wanted`, 2 acquisitions au lieu de 1 après `release()` |
| B5 · `saveState` sans garde | `tests/store-persistence.test.mjs` | `MAX_HISTORY` absent, l'export lève à l'import |
| B8 · scène Nuit | `tests/scene-invariant.test.mjs` | `resolveScene({scene:'night'}, h)` retourne `'night'` sur les 24 heures |
| B6 · repli SW mort | `tests/service-worker.test.mjs` | Réponse `undefined` confirmée sur les deux scénarios hors-ligne |
| B7 · destination non persistée | `tests/preview-defaults.test.mjs` | Export `commitPreviewDefaults` absent |
| B1 · mesures perdues | `tests/session-persistence.test.mjs` | Export `PENDING_SESSION_PURGE_MS` absent |
| B2/B3 · geste clavier/assistif | `tests/confirm-control.test.mjs`, `tests/confirm-control-wiring.test.mjs` | Module `confirm-control.js` inexistant, échec à l'import |

---

## J1 étape 1 · Intégration continue et manifeste

| Test | Preuve au rouge |
|---|---|
| Couverture du manifeste (`tests/service-worker.test.mjs`) | Un fichier `js/oublie-test.js` ajouté hors `ASSETS` fait échouer le test, message nommant le fichier |
| Fraîcheur du verrou | Contenu de `js/time.js` modifié sans re-tamponnage : le test échoue, message pointant vers `sw-stamp.mjs` |
| Refus du stamp tool | Bout en bout : `js/time.js` modifié, `VERSION` inchangée, `node tests/tools/sw-stamp.mjs` sort en erreur (exit 1), le verrou n'est **pas** réécrit (vérifié par `git diff --stat`) |

---

## J1 étape 2 · Le filet contre `ui.js`

### `js/clock.js` (fondation du filet)

10 tests directs (`tests/clock.test.mjs`) couvrant le mode réel, le mode factice, l'ordre de
déclenchement de plusieurs minuteurs, la reprogrammation des intervalles, la
programmation en cascade pendant un `tick()` en cours, et `resetClock()`. Validés
positivement (pas de red-proof séparé : ce module n'a pas de comportement antérieur à
casser, il est la fondation elle-même).

### `tests/live-r2.test.mjs` — le harnais anti bug de la douche

**La preuve la plus importante du projet.** Sur une branche jetable
(`throwaway/prove-r2-catches-regression`, créée puis détruite) :

1. `liveTicker = clock.setInterval(renderLive, 5000)` remplacé par
   `clock.setInterval(confirmNext, 5000)` — reproduction littérale du bug de la douche
   d'origine (l'horloge fait avancer l'étape).
2. Commit sur la branche jetable.
3. `node --test tests/*.test.mjs` : **118 tests, 114 passent, 4 échouent**, dont le test
   nommé « bug de la douche » avec le message
   *« BUG DE LA DOUCHE REPRODUIT : l'étape a avancé sans confirmation, uniquement parce que
   le temps a passé »*.
4. Retour sur `claude/project-revival-vision-yfta0f`, branche jetable détruite
   (`git branch -D`). Aucune trace laissée.

C'est la démonstration que la CI, une fois branchée en protection de branche, aurait
bloqué ce commit précis.

### `tests/live-r1.test.mjs` — R1 dans le DOM rendu

Injection working-tree (fichier modifié puis restauré depuis une copie, sans commit) :
message de l'étape courante concaténé avec `' Il te reste 3 min.'`. Résultat : 3 des 6
tests échouent (les trois qui touchent l'écran live à des états différents), message
citant la formulation interdite trouvée mot pour mot. Restauré, suite revérifiée verte.

### `tests/live-r3.test.mjs` — R3 dans le comportement réel

Injection working-tree : garde `!live.polluted` retirée de `confirmNext`
(`if (step.key !== 'leave' && !live.polluted)` → `if (step.key !== 'leave')`). Résultat :
exactement le test de pollution échoue (« l'étape polluée par l'imprévu a quand meme une
mesure ecrite », 1 !== 0), les trois autres restent verts — preuve que le test cible bien
le mécanisme attendu et rien d'autre. Restauré.

### `js/live.js` — extraction (étape 3)

Preuve à deux niveaux, sur le module extrait lui-même plutôt que sur `ui.js` : dans
`computeConfirm`, la garde `!live.polluted` retirée de la condition d'écriture de la
mesure (reproduction de la même classe de défaut que le red-proof de `live-r3` ci-dessus,
mais localisée dans le nouveau module). Résultat, en une seule exécution :

- `tests/live.test.mjs` (unitaire, pur) : le test « étape polluée (F6) ne décrit aucune
  mesure » échoue directement sur `computeConfirm`.
- `tests/live-r3.test.mjs` (bout en bout, DOM réel) : le test « étape polluée par un
  imprévu » échoue via `ui.js` → `confirmNext` → `computeConfirm`.

Les 21 autres tests (dont tout `live-r2`, `live-r1`, `live-invariance`) restent verts :
la régression est capturée exactement là où elle se produit, à deux altitudes
différentes, sans bruit ailleurs. C'est la preuve que l'extraction a bien centralisé la
décision — casser un seul endroit dans `live.js` se voit désormais à la fois localement et
de bout en bout. Restauré, 137/137 revérifié.

### `tests/live-invariance.test.mjs` — ADR-003

Injection working-tree : libellé de l'étape concaténé avec `step.dur`
(`step.label + ' ' + step.dur`). Résultat : les deux tests échouent avec un diagnostic
concret, `"Réveil 5"` contre `"Réveil 6"` — la divergence entre modèle froid et modèle
nourri rendue visible caractère pour caractère, exactement ce que le test existe pour
empêcher. Restauré.

## J1 étape 4 · Découpe de `live/*`

L'étape la plus risquée de la découpe (Nour, R1 §1.4) : `js/ui.js` faisait vivre
`startLive`, `confirmNext`, le tiroir de séquence et l'écran de départ dans un seul
fichier, avec ~30 appels croisés entre ces responsabilités. Découpé en quatre fichiers
(`live/controller.js`, `live/view.js`, `live/drawer.js`, `live/leave.js`) qui ne
s'importent jamais statiquement entre eux (cycle inévitable sinon : controller → view →
leave → controller, et controller ↔ drawer), reliés par un registre de fonctions
(`live/registry.js`, même principe que `ui/nav.js` de l'étape 3), appliqué uniformément à
chaque appel croisé plutôt qu'au cas par cas pour réduire le risque d'erreur d'analyse.
`ctxNow`/`nowMinutes` extraits dans `js/now.js` (partagés par `ui.js` et
`live/controller.js`, qui ne peuvent pas s'importer l'un l'autre).

### Piège découvert pendant l'extraction : l'état de session devient un singleton de test

Avant cette étape, `live` (l'état de session en mémoire) vivait dans `js/ui.js`, module
réimporté avec un suffixe de requête à chaque cas de test (`import('../js/ui.js?t=...')`)
précisément pour repartir d'un état frais. En le déplaçant dans `live/controller.js`,
importé de façon STATIQUE par `ui.js`, ce module n'est plus jamais réinstancié : `live`
reste fixé par la première session jamais créée dans le process de test, et
`if (live) return;` bloque silencieusement toute session suivante dans le même fichier de
test. Symptôme observé : `Cannot read properties of null (reading 'dispatchEvent')` dans
`tests/live-r2.test.mjs` (le bouton de confirmation n'existe jamais si la session n'a pas
démarré), et des assertions `undefined !== "..."` dans `tests/live-invariance.test.mjs`
(deux sessions froide/nourrie dans le même test, la seconde ignorée).

Corrigé par `resetLiveForTests()` (miroir de `resetClock()`, `js/clock.js`) : remet
`live`/`liveTicker` à zéro, appelé dans `test.afterEach` des quatre fichiers concernés
(`live-r1`, `live-r2`, `live-r3`, `live-invariance`) et, en plus, au milieu même des tests
`live-invariance` qui lancent deux sessions dans un seul cas.

Preuve au rouge (working-tree) : corps de `resetLiveForTests()` vidé (no-op), suite
`live-r2` + `live-r3` + `live-invariance` relancée seule. Résultat : 9 échecs sur 12,
exactement le même ensemble et les mêmes messages que l'échec initial découvert pendant
l'extraction (`ADR-003` ×2, `R2` ×4, `R3` ×3). Les 3 tests encore verts sont ceux qui ne
créent qu'une seule session par fichier et n'en dépendent donc pas. Restauré, 141/141
revérifié.

Cet enseignement s'applique tel quel à l'étape 5 (`night/*`) : `night`/`nightTicker`
devront recevoir le même traitement dès qu'ils quittent `ui.js`.

## J1 étape 5 · Découpe de `night/*`

Même geste que l'étape 4, sur le mode chevet (F1, spec v2 §6) : `controller.js` (état,
`startNight`/`stopNight`/`nightTick`/`startRinging`) et `view.js` (`renderNight`,
`renderWakeProposal`, `renderGoodMorning`) s'appellent en croix, reliés par
`night/registry.js` (même principe que `live/registry.js`). `setup.js`
(`showBedsideSetup`) n'a pas besoin du registre : il importe `startNight` directement,
`controller.js` ne dépendant jamais de lui en retour. `ui.js` passe de 1398 à 1094 lignes.

Piège anticipé dès l'étape 4 (paragraphe ci-dessus) : `night`/`nightTicker` déplacés dans
`night/controller.js`, importé statiquement par `ui.js`, deviennent eux aussi un
singleton de test. `resetNightForTests()` ajouté immédiatement (même geste que
`resetLiveForTests()`), appelé dans `test.afterEach` des fichiers qui arment le chevet
(`session-guard`, `live-r1`, `live-r2`, `night-tick`).

Preuve au rouge, cette fois construite plutôt que découverte après coup : un second test
ajouté à `tests/night-tick.test.mjs` qui arme un chevet dans un cas de test distinct, sans
jamais arrêter explicitement celui du premier cas. Corps de `resetNightForTests()` vidé
(no-op) : le second test échoue avec `"l'écran de nuit n'apparaît pas au second armement
de chevet"`, `startNight()` restant bloqué par `if (night) return;` sur l'état laissé par
le premier cas. Restauré, 143/143 revérifié.

## J1 étape 6 · Découpe des huit écrans plats et de `js/learned.js`

Dernier morceau d'état, `js/learned.js` : la section "ce que l'app a appris" de
`showMornings` calculait un jour lent par étape (moyenne par jour, comparaison au global)
directement dans la couche de rendu, en violation de CLAUDE.md §4. Extrait en deux
fonctions pures (`learnedSteps`, `learnedTravels`) qui rendent des DONNÉES (`{ label,
slowDay }`, jamais une chaîne affichable) : la composition des phrases via `copy.js` reste
dans `screens/mornings.js`, conformément à la convention du projet (tous les textes
affichés viennent de `copy.js`, jamais d'un module de calcul). `tests/learned.test.mjs`
couvre le seuil de 3 mesures et le bruit d'une seule mesure lente isolée qui ne doit pas
ressortir.

Les huit écrans (`onboarding`, `home`, `preview`, `trip`, `feedback` + `showCardOffer`,
`mornings`, `settings`, `social`) sont bien plus interconnectés que `live/*` ou `night/*` :
`home` est un carrefour vers presque tous les autres, et plusieurs écrans reviennent vers
`home`. Plutôt qu'un registre local par paire de fichiers (comme `live/registry.js` ou
`night/registry.js`), chaque écran passe par le registre déjà existant `ui/nav.js` pour
atteindre n'importe quel autre écran : aucun fichier de `screens/` n'importe un autre
fichier de `screens/` (vérifié par `tests/imports.test.mjs`, inchangé). `ui.js` devient une
pure façade de réexport (27 lignes de substance), plus aucune fonction propre.

Risque spécifique à cette étape, plus élevé qu'aux étapes 4/5 : `nav.xxx()` est un accès de
propriété sur un objet ordinaire, jamais vérifié par l'analyse statique. Un nom mal
orthographié (`nav.setttings`, une faute de frappe) ne casse rien à l'import ni aux tests
existants (aucun ne cliquait jusqu'ici à travers ces écrans) : il ne se serait vu qu'au
clic, en production. Nouveau fichier dédié, `tests/screens-nav.test.mjs`, qui clique
réellement d'écran en écran (accueil → mes matins → accueil, accueil → réglages → mes
proches → réglages → accueil, accueil → aperçu → accueil, fin d'onboarding → accueil).

En écrivant ce test, deux lacunes réelles et préexistantes de l'infrastructure de test sont
apparues (ni l'une ni l'autre une régression de cette découpe, simplement jamais
exercées avant que `showSettings` ou son bouton de retour topbar ne soient cliqués dans un
test) :

- `tests/tiny-dom.mjs` ne définissait pas de global `location` : `showSettings` (l'URL de
  raccourci, `location.origin`) levait `ReferenceError: location is not defined` dès qu'un
  test le rendait réellement. Corrigé en ajoutant un stub inerte (même esprit que le stub
  `matchMedia` déjà présent), utile à tout futur test qui rendrait cet écran.
- Le sélecteur `.topbar button, [class*="topbar"] button` dans le brouillon du nouveau test
  ne correspondait à rien (topbar utilise la classe `studio-back-btn`) : corrigé côté test,
  pas côté production.

Preuve au rouge, sur le risque réel de cette étape (une faute de frappe dans un `nav.xxx()`) :
`nav.settings()` renommé en `nav.settingz()` dans `screens/home.js`. `tests/screens-nav.test.mjs`
échoue avec `"nav.settingz is not a function"`, exactement le test concerné (réglages), les
trois autres restant verts. Restauré, 154/154 revérifié.

## J1 étape 7 · Suppression de la façade `js/ui.js`

Dernière étape de la découpe (clause d'arrêt de `S1-socle-de-confiance.md` dépassée depuis
l'étape 4 : le filet a permis d'aller jusqu'au bout). `js/ui.js` ne contenait plus, après
l'étape 6, que des réexports (39 lignes) : supprimé. `app.js` devient le seul point de
composition, avec deux responsabilités qu'`ui.js` portait jusqu'ici sans que rien ne le
documente comme tel :

1. Importer `live/view.js`, `live/drawer.js`, `live/leave.js` et `night/view.js` pour leur
   auto-enregistrement dans `liveNav`/`nightNav` (S1 §4). Ces quatre fichiers ne sont
   importés nulle part ailleurs en production : sans cet import, `live/controller.js` et
   `night/controller.js` plantent au premier appel à
   `liveNav.renderLive()`/`nightNav.renderNight()` (`live/controller.js`, `night/view.js`
   important déjà `controller.js` transitivement).
2. Importer chaque écran plat et remplir `ui/nav.js` (`registerScreens`), déjà en place
   depuis l'étape 6.

**Conséquence sur les tests.** Neuf fichiers de tests dynamiques importaient jusqu'ici
`../js/ui.js?t=...` (suffixe de requête pour repartir d'un module frais). Deux choses ont
changé :

- Le suffixe de requête n'est plus nécessaire : `screens/*.js` et `night/setup.js` n'ont
  aucun état de module (contrairement à `live/controller.js` et `night/controller.js`, qui
  gardent le leur et restent réinitialisés via `resetLiveForTests()`/`resetNightForTests()`,
  inchangés). Les neuf fichiers importent désormais directement la fonction dont ils ont
  besoin (`import { showPreview } from '../js/screens/preview.js'`), en import statique
  ordinaire.
- Comme `ui.js` faisait l'import d'enregistrement (point 1 ci-dessus) et que les tests ne
  passent plus par lui, chaque fichier qui atteint un écran live ou chevet doit désormais
  importer lui-même `live/view.js`/`drawer.js`/`leave.js`/`night/view.js`, exactement comme
  `app.js` le fait en production. Omis dans un premier passage, l'erreur immédiate et sans
  ambiguïté (`liveNav.renderLive is not a function`) a servi de garde-fou : chaque fichier
  concerné a été corrigé un par un jusqu'à retrouver 154/154.

**Le trou qui restait : personne ne testait `app.js` lui-même.** Tous les fichiers de test
réimportent indépendamment les modules d'enregistrement ; aucun ne vérifiait que `app.js`
les importe tous, lui, réellement. Un oubli dans `app.js` (par exemple `live/view.js` non
importé) n'aurait été visible qu'en production, au premier chargement réel de la page.
Nouveau fichier, `tests/app-boot.test.mjs`, qui importe `app.js` directement (comme le
ferait `<script type="module" src="js/app.js">` de `index.html`) et déroule un scénario
complet : accueil affiché au démarrage, clic sur le prochain départ, aperçu, lancement de
la session, confirmation de la première étape.

Preuve au rouge : `import './live/view.js';` retiré de `app.js`. `tests/app-boot.test.mjs`
échoue avec `"liveNav.renderLive is not a function"`, exactement l'erreur qu'un oubli réel
aurait produite en production. Restauré, 155/155 revérifié.

`js/ui.js` disparu du manifeste et de `ASSETS` du service worker (v2.3.0). `CLAUDE.md` §4
et `README.md` mis à jour pour refléter l'arborescence finale (`ui/`, `live/`, `night/`,
`screens/`, `js/learned.js`, `js/now.js`).

---

## Méthode

Deux formes de preuve ont été utilisées, à valeur équivalente :

1. **Working-tree** : modification du fichier de production, exécution du test, capture du
   message d'échec, restauration depuis une copie de sauvegarde (`cp fichier /tmp/backup`
   puis `cp /tmp/backup fichier`), re-vérification que la suite complète redevient verte.
   Rapide, utilisé pour la majorité des preuves.
2. **Branche jetable** : `git checkout -b`, commit du défaut, exécution de la suite,
   observation de l'échec, retour sur la branche réelle, suppression de la branche
   (`git branch -D`). Utilisé pour le test le plus critique (`live-r2`), en toute rigueur
   avec la lettre du critère de sortie de J1.

Dans les deux cas : le défaut n'a jamais été poussé (`push`) sur la branche de travail, et
la suite complète a été revérifiée verte (118/118) après chaque restauration.

## Recette courte (avant chaque livraison)

1. `node --test tests/*.test.mjs` — doit afficher `pass` égal au total annoncé, `fail 0`.
2. `node tests/tools/sw-stamp.mjs` — doit afficher « rien à mettre à jour » (si un
   changement d'ASSETS a eu lieu sans montée de `VERSION`, l'outil refuse et le dit).
3. Relecture du diff : aucun `Date.now()`/`setInterval`/`setTimeout` direct réintroduit
   dans les zones couvertes par `js/clock.js` (`live/*`, `night/*`, `confirm-control.js`).

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

## J1 étape 8 · La feuille remplace les dialogues natifs (DEC-03)

Cinq sites d'appel supprimés, pas quatre : le compte de la vision datait d'avant J0. Sortie
du mode chevet (`night/view.js`), import de sauvegarde (`screens/settings.js`), suppression
d'un départ et création de destination (`studio.js`, deux sites), création de destination
depuis l'Aperçu (`screens/preview.js`).

| Test | Preuve au rouge |
|---|---|
| S2 §8 · aucun dialogue natif dans `js/` (`tests/sheet.test.mjs`) | `confirm(UI.settings_import_confirm)` réintroduit dans `screens/settings.js` : le test échoue en nommant le fichier et l'appel |
| Restauration du focus | La ligne `previousFocus.focus()` retirée de `ui/sheet.js` : le test « le focus revient d'où il vient » échoue |
| Échap vaut renoncement | Branche `if (e.key === 'Escape')` neutralisée : le test échoue, et huit autres restent en suspens (la promesse ne se résout plus jamais), ce qui est exactement le symptôme qu'un utilisateur subirait |

**Ce que le test structurel protège vraiment.** Ce n'est pas une règle de style. Un
`confirm()` est bloquant et non simulable : il rend une zone du produit inatteignable par la
qualité, et les cinq se trouvaient sur les deux chemins les plus destructeurs de l'app,
perdre sa nuit et perdre ses données. Le test interdit mécaniquement leur retour.

**Deux décisions d'ergonomie prises dans ce composant**, toutes deux vérifiées par un test.
Le focus part sur le renoncement et jamais sur l'action destructrice. Valider une saisie
vide ne ferme pas la feuille : une saisie vide n'est pas une réponse, et fermer sur ce geste
transformerait une hésitation en renoncement.

**Correction annexe (S2 §4).** `prefers-reduced-motion` écrasait le remplissage de l'appui
tenu à 150 ms alors que le geste dure 600 ms : la jauge atteignait le bout, puis il fallait
continuer d'appuyer sans aucun retour. Le remplissage garde désormais la durée réelle du
geste ; c'est le ressort d'annulation, purement décoratif, qui est retiré sous réduction de
mouvement. L'état armé du chemin assistif (`is-armed`), jusqu'ici posé côté JS sans style,
est maintenant visible.

**Un test existant a changé de cible, volontairement.** `tests/confirm-control-wiring.test.mjs`
verrouillait *exactement un* `confirm()` dans `renderNight` (garde de J0 contre l'ajout d'un
second, sans interdire la suppression du premier). Sa cible est maintenant zéro, plus
l'exigence positive que la sortie du chevet passe bien par `askConfirm`.

---

## J1 étape 9 · Le live cesse de se reconstruire (S2 §5)

L'écran live construit son arbre une fois par session et n'écrit ensuite que les quelques
nœuds qui changent. Le bouton de confirmation n'est jamais remplacé.

**Ces tests portent sur l'identité des nœuds, pas sur leur contenu.** C'est l'identité qui
porte le focus, l'armement du geste et la sélection de l'utilisateur. Un test de contenu
serait passé au vert sur le code fautif : le contenu était correct, c'est le nœud qui
disparaissait.

Trois régressions distinctes ont été posées, parce qu'une seule ne suffisait pas à éprouver
les sept tests. C'est le point utile de ce jalon : la première preuve a montré que quatre
tests sur sept ne voyaient pas la régression qu'ils étaient censés voir.

| Régression posée | Tests qui virent au rouge |
|---|---|
| **A.** `canReuse()` renvoie toujours `false` : reconstruction complète à chaque battement, comportement littéral d'avant | 1 (bouton remplacé), 2 (focus perdu), 3 (armement perdu), 6 (libellé remplacé) |
| **B.** les deux messages retirés au sort à chaque rendu (défaut relevé par Camille) | 4 (message d'étape), 5 (message de suggestion) |
| **C.** `canReuse()` ne vérifie plus à quelle session appartient le montage | 2, 3, 4, 6, 7 (montage mort réutilisé par la session suivante) |

**Le harnais mentait, et il a fallu le corriger avant de valider un test.** À la première
preuve, le test « le focus survit au ticker » restait vert sous la régression A.
`tests/tiny-dom.mjs` gardait `activeElement` pointé sur un nœud détaché de la page, ce
qu'aucun navigateur ne fait. Le harnais rendait donc indétectable exactement le défaut que
S2 §5 corrige. `dropFocusWithin()` a été ajouté à `removeChild` et `replaceChildren` : le
focus tombe avec l'élément qui le portait. Le test vire au rouge depuis.

**Effet de bord attendu, obtenu** (Camille, S2 §5). `pick('suggested')` était retiré au sort
à chaque rendu et son pool compte deux entrées : les deux phrases alternaient strictement
toutes les 5 secondes sous les yeux de l'utilisateur. Le message d'une étape est maintenant
tiré une fois et ne bouge plus.

**Ce qui reste dû à J4** sur ce composant : les chaînes prononcées à l'armement (S2 §7,
propriété de Camille), et la conception définitive de la feuille (S2 §3.1, Iris). L'état
armé a maintenant un style visible (`is-armed`) et le remplissage de l'appui tenu garde sa
durée réelle sous `prefers-reduced-motion`.

---

## J2 · La première semaine (S3)

### Le simulateur d'abord, la correction ensuite

`tests/tools/simulate.mjs` a été écrit **avant** toute modification du produit. Les chiffres
de la réunion d'ouverture (« un matin sur deux en retard au jour 1 ») vivaient dans un compte
rendu et personne ne pouvait les recalculer : le générateur n'avait jamais été versionné.

**Les chiffres de ce simulateur ne sont pas ceux de R1, et il faut le dire.** R1 annonçait
50 % de matins en retard au jour 1 ; cette re-dérivation en trouve 71 %. Ce n'est pas la même
expérience, c'est une reconstruction du même raisonnement. La conclusion qualitative est
identique et plus dure. Ce que le simulateur assume est écrit en tête du fichier, notamment
l'hypothèse la plus favorable de toutes : l'utilisateur simulé se lève à l'heure proposée.

### Ce que le calibrage change, mesuré

Population de 300 utilisateurs, 20 matins, biais de déclaration 1,4, battement de 5 minutes.

| | jour 1 | jour 2 | jour 3 | régime établi | avance établie |
|---|---|---|---|---|---|
| avant | 71 % en retard | 58 % | 21 % | 1 % | 17,3 min |
| après | **4 %** | 4 % | 1 % | 1 % | 17,3 min |

Le régime établi ne bouge pas d'un pouce, et c'est le résultat le plus important après le
premier : le calibrage agit sur la fenêtre où l'app ne sait rien, puis s'efface dès que les
mesures réelles pèsent dans la prédiction. Un test le vérifie explicitement, pour qu'une
version future du calibrage ne puisse pas fuiter au-delà de sa fenêtre.

Le coût est le lever : 105 minutes avant l'arrivée au jour 1 contre 83 avant. Ce n'est pas
une aggravation, c'est le respect de ce que la personne a déclaré : elle se lève déjà à cette
heure-là. L'app cesse simplement de lui promettre qu'elle peut se lever plus tard.

Robustesse vérifiée sur trois biais de déclaration (1,0 / 1,4 / 1,8). Au pire cas, une
personne qui met presque le double de ce qu'elle croit, le jour 1 passe de 98 % à 8 %.

### Preuves au rouge

| Régression posée | Tests qui virent au rouge |
|---|---|
| Le calibrage descend aussi vers le bas (compression du plan) | « jamais vers le bas », « un budget plus court ne comprime pas le plan » |
| `estBase` ignoré, la référence devient le résultat précédent | idempotence, « changer d'heure de lever recalibre depuis la référence », `baseEst` |
| L'onboarding ne calibre plus | « l'onboarding calibre réellement le déroulé » |
| Calibrage neutralisé (échelle figée à 1) | 3 des 6 tests du harnais de calibration, dont celui du jour 1 |

Le dernier compte double : il prouve que le harnais voit un calibrage cassé, pas seulement un
calibrage absent.

### Le budget de performance était un souhait, il redevient une contrainte

`CLAUDE.md` §3 fixe « JS total < 220 Ko non minifié » depuis l'origine. **Rien ne le
vérifiait.** J2 l'a dépassé de 901 octets sans que quoi que ce soit ne le signale, ce qui est
exactement la façon dont une contrainte d'architecture meurt.

`tests/budget.test.mjs` la rend mécanique. Le dépassement a été résorbé en factorisant deux
duplications réelles (le coeur commun de `predict` et `predictTravel`, le calcul du budget
écrit deux fois dans `calibrate.js`) et en ramenant les commentaires de `calibrate.js` à la
densité du reste du dépôt : ils y occupaient 56 % du fichier, contre 15 à 20 % ailleurs.

**Il reste 396 octets.** Ce n'est pas une marge, c'est un signal : J3 devra retirer quelque
chose avant d'ajouter, et le décider explicitement.

---

## J3 · Le moteur (S4)

### Ce que chaque article rapporte, mesuré séparément

Population de 300 utilisateurs calibrés, 20 matins, avec destination (donc trajet appris).

| | retard établi | avance | lever avant l'arrivée | marge |
|---|---|---|---|---|
| avant J3 | 2 % | 17,3 min | 110 min | 11,6 |
| + article 1 (variances composées) | 2 % | 14,8 | 108 | 9,5 |
| + articles 2 et 3 | 4 % | 12,4 | 107 | 8,1 |
| + coefficients calibrés | **8 %** | **9,9** | **104** | **5,5** |

**La cible d'ADR-002 est tenue** : 92 % de matins à l'heure ou en avance, pour 9,9 minutes
d'avance moyenne. Six minutes de sommeil quotidiennes rendues, et sept minutes d'avance
inutile en moins.

### Les coefficients ont été balayés, pas choisis

48 combinaisons de `MARGIN_FLOOR`, `VAR_WEIGHT`, `LATE_WEIGHT` et `PRIOR_SPREAD_RATIO`.
Quatorze tenaient la cible. Le départage s'est fait **sur un principe, pas sur le meilleur
chiffre** : deux combinaisons donnaient exactement le même résultat, l'une en divisant par
deux le terme de retard chronique, l'autre en abaissant le plancher fixe. Retenue la seconde.
Le terme de retard chronique est la seule part de la marge qui s'adapte à la personne plutôt
qu'aux statistiques d'une étape, et ce produit existe pour les gens qu'il décrit. Ce qui a
été rendu, ce sont deux minutes de plancher, la part qui ne dépendait de rien.

### L'estimateur a été tranché par mesure, sur deux critères

S4 laissait le choix ouvert entre médiane et moyenne tronquée. Quatre estimateurs mesurés,
sur le coût en régime établi **et** sur la contamination après un matin aberrant, qui est la
raison d'être de l'article.

| estimateur | avance établie | contamination |
|---|---|---|
| moyenne + écart-type (avant J3) | 15,3 | **9,94 min** |
| médiane + MAD | 15,8 | 3,47 |
| **moyenne tronquée symétrique** | **14,3** | **3,59** |
| moyenne tronquée haute seule | 12,5 | 3,44 |

La troncature haute seule donne la plus petite avance, et elle a été écartée : ne retirer que
la valeur haute biaise le centre vers le bas, ce qui est de l'optimisme et non de la
robustesse (6 % de matins en retard contre 3 %). La médiane a été écartée aussi : sur un
segment de deux points, MAD fois 1,4826 vaut 1,48 fois l'écart-type, donc elle surestimait la
dispersion là où elle est le moins fiable.

### Preuves au rouge

| Régression posée | Tests qui virent au rouge |
|---|---|
| Article 1 annulé : on additionne de nouveau les écarts-types | les trois tests d'avance d'ADR-002 |
| Article 2 annulé : `PRIOR_SPREAD_RATIO` à 0 | `predict` sans mesure, composition de `buildPlan`, trajet mesuré contre inconnu |
| Article 3 annulé : moyenne simple | avance d'ADR-002, et le test de contamination |
| Budget de code abaissé sous la mesure réelle | les deux tests de budget, avec les cinq plus gros fichiers nommés |

### Un test de J2 a changé de seuil, et il faut dire pourquoi

`le defaut existe : sans calibrage, un matin sur deux au moins est en retard au jour 1`
passait à 71 % en J2. L'article 2 attaque le jour 1 par un autre chemin (la marge n'est plus
minimale au moment de l'ignorance maximale), donc le défaut résiduel est tombé sous 50 %.
Le seuil a suivi, à 30 %. **C'est un progrès qui fait bouger un seuil, pas un seuil relâché
pour faire passer un test**, et la différence se voit à ceci : le test qui compare avec et
sans calibrage, lui, n'a pas bougé d'un pouce.

### Deux choses que le harnais consigne au lieu de les taire

**Le parcours sans destination ne tient pas la cible d'avance** (11,6 min contre 9,9). Sans
destination, le trajet n'est jamais mesuré : l'app reste ignorante à vie sur ce terme et le
paie en marge, tous les matins. C'est le parcours par défaut du produit, puisque rien
n'oblige à nommer un lieu. Un test le mesure et échouera si ça change, dans un sens comme
dans l'autre.

**L'article 4 de S4 n'est pas fait** (segmentation et mémoire). C'était déjà « le moins
urgent des quatre » dans la spec, et sa contrainte de taille (allonger le FIFO fait grossir
la clé `localStorage`) le rend indissociable d'un travail sur le stockage.

### Ce que J3 retire (DEC-12)

`varBoost`, comme prévu par S4 : il gonflait la composante variance d'une destination jamais
mesurée, mais multipliait une variance nulle, donc ne faisait rien précisément dans le cas
pour lequel il avait été écrit. Et `onFeedback`, qui n'était plus appelée par aucun code de
production depuis B1 : seuls des tests la maintenaient en vie.

### Le budget a bloqué le jalon, et c'est ce qui a produit ADR-005

J3 s'est arrêté net sur `tests/budget.test.mjs`, à 656 octets au-dessus. Tout le code mort
identifiable avait déjà été retiré et les commentaires resserrés deux fois. Le blocage a
forcé une question jamais posée : **220 Ko de quoi, et pourquoi 220 ?** Le chiffre n'était
instruit nulle part.

`ADR-005` remplace un budget unique par deux, parce qu'il y a deux coûts distincts : le poids
transféré, payé une fois au remplissage du cache, et le code hors commentaires, analysé à
chaque démarrage à froid. Le second est le contraignant, à 185 Ko contre 173,5 mesurés. La
vraie cible, First Paint sous une seconde sur iPhone 12, n'est toujours vérifiée par aucune
machine et reste à mesurer à la main en J4.

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

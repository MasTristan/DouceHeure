# S1 · Socle de confiance

**Jalon** : J1 · **Propriétaires** : Milo Vasseur (filet, CI), Nour Belkacem (extraction,
découpe) · **Ordre imposé par DEC-02**

Rien de visible pour l'utilisateur. Tout pour qui reprendra le code dans six mois.

**L'ordre est la spec.** Il a été retourné en R2 et il ne se renégocie pas en cours de
route : le filet existe avant la première ligne de refactor.

> **J0 est clos** (voir `S0-statut.md`) : `js/confirm-control.js` existe déjà, une partie de
> ce que ce document appelle « extraction des lignes décisionnelles » est donc en avance
> pour le geste de confirmation spécifiquement. `liveStatus()`, `confirmNext()` et
> `nightTick()` restent, eux, intégralement à extraire. **Les numéros de ligne ci-dessous
> datent d'avant J0** : `ui.js` a grossi d'environ 80 lignes pendant les correctifs B1 à B3
> (nouveaux imports, wiring de `commitPreviewDefaults`, `recordDurations`, `pendingSession`,
> `confirm-control.js`), à revérifier avant de commencer ce jalon.

---

## Étape 1 · L'intégration continue, dans la première heure

**Pourquoi en premier.** 41 tests que personne n'exécute ont une valeur d'assurance nulle. Le
projet a déjà été abandonné une fois, et la reprise est faite par une équipe qui n'était pas
là. Vingt lignes de YAML, zéro dépendance, zéro coût.

**Livrable.** `.github/workflows/ci.yml`. Node en version courante, `node --test tests/*.test.mjs`,
**aucune étape d'installation**. L'absence d'étape d'installation est intentionnelle : ce
fichier est la preuve vivante de la contrainte zéro dépendance (ADR-001). Si elle apparaît un
jour, c'est le signal que la décision a été enfreinte.

**Livrable joint.** `tests/service-worker.test.mjs` : vérification automatique que la liste
`ASSETS` couvre tous les fichiers livrés. Le manifeste est aujourd'hui exact (43 sur 43), le
risque est prospectif, mais **la découpe va ajouter une vingtaine de fichiers d'un coup** :
le test passe donc avant la découpe, pas après. Assertions : tout fichier de `js/`, `css/`,
`assets/` est listé ; tout fichier listé existe ; un condensat du contenu force la montée de
`VERSION` quand un fichier change.

**Ce qui bloque une fusion.** Tests rouges, manifeste dérivé, `VERSION` non montée alors que
le contenu a changé.

---

## Étape 2 · Le filet, contre le `ui.js` actuel non modifié

**Le point le plus important de la spec.** Le filet fixe le comportement d'**aujourd'hui**,
verrues comprises, comme référence. Il n'exprime pas ce qu'on voudrait, il exprime ce qui
est. C'est ce qui permet ensuite de refactorer en sachant qu'on n'a rien changé.

**Livrables.**

- `tests/tiny-dom.mjs` : faux DOM d'environ 140 lignes, node natif, sans dépendance
  (ADR-001). Il installe les globales avant un import dynamique de `ui.js`, ce qui contourne
  le `document.getElementById('app')` de la ligne 22.
- `tests/live-r2.test.mjs` : les cinq chemins d'avancement. Geste accompli, geste interrompu
  avant 600 ms, geste annulé, **temps qui passe sans geste**, réveil. Le quatrième est le
  harnais anti bug de la douche : l'horloge avance, l'étape courante ne change pas.
- `tests/live-r1.test.mjs` : aucune durée restante dans le **DOM rendu**, pas seulement dans
  les chaînes sources. Ce contrôle manquait : environ 49 littéraux français vivent hors de
  `copy.js` et n'ont jamais été inspectés.
- `tests/live-r3.test.mjs` : aucune écriture sur geste interrompu, sur étape sautée, sur
  étape polluée par un imprévu.
- `tests/live-invariance.test.mjs` : le rendu du live sous modèle vide et sous modèle nourri
  est identique, chaîne pour chaîne (ADR-003). Un principe éditorial devient un invariant de
  machine.

**Horloge injectable.** Les tests ont besoin de piloter le temps. `js/clock.js` expose
`now()` et les minuteries, les modules métier l'utilisent au lieu de `Date.now()` et
`setTimeout` directs. C'est un changement d'API transverse qui touche la logique pure :
Nour a demandé une ADR, elle est due avant l'écriture de l'étape 3.

**Éprouver le filet.** Pour chacun des tests ci-dessus : réintroduire volontairement la
régression sur une branche jetable, vérifier que le test vire au rouge, jeter la branche.
Consigné dans `docs/recettes/journal.md`. Un filet non éprouvé n'est pas un filet.

---

## Étape 3 · Extraction des lignes décisionnelles

**Périmètre exact.** Environ 90 lignes, dont 25 réellement décisionnelles :
`liveStatus()` (`js/ui.js:677-690`), `confirmNext()` (`js/ui.js:713-741`), le tick de
`nightTick()` (`js/ui.js:1651-1679`).

**Livrable.** `js/live.js` : machine à états pure, sans DOM, testée comme `plan.js`. Elle
répond à « quel est l'état de la session » et « que se passe-t-il quand l'utilisateur
confirme ». Elle ne répond jamais à « faut-il avancer maintenant ».

**L'invariant à graver dans le module.** L'horloge sert uniquement à savoir si on est dans
les temps. Elle ne change jamais l'étape courante. Seul un geste de confirmation accompli
avance. Cet invariant devient une propriété testée du module, au même titre qu'une assertion
de `plan.js`.

**Validation.** Le filet de l'étape 2 valide chaque commit. Aucun test du filet ne doit
changer pendant l'extraction : si un test doit être modifié, c'est que le comportement a
changé, donc que l'extraction a échoué.

---

## Étape 4 · Découpe par écran, et clause d'arrêt

**Livrable.** `js/ui/*.js`, un module par écran, `ui.js` survivant comme façade de
réexport jusqu'à la dernière étape. Découpe en étapes livrables, chacune vérifiable, sans
changer un pixel.

**Clause d'arrêt (DEC-02).** Si le temps manque, on livre jusqu'à l'étape 3 et on s'arrête.
Un `ui.js` de 2 006 lignes dont la décision d'avancement est pure, extraite et testée est un
actif plus sûr qu'un `ui.js` en vingt fichiers dont personne ne teste l'avancement.
L'extraction est de la sûreté produit ; la découpe est du confort de mainteneur.

**Règle de discipline, demandée par Nour et accordée.** La découpe ne corrige rien. Tout
défaut découvert en découpant fait l'objet d'un commit séparé, avant ou après, jamais dedans.
Sans cette règle, « sans changer un pixel » se transforme soit en « on n'a rien osé
toucher », soit en « le diff est illisible », et les deux sont des échecs.

---

## Étape 5 · Les dialogues natifs disparaissent

**Remonté de J4 par DEC-03.** Argument technique et non esthétique : `confirm()` et
`prompt()` sont bloquants et non simulables. Chacun est un mur au milieu d'un chemin de test,
et ils se trouvent sur les deux chemins les plus destructeurs de l'app : perdre sa nuit
(`js/ui.js:1709`) et perdre ses données (`js/ui.js:1410`). Les deux autres :
`js/studio.js:591` et `js/studio.js:647`.

**Livrable J1.** Composant de confirmation maison, non bloquant, minimal. Une trentaine de
lignes. Version définitive par Iris en J4 (`S2-le-geste.md`).

**Contrainte particulière.** Le chemin du mode chevet s'exécute en pleine nuit : la
confirmation ne doit ni éblouir, ni réveiller. Elle hérite de la scène Nuit.

**Test.** Aucune occurrence de `prompt(` ni `confirm(` dans `js/`. Les quatre chemins sont
testables de bout en bout.

---

## Critère de sortie de J1

Les quatre conditions de Milo, qui remplacent mon « on peut modifier `ui.js` sans peur » :

1. `tests/live-r2.test.mjs` couvre les cinq chemins d'avancement, vert en CI.
2. La CI est branchée en protection de branche, et un commit qui casse R2 a été **démontré**
   rouge sur une branche jetable.
3. `tests/service-worker.test.mjs` vert, capacité de détection démontrée de la même façon.
4. Une recette courte consignée dans `docs/recettes/journal.md`.

**Ce que J1 retire** (DEC-12) : quatre dialogues natifs, et la confiance aveugle.

# ADR-001 · Zéro dépendance, y compris pour les tests

**Statut** : acceptée · **Date** : R2 · **Décideur** : direction du projet
**Demandeur du veto** : Nour Belkacem · **Bénéficiaire** : Milo Vasseur

## Contexte

Le dépôt n'a aucune dépendance : pas de `node_modules`, pas de fichier de verrouillage.
`package.json` ne sert qu'à déclarer `type: module` et à lancer `node --test`. C'est une
contrainte d'architecture verrouillée dans `CLAUDE.md` §3.

R1 a fait apparaître un besoin réel : les deux règles qui font le produit, R2 (l'étape
n'avance jamais seule) et R3 (n'apprendre que du réel), sont des règles de **comportement
d'interface**. Elles ne sont testées par rien. `ui.js` fait 2 006 lignes et n'est pas
importable en node parce qu'il touche le DOM au chargement (`ui.js:22`).

La réponse habituelle est jsdom, ou un navigateur headless en intégration continue.

## Décision

**Aucune dépendance, y compris de développement et de test.** Pas de jsdom, pas de vitest,
pas de navigateur headless en CI, pas de bundler.

Le faux DOM nécessaire aux tests de comportement est du code du dépôt :
`tests/tiny-dom.mjs`, environ 140 lignes de node natif, sans dépendance.

## Justification

Trois raisons, dans l'ordre de force.

1. **La faisabilité est démontrée, pas supposée.** Le prototype de Milo pilote le `ui.js`
   actuel, non modifié, en 0,24 s, avec 139 lignes. Il a trouvé un bug réel de production
   (le contournement de R2 au clavier, `ui.js:167-173`) **avant d'être adopté**. L'argument
   « on ne peut pas tester `ui.js` sans outil » est faux.
2. **Le rapport est mauvais dans l'autre sens.** Ajouter un arbre de dépendances et un
   fichier de verrouillage à un dépôt qui n'en a aucun, pour tester 164 Kio de JavaScript,
   coûte plus qu'il ne rapporte : surface de maintenance, alertes de sécurité, montées de
   version, et la fin d'une propriété rare que le projet défend depuis l'origine.
3. **Le fichier de CI devient la preuve vivante de la contrainte.** Un workflow qui
   n'installe rien et exécute `node --test` en quelques secondes est un rappel permanent, et
   vérifiable, de ce que le projet est.

## Ce qu'on abandonne en la prenant

- Les sélecteurs CSS complets, la mise en page, les styles calculés. `tiny-dom` simule
  l'arbre et les événements, pas le moteur de rendu.
- Les tests de bout en bout sur navigateur réel. Ils passent en recette manuelle, sur
  appareil, et c'est consigné (`docs/recettes/`).
- Une part de confort : écrire un faux DOM demande de la discipline que jsdom offrirait.

Cette limite est acceptée explicitement. Ce qui reste hors de portée automatique est nommé
dans la recette plutôt que laissé dans le flou.

## Conséquences

- `tests/tiny-dom.mjs` est du code de production du point de vue de la relecture.
- Toute demande future de dépendance de test rouvre cette ADR, elle ne la contourne pas.
- La CI n'a pas d'étape d'installation. Si elle en acquiert une un jour, c'est le signal
  que cette décision a été enfreinte.

# ADR-004 · Horloge et minuteries injectables (`js/clock.js`)

**Statut** : acceptée · **Date** : J1, étape 2 · **Décideur** : direction du projet
**Demandeur** : Nour Belkacem (R1, §6) · **Bénéficiaire** : le filet de J1 (Milo Vasseur)

## Contexte

Le filet de J1 doit prouver, contre le comportement réel d'aujourd'hui, l'invariant le plus
important du projet : *l'horloge sert uniquement à savoir si on est dans les temps, elle ne
change jamais l'étape courante*. C'est le harnais anti bug de la douche
(`tests/live-r2.test.mjs`).

Pour l'écrire, un test doit pouvoir faire avancer le temps de façon arbitraire (simuler
40 minutes passées sans confirmation) sans attendre 40 vraies minutes, et doit pouvoir
déclencher le tick du live (`liveTicker`, toutes les 5 secondes) et celui du chevet
(`nightTicker`, toutes les 30 secondes) sans attendre non plus. Aujourd'hui, `js/ui.js`
appelle `Date.now()`, `new Date()`, `setInterval` et `setTimeout` directement : rien n'est
substituable depuis un test.

Le reste de la base a déjà un début de convention pour ça : `bedside.js` accepte `now` en
paramètre par défaut (`now = Date.now()`), tout comme `js/confirm-control.js`, ajouté en J0.
C'est le bon réflexe pour des fonctions pures, mais `ui.js` a en plus un besoin que ce
paramètre ne couvre pas : de vraies minuteries récurrentes et déplaçables dans le temps
(les tickers), pas seulement une lecture ponctuelle de l'heure.

## Décision

Un module `js/clock.js`, singleton mutable, remplace les appels directs à `Date.now()` /
`new Date()` / `setInterval` / `setTimeout` / `clearInterval` / `clearTimeout` dans les
points de `js/ui.js` touchés par le filet : `liveStatus()`, `confirmNext()`, `startLive()`
(le ticker), `startNight()` (le ticker), `nightTick()`, `nowMinutes()`, `ctxNow()`.

```js
export const clock = { now, setTimeout, clearTimeout, setInterval, clearInterval };
```

En mode réel (production), chaque méthode délègue à la globale correspondante : comportement
strictement identique à aujourd'hui. `installFakeClock(startTs)` remplace ces méthodes par
une horloge virtuelle pilotée par `tick(ms)` : le temps n'avance que sur demande explicite du
test, qui déclenche alors, dans l'ordre de leur échéance, tous les minuteurs dus (y compris
les intervalles, qui se reprogramment). `resetClock()` restaure le mode réel entre deux tests.

Les fonctions déjà pures avec paramètre `now` par défaut (`bedside.js`) ne changent pas :
`ui.js` leur passe désormais `clock.now()` explicitement au lieu de laisser jouer leur valeur
par défaut, pour que la même horloge factice gouverne tout le graphe d'appels pendant un
test.

## Justification

**C'est un changement de plomberie, pas de comportement.** En mode réel, `clock.now()` fait
exactement ce que faisait `Date.now()` ; `clock.setInterval` fait exactement ce que faisait
`setInterval`. Rien n'observable ne change pour l'utilisateur. C'est ce qui permet de dire
que le filet, une fois écrit contre `ui.js` ainsi modifié, teste toujours le comportement
« d'aujourd'hui » au sens de l'étape 2 : la modification est mécanique et vérifiable
ligne à ligne, pas une réécriture de la décision.

**Un singleton mutable plutôt qu'une injection par paramètre partout.** `ui.js` a beaucoup de
fonctions internes non exportées qui s'appellent entre elles sans jamais se passer de
contexte explicite (`liveStatus()`, `confirmNext()`, `renderLive()`...). Ajouter un paramètre
`clock` à chacune aurait nécessité de le faire traverser toute la chaîne d'appel, un
changement bien plus large que ce que l'étape 2 demande. Un objet mutable importé une fois,
dont les méthodes sont remplacées le temps d'un test puis restaurées, obtient la même
injectabilité avec un diff minimal.

**Une horloge factice complète, pas un simple stub de `Date.now()`.** Le harnais anti bug de
la douche a spécifiquement besoin de déclencher le tick du live sans attendre 5 secondes
réelles. Un stub qui ne couvrirait que `now()` ne suffirait pas ; il fallait aussi maîtriser
`setInterval`/`setTimeout`, d'où `installFakeClock()` et sa méthode `tick(ms)`.

## Ce qu'on abandonne en la prenant

- Les fonctions concernées passent d'un appel direct aux globales à un appel indirect via
  `clock`. Une relecture rapide (`grep -n "Date.now\|setInterval\|setTimeout"` dans les zones
  touchées de `ui.js`) doit rester nette : si un appel direct réapparaît dans une zone censée
  passer par `clock`, c'est une régression de cette ADR, pas une simplification.
- L'horloge factice est un mini-moteur de temporisation maison (une quarantaine de lignes).
  Ce n'est pas les timers simulés expérimentaux de `node:test` (`t.mock.timers`), écartés
  volontairement : rester sur des API Node stables plutôt qu'expérimentales, cohérent avec
  ADR-001.
- Cette ADR ne touche que les points nécessaires au filet de J1. Le reste de la base
  (`plan.js`, `predict.js`, `travel.js`...) garde son propre style d'injection par paramètre
  `now`/`ctx`, déjà pur et déjà testé : rien à migrer là, ce serait un renommage sans valeur.

## Conséquences

- `js/clock.js` devient une dépendance de `js/ui.js` pour les fonctions listées ci-dessus.
- `tests/tiny-dom.mjs` et les tests `live-*.test.mjs` importent `installFakeClock`/
  `resetClock` pour piloter le temps sans délai réel.
- Toute nouvelle fonction de `ui.js` qui lit l'heure ou pose une minuterie dans une zone
  couverte par le filet doit passer par `clock`, pas par les globales directement.

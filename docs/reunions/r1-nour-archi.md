# R1 · Architecture front et performance iOS

**Nour Belkacem** · responsable Architecture front et performance iOS
Document de prise de poste. Périmètre : jalon J1 « Socle de confiance ».
Base de lecture : `CLAUDE.md` intégral, `docs/00-vision.md`, `js/ui.js` (2 006 l.),
`js/studio.js` (728 l.), `js/app.js`, `service-worker.js`, `index.html`,
`js/wakelock.js`, `js/scene.js`, `js/audio.js`, `js/speech.js`, `js/store.js`,
`js/plan.js`, `js/bedside.js`, les 7 fichiers de `tests/`.

État vérifié à la prise de poste : `node --test tests/*.test.mjs` passe, **41/41**.
`ASSETS` du service worker : **43 entrées, 43 fichiers réels, aucun manquant, aucun fantôme**
(vérifié par script). Le problème du manifeste est donc **prospectif**, pas actuel. Ça change
son traitement : il faut le verrouiller **avant** la découpe, pas après, parce que la découpe
va ajouter une vingtaine de fichiers d'un coup.

Aucun fichier produit n'a été modifié. Ce document est mon seul livrable.

---

## 0. Ce que j'ai trouvé qui n'est pas dans la vision

Quatre défauts concrets, tous hors de la liste des six menaces du document de vision, tous
en moins de 40 lignes de correctif cumulé. Je les pose ici parce qu'ils arbitrent la suite.

| # | Fichier | Défaut | Symptôme utilisateur |
|---|---------|--------|----------------------|
| D1 | `js/wakelock.js` l.23-30 | `bindVisibility()` pose un écouteur permanent que `release()` ne retire jamais | **L'écran ne s'éteint plus jamais**, sur tous les écrans, après la première session |
| D2 | `js/store.js` l.213-215 | `saveState()` sans `try/catch` | Un `QuotaExceededError` lève au milieu d'un `confirmNext()` et casse le matin en cours |
| D3 | `js/store.js` (modèle) | `history` sans FIFO, alors que `real` (max 8) et `destinations` (max 8) en ont un | Croissance non bornée de la clé localStorage, alimente D2 |
| D4 | `service-worker.js` l.83 | `.catch(() => cached)` où `cached` vaut `undefined` par construction | Écran blanc hors-ligne si une ressource manque au cache |

D1 mérite un paragraphe. `release()` (l.16-21) met `lock = null`, mais l'écouteur posé par
`bindVisibility()` (l.24-30) reste et fait `if (visible && !lock) acquire()`. Donc après **une**
session live ou **une** nuit de chevet, chaque retour au premier plan réacquiert un verrou
d'écran, y compris sur l'écran d'accueil, pour le reste de la vie de la page. Probabilité :
certaine, dès le deuxième usage. Sur une app dont le pacte explicite est « L'écran restera
allumé pendant le guidage » (`copy.js` l.221), livrer une fuite de verrou c'est trahir la seule
contrepartie qu'on ait demandée à l'utilisateur. Correctif : un drapeau `wanted` que `release()`
remet à `false` et que le handler consulte. Cinq lignes.

---

## 1. Plan de découpe de `js/ui.js`

### 1.1 Cartographie réelle du fichier

Mesurée section par section (`sed` + `wc -c`), pas estimée :

| Section | Lignes | Octets | Nature |
|---|---|---|---|
| imports + état de module | 1-34 | 1 521 | **état partagé** |
| helpers DOM + `holdButton` | 35-176 | 4 436 | socle, **état partagé** (`holdActive`) |
| `showOnboarding` | 177-337 | 6 169 | écran plat |
| `showHome` / `showHomeFresh` | 338-497 | 5 569 | écran plat |
| `showPreview` | 498-627 | 5 416 | écran plat |
| logique live | 628-790 | 5 082 | **noyau critique R1/R2/R3** |
| tiroir de séquence | 787-870 | 3 210 | **état partagé** (`drawerNode`) |
| rendu live | 871-986 | 4 697 | rendu, lit `holdActive` |
| départ + fin de session | 987-1137 | 5 437 | rendu + orchestration |
| trajet, feedback, carte | 1138-1258 | 4 330 | écrans plats |
| `showMornings` | 1259-1366 | 4 536 | rendu **+ calcul métier** (l.1292-1314) |
| `showSettings` | 1367-1552 | 8 157 | écran plat |
| mode chevet | 1553-1820 | 9 262 | **noyau critique** + rendu |
| `showSocial` | 1821-2006 | 7 161 | écran plat |

Deux enseignements. D'abord, **le risque n'est pas réparti** : sur 2 006 lignes, la décision qui
peut ressusciter le bug de la douche tient dans trois blocs, `liveStatus()` l.677-690,
`confirmNext()` l.713-741 et `nightTick()` l.1651-1679. Environ **90 lignes sur 2 006**, dont
25 réellement décisionnelles. Ensuite, `showMornings` l.1292-1314 fait du calcul de moyenne par
jour **dans la couche de rendu**, ce qui viole déjà la séparation stricte de `CLAUDE.md` §4.

### 1.2 L'état partagé actuel, nommément

Sept variables de module, plus trois dans `studio.js`. Il n'y en a pas une seule qui exige un
framework ou un bus.

| Variable | Déclaration | Écrivains | Lecteurs | Traitement proposé |
|---|---|---|---|---|
| `root` | l.22 | aucun | `render()` seul | privé de `ui/shell.js` |
| `currentScreen` | l.33 | `render()` l.98, `showHomeFresh()` l.494, `renderNight()` l.1738, `renderWakeProposal()` l.1775 | `render()` l.96, `showSettings()` l.1548 | privé de `ui/shell.js`, exposé par `render(node, key)` + `resetScreen()` + `isScreen(key)` |
| `holdActive` | l.123 | `holdButton()` l.143/152/159 | `renderLive()` l.875 | privé de `ui/gesture.js`, exposé par `isHoldActive()` |
| `drawerNode` | l.789 | `openDrawer()` l.863, `closeDrawer()` l.792 | `pauseLive()` l.773, `stopLiveSession()` l.1110 | privé de `live/drawer.js`, exposé par `openDrawer(session)` / `closeDrawer()` |
| `live` | l.25 | `startLive()` l.633, `confirmNext()`, `applyRescue()`, `pauseLive()`, `resumeLive()`, `renderLeave()` l.1005, `buildLeaveContacts()` l.1054, `stopLiveSession()` l.1114 | ~15 fonctions | **objet de session passé en paramètre**, détenu par `live/controller.js` |
| `liveTicker` | l.26 | `startLive()` l.663, `stopLiveSession()` l.1108 | idem | privé de `live/controller.js` |
| `night` | l.29 | `startNight()`, `stopNight()`, `nightTick()`, `startRinging()`, les 3 rendus nuit | ~8 fonctions | **objet passé en paramètre**, détenu par `night/controller.js` |
| `nightTicker` | l.30 | `startNight()` l.1635, `stopNight()` l.1639 | idem | privé de `night/controller.js` |
| `studioState`, `studioActiveId` | `studio.js` l.33-34 | `showStudio()`, `renderStudio()` | tout `studio.js` | inchangé pour J1, déjà encapsulé dans un seul fichier |
| `drag` | `studio.js` l.72 | `initDrag()` | idem | inchangé |

**La règle unique que j'applique, et elle suffit** : une variable de module partagée entre deux
futurs fichiers est soit *privatisée derrière une fonction* (cas de `root`, `currentScreen`,
`holdActive`, `drawerNode`, les deux tickers), soit *transformée en paramètre explicite* (cas de
`live` et `night`). Aucune troisième catégorie.

Ça marche parce que le graphe de `live` est un arbre, pas un maillage : **un seul écrivain**
(le contrôleur, réveillé par une confirmation ou par un tick), et des lecteurs qui reçoivent
l'objet en argument. Un bus d'événements ne servirait qu'à rendre implicite un ordre
d'exécution qui est aujourd'hui explicite et lisible. Je m'y oppose.

### 1.3 Le seul mécanisme nouveau : `js/ui/nav.js`

Le vrai couplage restant, c'est la navigation. Aujourd'hui les écrans s'appellent en croix
(home → preview → live → trip → feedback → card → mornings → home ; settings → social →
settings ; goodmorning → preview ; studio → home). Dans un seul fichier, ça ne se voit pas.
Découpé, ça donne un cycle d'imports ES. Le code contourne déjà le problème une fois :
`studio.js` l.718 fait `import('./ui.js').then(m => m.showHome())` pour casser le cycle
`ui → studio → ui`.

Je propose **un registre de navigation, pas un bus** :

```js
// js/ui/nav.js  (environ 25 lignes)
export const nav = {};
export function registerScreens(map) { Object.assign(nav, map); }
```

`app.js` le remplit une fois au démarrage. Les écrans importent `nav` et appellent `nav.home()`.
Zéro abonnement, zéro diffusion, zéro ordre implicite : une table de fonctions, statiquement
lisible, dont on peut lister les clés dans un test.

**Ce que je rejette explicitement** : généraliser l'`import()` dynamique de `studio.js` l.718 à
tous les écrans. C'est la solution que tout le monde propose et elle est mauvaise ici. Elle
reporte le coût de parse au moment du tap, et sur un iPhone en Low Power Mode à 6 h 45 elle
introduit une latence au pire moment du produit. `js/` fait 164 Kio non minifiés : tout charger
d'un coup est parfaitement tenable. Au passage, la suppression de ce `import()` dynamique
supprime aussi le seul chemin où le service worker peut servir une version mélangée (cf. §2.3).

### 1.4 Arbre cible

```
js/
  clock.js            # now(), nowMin(), setClock() reserve aux tests      ~15 l.
  learned.js          # phrases apprises, PUR (extrait de ui.js 1292-1314) ~40 l.
  contacts.js         # ex-social.js, renomme (liens sms/mailto)
  ui/
    dom.js            # el, toast, announce, wordmark, topbar, settingRow  ~2,0 Ko
    shell.js          # root, currentScreen, render, resetScreen, applySettings
    gesture.js        # holdButton, isHoldActive
    nav.js            # registre de navigation
  screens/
    onboarding.js  home.js  preview.js  trip.js  feedback.js
    mornings.js    settings.js  social.js
  live/
    session.js        # createSession, stepStatus, slipOf  -> PUR, teste
    controller.js     # startLive, confirmNext, pause/resume, rescue, ticker, fin
    view.js           # renderLive, renderPause
    leave.js          # renderLeave, buildLeaveContacts, departNow
    drawer.js         # openDrawer, closeDrawer
  night/
    controller.js     # startNight, stopNight, nightTick, startRinging
    view.js           # renderNight, renderWakeProposal, renderGoodMorning
    setup.js          # showBedsideSetup
```

Renommage de `js/social.js` en `js/contacts.js` : obligatoire, sinon deux `social.js` dans
l'arbre et confusion garantie à la première recherche.

Pendant toutes les étapes intermédiaires, `js/ui.js` survit comme **façade de réexport pure**.
Ça rend chaque étape livrable sans jamais toucher à `app.js` ni à `studio.js`, donc chaque
étape est un diff relisible.

### 1.5 Ordre des étapes, et pourquoi cet ordre

**Étape 0 · Le filet. Rien ne bouge tant qu'il n'est pas là.**

*0a. CI.* Le repo n'a **aucun** `.github/`. `actions/checkout` + `actions/setup-node` +
`node --test tests/*.test.mjs`. Vingt lignes de YAML, zéro dépendance, gratuit sur repo public.
C'est une heure de travail et ça change la nature du projet.

*0b. Horloge injectable.* `liveStatus()` l.679 et `nowMinutes()` l.61-64 appellent `Date.now()`
en dur. Sans horloge injectable, aucun test ne peut prouver R2 (« quarante minutes passent, rien
ne bouge »). `js/clock.js` exporte `now()`, `nowMin()` et un `setClock()` réservé aux tests.
Quinze lignes. **C'est le seul ajout d'API que je demande, et il conditionne tout le reste.**

*0c. Harnais DOM sans dépendance.* Je pose un veto sur jsdom : ajouter un `node_modules`, un
lockfile et une surface de supply chain à un repo qui n'a aujourd'hui aucune dépendance, pour
tester une app de 164 Kio, est un mauvais échange. À la place, `tests/helpers/tiny-dom.mjs`,
environ 120 lignes, implémentant **exactement** le sous-ensemble que `el()` appelle :
`createElement`, `createElementNS`, `createTextNode`, `appendChild`, `replaceChildren`,
`setAttribute`, `addEventListener`, `dispatchEvent`, `classList`, `textContent`,
`querySelector` limité aux sélecteurs `#id` et `.classe`. Si le code appelle une API absente,
le test plante bruyamment, ce qui est le comportement voulu.

*0d. Les cinq tests de non-régression, écrits sur le code monolithique actuel.*

- **T1 (R2)** : session créée, 480 ticks simulés couvrant 40 minutes de temps injecté.
  `session.current` vaut toujours 0. Aucun avancement, jamais.
- **T2 (R2)** : `pointerdown` puis `pointerup` à 599 ms. `current` inchangé, `measurements` vide.
- **T3 (R2 + R3)** : `pointerdown` puis 600 ms. `current` = 1, **exactement une** mesure.
- **T4 (R1)** : sur chaque écran rendu, aucun nœud texte ne matche `/\b\d+\s?(min|minutes?)\b/`.
  Exceptions autorisées, courtes et explicites : heures `HH:MM`, `N étapes`, sliders du Studio
  hors session. Toute nouvelle exception doit être ajoutée à la main dans le test, donc discutée.
- **T5 (R3)** : étape marquée polluée par F6, confirmation, aucune écriture.

Ces cinq tests doivent être **verts sur l'ancien code avant qu'une seule ligne bouge**. C'est
la seule façon de savoir que la découpe ne change rien.

*0e. Les quatre correctifs D1 à D4 du §0*, chacun en commit séparé, avant la découpe.

**Étape 1 · Le socle sans logique.** `ui/dom.js` + `ui/shell.js`. `ui.js` réexporte. Bénéfice
immédiat : `studio.js` l.14-29 supprime son `el()` dupliqué à l'identique et importe celui de
`dom.js`. Un doublon en moins, environ 450 octets gagnés. Vérif : 41 + 5 tests verts,
`ASSETS` mis à jour et **validé par le test du §2.4**.

**Étape 2 · Le noyau critique. C'est l'étape qui compte.** `js/clock.js` branché, puis
`liveStatus()` (l.677-690) éclaté en deux fonctions pures dans `live/session.js` :

```js
stepStatus({ durMin, elapsedMin, isLast })  // -> { suggested, nudge }
slipOf(projectedMin, plannedLeaveMin)       // -> slip replie dans [-720, 720]
```

Les seuils `elapsed >= dur` et `elapsed >= max(dur*1.6, dur+4)` (l.680-682) et le repli de
minuit (l.685-687) deviennent testables sans DOM. T1 à T3 descendent du niveau DOM au niveau
unitaire, donc ils deviennent rapides, lisibles et impossibles à contourner par accident.
**Après cette étape, le bug de la douche est verrouillé pour de bon**, et `ui.js` fait encore
2 006 lignes.

**Étape 3 · `ui/nav.js` et cassage des cycles.** `studio.js` l.718 passe de l'`import()`
dynamique à `nav.home()`. Vérif : `tests/imports.test.mjs`, environ 40 lignes, parse les
imports statiques et échoue sur tout cycle. Zéro pixel changé.

**Étape 4 · Extraction du live.** `live/controller.js`, `view.js`, `leave.js`, `drawer.js`.
`live` cesse d'être une variable de module. L'étape la plus risquée, donc placée **après** que
T1 à T5 soient verts, et validée en les relançant à l'identique.

**Étape 5 · Extraction du chevet.** `night/*`. Moins de chemins que le live, mais impossible à
tester en entier sans une nuit réelle. On extrait tel quel, et on ajoute un test de `nightTick`
sur horloge injectée : `phase === 'wake'` déclenche `startRinging()` **une fois et une seule**,
et ne touche jamais à `session.current`.

**Étape 6 · Les huit écrans plats.** Mécanique, un fichier chacun, état local déjà en closure
aujourd'hui. Extraction de `js/learned.js` (le calcul de `ui.js` l.1292-1314) avec ses tests.

**Étape 7 · Suppression de la façade.** `ui.js` disparaît, `app.js` importe directement.
`ASSETS`, `CLAUDE.md` §4 et le README sont mis à jour.

**Ce que J1 retire** (la vision impose que chaque jalon retire quelque chose) : un fichier de
2 006 lignes, un `el()` dupliqué, un `import()` dynamique de contournement, une variable globale
`holdActive`, et une fuite de Wake Lock.

### 1.6 La règle de discipline que je demande qu'on grave

**Une étape de découpe ne corrige rien.** Chaque défaut trouvé pendant l'extraction devient un
commit séparé, avant ou après, jamais dedans. Sinon le diff de découpe cesse d'être relisible
ligne à ligne, et « sans changer un pixel » devient invérifiable.

Exemple déjà repéré, qui va se présenter à l'étape 4 : `startLive()` (l.630-664) n'a aucun garde
contre un double appel. Deux taps rapides sur le CTA de l'aperçu (l.610-618) créent **deux
`setInterval`** et une session fantôme qui tourne jusqu'à la fermeture de la page. Même schéma
dans `startNight()` l.1635. Ça se corrige en trois lignes, dans son propre commit.

---

## 2. Audit du service worker et du cycle de mise à jour

### 2.1 Le manifeste manuel : le symptôme exact

Aujourd'hui `ASSETS` est juste. Voilà ce qui se passe le jour où un fichier est oublié :

`install` fait `caches.addAll(ASSETS)` (l.56). `addAll` est **atomique** : un seul 404 rejette
tout, le SW n'installe pas, l'utilisateur garde l'ancienne version. Fail-closed, c'est le bon
comportement, obtenu par accident.

Mais un fichier **oublié** ne produit aucun 404. `addAll` réussit, le SW s'installe, `activate`
supprime l'ancien cache (l.62-64). En ligne, le fichier manquant est récupéré par le réseau et
mis en cache par le handler `fetch` (l.77-81) : personne ne voit rien. **Hors ligne**, `fetch`
échoue, on tombe dans `.catch(() => cached)` l.83 où `cached` vaut `undefined` par construction
(on est dans la branche `else` de `if (cached) return cached`), `respondWith(undefined)` produit
une erreur réseau, et comme le fichier est un module ES : **écran blanc**.

Pas une dégradation, un écran blanc, chez l'utilisateur installé et hors-ligne, c'est-à-dire
exactement la personne pour qui ce produit existe. C'est le pire scénario du repo, et c'est la
raison pour laquelle le test du §2.4 passe devant la découpe.

### 2.2 Cache-first sur `index.html`

Correct pour l'offline, faux pour le cycle de vie. Avec `caches.match(req, {ignoreSearch: true})`
en tête (l.75), `index.html` est **invisible aux mises à jour** tant que `VERSION` (l.5) ne change
pas. Et `index.html` contient le sprite SVG des icônes (l.23-46) : ajouter une icône exige donc
de penser à bumper `VERSION`, geste manuel, non vérifié, dans un projet qui a déjà été abandonné
une fois.

Le SW lui-même échappe à son propre handler : le navigateur le recharge via le cache HTTP, plafonné
à 24 h. Sur GitHub Pages (`Cache-Control: max-age=600`), une mise à jour du SW est donc découverte
dans les dix minutes suivant une navigation. Ce maillon-là fonctionne.

**Proposition** : network-first avec repli cache **pour les navigations uniquement**
(`req.mode === 'navigate'`), cache-first pour tout le reste. Avec un `Promise.race` contre un
timeout de 1,5 s, parce que le cas d'usage réel de cette app c'est le métro, où le réseau est
capté mais mort, pas absent. Coût : une requête par lancement, annulée en 1,5 s au pire.
Bénéfice : suppression d'une classe entière de bugs « j'ai livré et personne ne voit rien ».

### 2.3 `skipWaiting()` + `clients.claim()` pendant un live

Ce qui **ne** se passe **pas** : les modules ES déjà chargés et en cours d'exécution ne sont pas
remplacés. La session live ne crashe pas.

Ce qui se passe vraiment, et qui est pire parce que silencieux : `activate` supprime l'ancien
cache (l.62-64), donc **toute ressource chargée paresseusement après cet instant vient de la
nouvelle version**. Chemins concrets aujourd'hui : `import('./ui.js')` de `studio.js` l.718
(un `ui.js` v2 chargé dans un runtime v1), les woff2 pas encore demandés, `assets/*.png`.
Après la découpe, si on introduisait des `import()` dynamiques par écran, cette surface
exploserait, ce qui est un argument de plus contre eux.

Deuxième danger, plus vicieux : si la page est rechargée pendant la session (utilisateur ou iOS),
`live` est perdu, il n'existe **aucune persistance de session** (`ui.js` l.24 : « mémoire, pas
persisté »), et le matin s'arrête net.

Troisième point, et il touche à la marque. `copy.js` l.385 :

> `toast_update: 'Mise à jour disponible. Elle s'appliquera à la prochaine ouverture.'`

**C'est faux.** Avec `skipWaiting()` en l.57, elle s'est déjà appliquée quand le toast s'affiche.
Le document de vision fait de l'honnêteté un moteur, pas une politesse. Une chaîne qui ment sur
le comportement de la machine est un bug produit, pas un détail.

**Stratégie proposée**

1. **Retirer `skipWaiting()`** de `install`. Le nouveau SW attend que tous les clients soient
   fermés. **Corollaire gratuit et décisif** : il devient structurellement impossible qu'une mise
   à jour s'active pendant une session live ou une nuit de chevet. Une session dure quarante-cinq
   minutes, une nuit huit heures : ce sont exactement les durées pendant lesquelles une activation
   surprise est inacceptable. C'est le meilleur argument, et il est spécifique à ce produit.
2. **Retirer `clients.claim()`** de `activate` : sans `skipWaiting`, il ne sert qu'à voler des
   clients existants, ce qu'on vient d'interdire.
3. La chaîne `toast_update` redevient vraie, sans la modifier.
4. Corriger le repli mort de la l.83 : navigation → `caches.match('./index.html')`, autre →
   réponse d'erreur explicite plutôt que `undefined`.
5. Navigation en network-first avec timeout, cf. §2.2.

### 2.4 Vérification automatique du manifeste, zéro dépendance

`tests/service-worker.test.mjs`, node natif, environ 70 lignes, quatre assertions.

- **A · Couverture.** Tout fichier livrable de l'arbre (`index.html`, `manifest.webmanifest`,
  `css/**`, `js/**`, `assets/**`) figure dans `ASSETS`. Exclusions explicites et courtes :
  `tests/`, `docs/`, `.git/`, `*.md`, `package.json`, `service-worker.js` lui-même.
- **B · Pas de fantôme.** Toute entrée d'`ASSETS` existe sur le disque. Un fantôme fait rejeter
  `addAll` et **bloque toutes les mises à jour** : c'est aussi grave que l'oubli, et plus dur à
  diagnostiquer.
- **C · Fermeture du graphe d'imports.** Partir de `js/app.js`, suivre les `import ... from './x.js'`
  statiques, vérifier que chaque module atteint est dans `ASSETS`. Combiné à A, la couverture est
  double : A attrape le fichier créé et non listé, C attrape le module importé et non caché.
- **D · Version liée au contenu.** `VERSION` (l.5) doit changer dès qu'un octet d'un fichier
  d'`ASSETS` change. Implémentation : le test hache (`node:crypto`, natif) le contenu concaténé
  des fichiers d'`ASSETS` triés, et le compare à un `BUILD_HASH` inscrit en commentaire dans
  `service-worker.js`. En cas d'écart, il échoue en affichant le hash à recopier.
  Un script en lecture-écriture séparé, `tests/tools/sw-stamp.mjs` (node natif, zéro dépendance),
  fait les deux gestes automatiquement. **Ce n'est pas un bundler** : il ne produit aucun
  artefact livré, il édite deux constantes dans un fichier versionné, et le résultat est lisible
  dans le diff.

C'est le seul mécanisme qui donne ce que la vision demande : qu'un fichier ajouté et oublié
fasse échouer la CI, pas l'utilisateur.

---

## 3. Audit iOS de fiabilité longue durée

Les versions Safari citées sont à revalider sur l'appareil de recette. Aucune de mes
recommandations ne dépend d'une version précise.

| Risque | Probabilité | Symptôme utilisateur | Mitigation, sans backend ni notification |
|---|---|---|---|
| **Fuite de Wake Lock** (D1, `wakelock.js` l.23-30) | **Certaine** dès le 2e usage | L'écran ne s'éteint plus jamais, batterie qui fond en usage normal | Drapeau `wanted` remis à `false` par `release()`, consulté par le handler. **5 lignes, à faire en premier.** |
| `AudioContext` suspendu par un appel entrant pendant le réveil | Faible | **L'utilisateur ne se réveille pas.** `wake` reste non nul donc `startWake()` refuse (`audio.js` l.151), et `night.ringing` déjà vrai bloque le tick (`ui.js` l.1661, l.1677) | Sur `visibilitychange → visible`, si `night.ringing` : tenter `ctx.resume()`, sinon activer le repli lumière + vibration qui **existe déjà** (`ui.js` l.1684-1688) mais n'est jamais réévalué |
| Éviction / kill de l'app pendant la nuit | **Moyenne à élevée** sur 8 h | Réveil manqué | Déjà traité, et bien : `missedWake()` + bannière `ui.js` l.389-408 + la phrase honnête `bedside_honest2`. **Seul reproche** : fenêtre de 60 min (`bedside.js` l.8). À 70 min, plus rien. Porter à 180 : proposer de commencer 2 h après n'est pas absurde, ne rien proposer est pire |
| Gel d'onglet sans kill | Moyenne | Rien de visible | **Déjà résolu par conception** : `bedsidePhase()` travaille sur un timestamp absolu (`bedside.js` l.24-31), le premier tick après dégel calcule la bonne phase. À ajouter : un tick forcé sur `visibilitychange → visible`, sinon on attend jusqu'à 30 s après le dégel. Deux lignes |
| Throttling des timers | Certaine en arrière-plan | Aucun | Sans objet : produit explicitement « app ouverte uniquement », logique en timestamps absolus. Seul compteur relatif : `night.tickCount` de l'anti burn-in (l.1674), sans conséquence |
| Low Power Mode / chauffe en cours de session | Moyenne | Animation saccadée, chaleur | Le canvas est déjà plafonné à 12 fps (`scene.js` l.129) avec repli si le **premier** frame dépasse 20 ms (l.151-158). Manque : la dégradation **en cours de route**. Ajouter une mesure glissante, 10 frames consécutifs au-delà de 30 ms → coupure définitive pour la session. iOS n'expose aucune media query pour le LPM : la mesure observée est le seul signal |
| Burn-in OLED sur une nuit | Faible mais cumulative | Rémanence de l'horloge | Anti burn-in présent (l.1673-1675) mais **faible** : ±1 px sur 3 positions, période 60 s. Sur 8 h × N nuits, insuffisant. Passer à une dérive lente sur ±8 px, deux axes |
| `localStorage` effacé | **Élevée hors installation** | Retour à l'onboarding, **toutes les mesures apprises perdues** | Une web app ajoutée à l'écran d'accueil échappe à l'éviction 7 jours ; testée dans Safari sans installer, non. « Effacer les données de site » et la désinstallation effacent tout dans les deux cas. `navigator.storage.persist()` n'est pas accordé par Safari iOS : on peut l'appeler, on ne compte pas dessus. **Seule vraie mitigation : au septième matin, une proposition unique de sauvegarde** (`downloadExport`, F7), formulée sans peur |
| `QuotaExceededError` sur `saveState` (D2, D3) | Faible mais croissante | **Le matin en cours casse** au milieu d'une confirmation | `try/catch` dans `saveState`, plus FIFO sur `history` (aujourd'hui non bornée, alors que `real` et `destinations` le sont ; `ui.js` l.1266 n'en lit que 90) |
| F8 · Raccourci ouvrant Safari au lieu de l'app installée | Moyenne | Le raccourci ouvre un onglet vide, sans les données | Limite iOS non contournable proprement. À vérifier sur appareil et à **dire honnêtement** dans `settings_shortcuts_body`, cohérent avec la thèse de la vision |

Un mot sur la fuite de mémoire perpendiculaire : `stopNight(false)` appelé depuis
`renderGoodMorning` (l.1794) ne libère **volontairement** pas le verrou, puisqu'on enchaîne sur
l'aperçu puis le live. Correct en soi. Mais si l'utilisateur fait « Retour » depuis l'aperçu,
`showHome()` ne libère rien, et la fuite D1 prend le relais définitivement. Les deux défauts
composent.

---

## 4. Budgets et mesure

### 4.1 État mesuré

| Poste | Mesure | Budget `CLAUDE.md` §3 | Verdict |
|---|---|---|---|
| **JS total non minifié** | **167 877 o** (163,9 Kio) | < 220 Ko | **76 % consommé**, marge ~52 Ko |
| CSS total | 64 336 o (`components.css` : 46 525) | *aucun* | **trou dans les budgets** |
| Polices, disque | 421 864 o sur 14 woff2 | *aucun* | **trou**, et poste dominant |
| HTML | 5 132 o | *aucun* | correct |
| Canvas ambiant | plafond 83 ms = 12 fps (`scene.js` l.129) | 12 fps max | conforme, statiquement |
| First Paint iPhone 12 | non mesuré | < 1 s | **non mesuré, non mesurable en CI** |

Répartition du JS, les quatre premiers font 72 % du total :

```
ui.js      74 836 o   44,6 %
studio.js  24 628 o   14,7 %
copy.js    13 806 o    8,2 %
store.js    9 063 o    5,4 %
15 autres  45 544 o   27,1 %
```

### 4.2 Le vrai risque de First Paint n'est pas le JS

Le JS est chargé en `type="module"` (`index.html` l.52), donc **différé** : il ne bloque pas le
premier rendu. Ce qui le bloque, ce sont deux postes qui n'ont **aucun budget** aujourd'hui :

**Quatre feuilles CSS en série dans le `<head>`** (l.16-19), 64 336 octets bloquants. Sur une
connexion lente, quatre allers-retours sérialisés avant le premier pixel.

**Les polices.** `fonts.css` fait bien les choses : `font-display: swap` sur les 14 faces et
sous-ensembles `unicode-range`, donc seul le sous-ensemble latin est réellement téléchargé, et
Atkinson (52 Ko) ne se charge que si le mode lisible est activé. Reste que le sous-ensemble latin
de Fraunces coûte **81 800 o pour une seule graisse** (`fraunces-2.woff2`), plus 67 468 o pour
une autre. Charge de police réellement demandée au premier affichage : de l'ordre de **180 à
230 Ko**, soit **plus que tout le JavaScript du produit**.

C'est là qu'est le budget First Paint, et personne ne le surveille. Fraunces est une display
serif à axes optiques : magnifique, et hors de prix pour un titre. Je ne demande pas de la
retirer au jalon J1, je demande qu'elle **entre dans un budget chiffré** pour que la décision
soit prise consciemment plutôt que subie.

### 4.3 Tenir les budgets automatiquement, sans build

`tests/budget.test.mjs`, node natif, environ 60 lignes.

**Seuils durs, échec de la CI** :

```
js/**            <= 220 000 o    (aujourd'hui 167 877, marge 52 Ko)
css/**           <=  70 000 o    (aujourd'hui  64 336, marge  5,6 Ko)  <- a discuter
assets/fonts/**  <= 450 000 o    (aujourd'hui 421 864)
feuilles CSS bloquantes dans <head>  <= 4
```

**Seuil d'alerte à 90 %** : écriture sur stderr sans faire échouer, pour que la dérive soit
visible avant d'être bloquante. Le test imprime le top 5 par taille à chaque exécution.

**Proxys de First Paint mesurables sans navigateur** (un navigateur headless est une dépendance,
veto) :

- chaque `@font-face` porte `font-display: swap` ;
- chaque `@font-face` porte un `unicode-range` ;
- **aucune URL absolue vers un hôte tiers** dans `css/**`, `index.html` et `js/**`. Ce dernier
  point transforme la promesse « zéro requête tierce » de `CLAUDE.md` §6, aujourd'hui vérifiée à
  la main dans l'onglet réseau, en assertion automatique. C'est un des actifs les plus rares du
  projet ; il mérite mieux qu'une vérification humaine.

**Le vrai First Paint reste une mesure manuelle sur appareil réel**, une fois par jalon, notée
dans la recette. Je ne prétendrai pas l'automatiser sans navigateur. Le proxy statique attrape
les régressions grossières, il n'attrape pas les régressions de rendu.

Sur le 12 fps du canvas : l'assertion statique sur le seuil de 83 ms est faible. Ce qui rend le
budget réel, c'est la mesure glissante proposée au §3. Statique en CI, adaptatif à l'exécution.

---

## 5. Mes désaccords

### 5.1 Désaccord principal : J1 se trompe d'objet, pas de place

La vision écrit que `ui.js` « est le seul fichier où les régressions R1 et R2 peuvent naître ».
**C'est inexact, et c'est ce qui rend l'ordre proposé dangereux.**

Les régressions R1 et R2 ne naissent pas dans le rendu. Elles naissent dans `liveStatus()`
(l.677-690), `confirmNext()` (l.713-741) et le tick de `nightTick()` (l.1651-1679). Environ
90 lignes, dont **25 réellement décisionnelles**, sur 2 006. Le reste de `ui.js`, ce sont des
arbres de `el()` : mal rangé, pénible à lire, mais quasiment incapable de faire avancer une
étape toute seule.

Découper 2 006 lignes en une vingtaine de fichiers **sans avoir d'abord extrait et testé ces
25 lignes**, c'est faire la partie la plus risquée du travail avec le filet le plus mince.
L'ordre correct est : horloge injectable, extraction de la décision `suggested` / `nudge` /
`slip` en fonctions pures testées, CI, **et ensuite seulement** la découpe des écrans.

Corollaire opérationnel, et c'est ce que je veux qu'on acte : **si le temps manque, on livre les
étapes 0 à 3 et on s'arrête.** Un `ui.js` de 2 006 lignes dont les 25 lignes critiques sont
pures, extraites et testées est un actif **largement plus sûr** qu'un `ui.js` découpé en vingt
fichiers dont personne ne teste la décision d'avancement. La découpe est du confort de
mainteneur ; l'extraction est de la sûreté produit. Le document de vision les met dans le même
sac, sous le même critère de sortie (« on peut modifier `ui.js` sans peur »). Ce critère est
atteint à 80 % à la fin de l'étape 2, avant qu'un seul écran ait bougé.

### 5.2 La liste des six menaces rate le défaut le plus coûteux

La fuite de Wake Lock (D1) n'y figure pas. Elle vide la batterie de tout utilisateur ayant fait
une session, sur tous les écrans, en permanence, dès le deuxième usage. Sur une app dont le pacte
explicite est « L'écran restera allumé pendant le guidage. C'est le deal », livrer une fuite de
verrou d'écran ne se rattrape pas par un correctif au jalon J4 : c'est la contrepartie qu'on a
demandée à l'utilisateur, et on la lui prend sans le prévenir.

Ajoutés D2, D3 et D4 : quatre correctifs, moins de 40 lignes cumulées, qui valent plus pour la
rétention au jour 4 que la découpe entière. Je demande qu'ils entrent dans J1 en étape 0e.

### 5.3 La CI n'est pas la troisième priorité, c'est la première

La vision classe « aucune intégration continue » en position 3. Je la mets avant tout le reste,
y compris avant mes propres tests. Le repo n'a aucun `.github/`, le projet a déjà été abandonné
une fois, et la reprise est faite par une équipe qui n'était pas là. Une suite de 41 tests que
personne n'exécute a une valeur d'assurance de zéro. Vingt lignes de YAML, zéro dépendance, zéro
coût. Il n'existe aucun argument pour ne pas le faire dans la première heure du jalon.

### 5.4 « Sans changer un pixel » est juste, et c'est un piège qu'il faut nommer

Je signe la contrainte. Je veux qu'on nomme son effet de bord : elle interdit de corriger ce
qu'on découvre en découpant. `startLive()` sans garde de double appel (§1.6) est déjà sur ma
route. Corriger, c'est changer un comportement et casser la vérifiabilité du diff. Ne pas
corriger, c'est déplacer un bug avec cérémonie. D'où la règle du §1.6 : la découpe ne corrige
rien, chaque défaut est un commit séparé. Sans cette règle explicite, « sans changer un pixel »
se transforme en « on n'a rien osé toucher » ou en « le diff est illisible », et les deux sont
des échecs.

### 5.5 Ce que j'oppose mon veto

- **Aucune dépendance runtime, aucune dépendance de test, aucun bundler.** Y compris jsdom.
  Ajouter un `node_modules` et un lockfile à un repo qui n'en a aucun, pour tester 164 Kio,
  est un mauvais échange. Contre-proposition chiffrée au §1.5 : 120 lignes de `tiny-dom`.
- **Aucun `import()` dynamique pour la navigation entre écrans.** Latence au tap au pire moment
  du produit, et surface de mélange de versions du service worker (§2.3).
- **Aucun navigateur headless en CI.** Proxys statiques au §4.3, mesure manuelle sur appareil
  pour le reste.

Les deux seuls ajouts d'outillage que je demande sont du node natif dans `tests/`, plus
`tests/tools/sw-stamp.mjs` qui édite deux constantes. **Aucun artefact généré n'est livré.**

---

## 6. Ce que je demande pour démarrer

1. Validation de l'ordre du §1.5, en particulier du fait que **les étapes 0 à 3 passent avant
   toute découpe d'écran**, et de la possibilité de s'arrêter là si le temps manque.
2. Validation des quatre correctifs D1 à D4 en étape 0e, hors périmètre de la découpe.
3. Une ADR pour `js/clock.js` (horloge injectable) : c'est un changement d'API transverse qui
   touche la logique métier pure, et `docs/decisions/` est vide.
4. Un arbitrage sur les budgets CSS et polices du §4.3 : ce sont des seuils, ils doivent être
   discutés une fois puis subis par la CI, pas négociés à chaque livraison.
5. Un appareil de recette : un iPhone réel, avec une nuit branchée, avant la fin de l'étape 5.

---

## Résumé, dix lignes

1. `ASSETS` est aujourd'hui **exact** (43/43) et les 41 tests passent : le risque du manifeste est prospectif, mais la découpe va ajouter vingt fichiers d'un coup, donc le test de couverture passe **avant** la découpe.
2. `ui.js` se découpe en 18 modules avec **zéro framework et zéro bus** : les 7 variables partagées sont soit privatisées derrière une fonction, soit passées en paramètre. Seul ajout : `ui/nav.js`, une table de fonctions de 25 lignes.
3. La découpe se fait en 8 étapes, chacune livrable, `ui.js` survivant comme façade de réexport jusqu'à la dernière.
4. Le service worker doit **perdre `skipWaiting()`** : ça rend structurellement impossible une activation pendant un live de 45 min ou une nuit de 8 h, gratuitement.
5. `copy.js` l.385 ment : le toast promet « à la prochaine ouverture » alors que `skipWaiting()` a déjà appliqué la mise à jour.
6. Le repli l.83 du service worker est mort (`cached` y vaut toujours `undefined`) : hors-ligne, un fichier manquant donne un **écran blanc**, pas une dégradation.
7. Vérification du manifeste en 70 lignes de node natif, quatre assertions dont un hash de contenu qui force le bump de `VERSION`. Zéro dépendance.
8. JS à **167 877 o, 76 % du budget**. Mais le vrai risque de First Paint est ailleurs : 64 Ko de CSS bloquant en 4 requêtes série, et **180 à 230 Ko de polices** au premier affichage, soit plus que tout le JS. Ni l'un ni l'autre n'a de budget aujourd'hui.
9. J'ai trouvé une **fuite de Wake Lock** (`wakelock.js` l.23-30) : après une seule session, l'écran ne s'éteint plus jamais, sur tous les écrans. Certaine dès le deuxième usage, absente de la liste des six menaces.
10. **Mon désaccord principal** : J1 se trompe d'objet. R1 et R2 ne naissent pas dans le rendu mais dans 25 lignes de décision (`liveStatus`, `confirmNext`, `nightTick`). Les extraire et les tester d'abord ; découper les écrans ensuite. Si le temps manque, on s'arrête après l'extraction : c'est plus sûr qu'un `ui.js` découpé en vingt fichiers dont personne ne teste l'avancement.

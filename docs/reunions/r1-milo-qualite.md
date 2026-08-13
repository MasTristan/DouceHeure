# R1 · Qualité, fiabilité, recette

**Milo Vasseur** · responsable Qualité, fiabilité et recette
Chantier : J1 · Socle de confiance (avec Nour Belkacem), et la recette de tous les jalons
Droit de veto : toute livraison dont les tests bloquants ne passent pas.

---

## 0. Ce que j'ai vérifié avant d'écrire

Je ne commente rien que je n'aie exécuté. État constaté sur `claude/project-revival-vision-yfta0f`, node v22.22.2 :

| Vérification | Résultat |
|---|---|
| `node --test tests/*.test.mjs` | **41 tests, 41 verts, 0,35 s** |
| Fichiers couverts par un test | `predict`, `plan`, `travel`, `bedside`, `store`(migrate), `backup`, `copy` |
| Fichiers **non couverts** | `ui.js` (2 006 l.), `studio.js` (728 l.), `scene.js`, `audio.js`, `speech.js`, `card.js`, `icons.js`, `social.js`, `haptics.js`, `wakelock.js`, `app.js` |
| Lignes de JS livrées | 4 647 l. / 167 877 octets (budget 220 Ko : **76 % consommé**) |
| Part du JS livré sous test | ~ 12 % des lignes |
| Dérive du manifeste `ASSETS` du service worker | **aucune aujourd'hui** (19 modules listés = 19 modules sur disque) |
| Intégration continue | **aucune**, pas de `.github/` dans le dépôt |
| Dialogues natifs restants | 4 (`js/ui.js:1410`, `js/ui.js:1709`, `js/studio.js:591`, `js/studio.js:647`) |

**Deux prototypes écrits et exécutés** pour prouver la faisabilité de ce document (scratchpad, jetables) :
un faux DOM de 139 lignes qui pilote `ui.js` sous node sans aucune dépendance, et un vérificateur
du manifeste de cache. Les deux tournent. Le premier a trouvé un défaut réel en production, décrit
au §7.

Et un constat qui doit ouvrir la réunion, parce qu'il corrige le document de vision :

> `00-vision.md` §1 affirme que R1 à R5 « sont exécutables, et `tests/copy.test.mjs` les fait
> respecter par la machine ». C'est vrai pour les 246 chaînes de `copy.js`. Ce n'est vrai pour
> **aucune** des règles qui s'exercent au moment du geste. R2 n'est testée nulle part, par
> personne, par aucune machine. Le filet couvre le vocabulaire, pas le comportement.

---

## 1. Cartographie du risque de régression

### 1.1 Les cinq règles produit

| Règle | Couvert aujourd'hui ? | Par quoi | Ce qui reste à découvert | Conséquence utilisateur d'une régression silencieuse |
|---|---|---|---|---|
| **R1** · jamais le temps | **Partiel** | `tests/copy.test.mjs` : 8 motifs interdits sur 246 chaînes statiques + 9 chaînes de fonctions de `copy.js` | Toute chaîne construite hors `copy.js` : gabarits littéraux de `ui.js`, `studio.js`, `card.js`, `social.js` (~49 littéraux français candidats, une vingtaine confirmés à l'œil). Aucune vérification du DOM **rendu** | Un « il reste 12 min » réapparaît dans un gabarit et l'app devient exactement le minuteur anxiogène qu'elle refuse d'être. Personne ne le voit avant un utilisateur réel. Régression de marque, pas de bug |
| **R2** · jamais d'avancement seul | **Non. Zéro couverture.** | rien | La totalité du chemin : `holdButton` (`ui.js:125`), `confirmNext` (`ui.js:713`), le ticker de 5 s (`ui.js:663`), `nightTick` (`ui.js:1651`), `renderWakeProposal` (`ui.js:1743`) | **C'est le bug de la douche.** L'utilisateur perd la confiance en une seule occurrence : si l'app a « décidé » qu'il avait fini sa douche, il ne peut plus la croire sur rien. Le produit meurt le matin où ça arrive |
| **R3** · n'apprendre que du réel | **Partiel, du bon côté** | `travel.test.mjs` (bornes [5,180], purge 4 h, FIFO 8), `predict.test.mjs` (pas de mesure = `est`, confidence 0) | Le chemin d'**écriture** depuis le live : `live.measurements` (`ui.js:718-721`), le drapeau `polluted` (F6), `onFeedback`. Rien ne teste qu'une confirmation non accomplie n'écrit pas | Le modèle s'empoisonne en silence. Symptôme différé de plusieurs jours : l'app devient de plus en plus fausse sans que personne relie la cause à l'effet. Le pire mode de panne du projet, parce qu'il est indétectable de l'intérieur |
| **R4** · marge invisible | **Partiel** | `copy.test.mjs` (mots « marge », « seuil »), `plan.test.mjs` (la marge ne fuit pas dans `sequence[].label`) | La valeur numérique de la marge dans le DOM rendu. `live.margin` circule dans `ui.js` et rien ne garantit qu'il ne s'affiche jamais | Fuite modérée : l'utilisateur découvre qu'on lui « ajoute 11 minutes » et il les retranche mentalement. La marge cesse d'agir le jour où elle est nommée |
| **R5** · apaiser | **Partiel** | `copy.test.mjs` (4 motifs) | Le ton d'une chaîne nouvelle hors `copy.js`. La montée en son du réveil (`audio.startWake`, non testée). Le fait qu'aucun écran ne chiffre un retard | Une sonnerie qui escalade ou une phrase sèche à 7 h : l'app trahit sa promesse sur le seul écran où l'utilisateur est le plus vulnérable |

### 1.2 Les dix pièges connus (CLAUDE.md §6)

| # | Piège | Couvert ? | Par quoi | Conséquence d'un retour silencieux | Priorité |
|---|---|---|---|---|---|
| P1 | **Le bug de la douche** (avancement sur horloge théorique) | **Non** | rien | Perte de confiance irréversible. Le produit n'a plus d'argument | **P0** |
| P2 | **Appui interrompu** (< 600 ms avance ou écrit) | **Non** | rien | Faux positifs d'avancement dans la poche, mesures fantômes injectées dans le modèle (R3) | **P0** |
| P3 | **Marge affichée / prononçable** | Partiel | `copy.test.mjs`, `plan.test.mjs` | Voir R4 | P1 |
| P4 | **Compte à rebours déguisé** | Partiel | `copy.test.mjs` (chaînes de `copy.js` seulement) | Voir R1 | P1 |
| P5 | **Autoplay audio iOS** (contexte non déverrouillé par un geste) | **Non** (impossible hors navigateur) | rien | Le réveil ne sonne pas. Panne totale de la promesse F1, sur le seul usage où l'app est seule responsable | **P0 en recette manuelle** |
| P6 | **`pendingTrip` qui pollue** | **Oui, bien** | `travel.test.mjs` × 3 | Modèle de trajet faussé | Couvert |
| P7 | **Scène Nuit par l'horloge ou les réglages** | **Non** | rien. `scene.resolveScene` n'a aucun test, et `SCENES.includes('night')` est vrai : un état importé avec `settings.scene = 'night'` verrouille l'app en scène Nuit (l'UI de réglages ne l'offre pas, `backup.js` ne valide pas l'énumération) | App en quasi-noir toute la journée après un import. Signalé comme défaut, §7 | P2 |
| P8 | **localStorage éclaté** | **Non** | rien (une seule clé aujourd'hui, `store.js:5`) | Migration future cassée, import/export incohérent | P2 |
| P9 | **Mesures théoriques injectées** (`est` traité comme réel) | Partiel | `predict.test.mjs` teste la lecture, pas l'écriture | Voir R3. Le modèle apprend ses propres estimations et se croit confiant | **P0** |
| P10 | **Requête réseau tierce ou de données perso** | **Non** | rien | Rupture du contrat fondateur du produit. Non négociable | P1, automatisable |

**Lecture de ce tableau.** Sur dix pièges, un seul est correctement couvert (P6). Les quatre P0
partagent la même racine : **le comportement du geste de confirmation n'est observé par personne.**
Tout le reste de ce document en découle.

---

## 2. Le harnais anti bug de la douche

### 2.1 Le principe, et pourquoi les tests actuels ne peuvent pas l'attraper

Le bug de la douche n'est pas une erreur de calcul. C'est une **erreur de causalité** : une fonction
qui lit l'horloge finit par écrire dans `live.current`. Aucun test de fonction pure ne peut le voir,
parce que le défaut vit précisément dans le couplage entre une horloge et un état de session.

La propriété à tester est donc négative et se formule en une phrase :

> **Entre deux gestes de confirmation accomplis, `live.current` est invariant, quelle que soit la
> quantité de temps écoulée et quelles que soient les minuteries qui ont tiré.**

Un test négatif exige de faire passer beaucoup de temps très vite. D'où : **horloge et minuteries
sous contrôle**, pas de `await sleep()`.

### 2.2 Structure du harnais

Trois fichiers, zéro dépendance.

```
tests/
  helpers/
    tiny-dom.mjs        # faux DOM + horloge et minuteries controlees (~140 l.)
    live-harness.mjs    # ouvre une session live, expose des gestes de haut niveau
  live-r2.test.mjs      # LE test. R2 sous toutes ses formes
  live-r1.test.mjs      # R1 sur le DOM rendu (voir §3.4)
  live-r3.test.mjs      # R3 : ce qui est ecrit dans le modele, et quand
```

### 2.3 La stratégie : horloge et minuteries injectables, faux DOM dispatchant

Trois briques, et c'est tout.

**Brique 1 · une horloge déterministe.** On remplace `Date`, `setTimeout`, `setInterval` par une
file de minuteries ordonnée. `advance(ms)` fait tirer les minuteries dans l'ordre chronologique
réel. C'est ce qui rend testable « 90 minutes passent ».

**Brique 2 · `freeze` / `thaw`, la clé du cas iOS.** Un onglet gelé par Safari, c'est du temps qui
passe **sans qu'aucune minuterie ne tire**, puis un dégel où les minuteries en retard tirent une
fois, pas cent fois. Deux méthodes suffisent à modéliser ça fidèlement :

```js
// Gel d'onglet iOS : le temps passe, AUCUNE minuterie ne tire.
freeze(ms) { now += ms; },
// Degel : les minuteries en retard tirent une fois, puis on repart.
thaw() {
  for (const [id, t] of timers) if (t.at <= now) {
    if (t.every) t.at = now + t.every; else timers.delete(id);
    t.fn();
  }
},
```

C'est exactement le scénario que `bedside.test.mjs` teste déjà côté calcul pur (« onglet gele puis
degele bien apres l'heure : toujours `wake`, pas de derive »). Le harnais l'étend au comportement.

**Brique 3 · un faux DOM qui dispatche vraiment.** Le point non négociable : les écouteurs posés par
`el()` doivent être appelés pour de vrai, avec remontée aux parents. Sans ça on teste du rendu, pas
du comportement, et R2 nous échappe encore. Environ 60 lignes :

```js
class Node {
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  // Dispatch reel : remonte la chaine des parents (bubbling simplifie).
  dispatch(type, ev = {}) {
    const event = { type, target: this, currentTarget: this,
      preventDefault() {}, stopPropagation() {},
      clientX: 10, clientY: 10, pointerId: 1, ...ev };
    let n = this;
    while (n) { event.currentTarget = n; for (const fn of n.listeners[type] || []) fn(event); n = n.parentNode; }
  }
  // Recherche par predicat : on interroge l'ecran comme un utilisateur.
  all(pred, out = []) { if (pred(this)) out.push(this); this.children.forEach((c) => c.all(pred, out)); return out; }
  text() { return (this._text + ' ' + this.children.map((c) => c.text()).join(' ')).replace(/\s+/g, ' ').trim(); }
}
```

Le reste (`classList`, `setAttribute`, `replaceChildren`, `getBoundingClientRect`,
`setPointerCapture`, `createElementNS` pour le sprite SVG) est mécanique. Deux pièges concrets,
tous deux rencontrés et résolus dans le prototype :

- node 22 expose déjà un `navigator` global en getter seul. Il faut `Object.defineProperty`,
  l'affectation directe lève.
- le tiroir de séquence (F6, `openDrawer`, `ui.js:795`) s'insère dans `document.body`, pas dans
  `#app`. Les requêtes du harnais doivent partir de `document.body`, sinon le bouton « imprévu »
  reste introuvable.

**Brique 4 · les gestes, exprimés en intention.** C'est le vocabulaire du test, et il doit rendre
la distinction entre appui accompli et appui interrompu impossible à confondre :

```js
// tests/helpers/live-harness.mjs
export function holdComplete(btn, clock) {   // appui tenu accompli
  btn.dispatch('pointerdown'); clock.advance(700); btn.dispatch('pointerup');
}
export function holdInterrupted(btn, clock, ms = 400) {  // relache trop tot
  btn.dispatch('pointerdown'); clock.advance(ms); btn.dispatch('pointerup');
}
export function holdCancelled(btn, clock) {  // appel entrant, doigt qui glisse
  btn.dispatch('pointerdown'); clock.advance(300); btn.dispatch('pointercancel');
}
```

### 2.4 Le test lui-même

```js
// tests/live-r2.test.mjs
// R2 : l'etape courante ne change QUE sur confirmation accomplie.
// Ce fichier est bloquant. Une seule assertion rouge ici bloque la livraison.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installDom, installClock } from './helpers/tiny-dom.mjs';
import { openLiveSession, currentStepLabel, holdButton, holdComplete, holdInterrupted, holdCancelled }
  from './helpers/live-harness.mjs';

const clock = installClock();          // avant l'import de ui.js : Date et les
const { body } = installDom();         // minuteries doivent deja etre a nous
const ui = await import('../js/ui.js');

test('P1 · l horloge ne fait JAMAIS avancer l etape', async (t) => {
  await t.test('90 min d inaction : l etape ne bouge pas', () => {
    openLiveSession(ui, { arrival: '09:00' });
    const before = currentStepLabel(body);
    clock.advance(90 * 60000);         // le ticker de 5 s tire ~1080 fois,
    assert.equal(currentStepLabel(body), before);  // le nudge se declenche
  });

  await t.test('l etape suggeree reste suggeree, elle ne se confirme pas seule', () => {
    openLiveSession(ui, { arrival: '09:00' });
    const before = currentStepLabel(body);
    clock.advance(3 * 60 * 60000);     // trois heures : bien au-dela de toute duree
    assert.equal(currentStepLabel(body), before);
  });

  await t.test('gel d onglet de 3 h puis degel : l etape ne bouge pas', () => {
    openLiveSession(ui, { arrival: '09:00' });
    const before = currentStepLabel(body);
    clock.freeze(3 * 60 * 60000);      // Safari a suspendu la page
    clock.thaw();                      // retour au premier plan
    clock.advance(60000);
    assert.equal(currentStepLabel(body), before);
  });
});

test('P2 · seul un appui accompli avance', async (t) => {
  await t.test('appui relache avant 600 ms : rien', () => {
    openLiveSession(ui, { arrival: '09:00' });
    const before = currentStepLabel(body);
    holdInterrupted(holdButton(body), clock, 400);
    clock.advance(5000);               // et le timer ne tire pas en differe
    assert.equal(currentStepLabel(body), before);
  });

  await t.test('appui annule (appel entrant, doigt qui glisse) : rien', () => {
    const before = currentStepLabel(body);
    holdCancelled(holdButton(body), clock);
    clock.advance(5000);
    assert.equal(currentStepLabel(body), before);
  });

  await t.test('appui accompli : avance d exactement une etape', () => {
    const before = currentStepLabel(body);
    holdComplete(holdButton(body), clock);
    const after = currentStepLabel(body);
    assert.notEqual(after, before);
    clock.advance(60000);
    assert.equal(currentStepLabel(body), after);   // et pas deux
  });
});

test('P1 · la reprise d imprevu (F6) n avance pas l etape', () => {
  openLiveSession(ui, { arrival: '09:00' });
  const before = currentStepLabel(body);
  byText(body, /imprévu/i).dispatch('click');      // le bouton vit dans le tiroir
  clock.advance(45 * 60000);                       // 45 min de pause
  byText(body, /Reprendre/).dispatch('click');
  assert.equal(currentStepLabel(body), before);    // on revient OU on etait
});

test('P1 etendu · le reveil ne lance JAMAIS le live seul', async (t) => {
  await t.test('l aube ne demarre pas de session', () => {
    openBedside(ui, { wakeTime: '07:00', lightLeadMin: 10 });
    clock.advance(50 * 60000);                     // on traverse l aube entiere
    assert.equal(sceneOf(), 'night');
    assert.equal(currentStepLabel(body), null);    // aucune etape : pas de live
  });
  await t.test('la sonnerie ne demarre pas de session', () => {
    clock.advance(30 * 60000);                     // l heure passe, ca sonne
    assert.ok(isRinging(body));
    assert.equal(currentStepLabel(body), null);    // ca sonne, et ca attend
  });
  await t.test('seul l appui tenu du matin ouvre la session', () => {
    holdComplete(wakeZone(body), clock);
    assert.ok(greetingShown(body));
  });
});

test('P9 + R3 · aucune ecriture sans confirmation accomplie', () => {
  const before = snapshotModel();                  // copie de profiles[].steps[].real
  openLiveSession(ui, { arrival: '09:00' });
  clock.advance(60 * 60000);
  holdInterrupted(holdButton(body), clock, 400);
  abortSession(body);
  assert.deepEqual(snapshotModel(), before);       // pas une seule mesure ecrite
});
```

### 2.5 Faisabilité : prouvée, pas supposée

J'ai écrit ce harnais et je l'ai fait tourner sur le `ui.js` actuel, **sans le modifier**.

```
ok 1 - le harnais demarre une session live sans navigateur
       etape 1 = Réveil
ok 2 - BUG DE LA DOUCHE : 90 min passent, l etape ne change pas
ok 3 - appui interrompu : rien n avance
ok 4 - appui accompli : l etape avance, une seule fois
       etape 2 = Douche
ok 5 - R1 : aucun compte a rebours dans le DOM rendu
ok 6 - gel d onglet de 3 h puis degel : l etape ne bouge pas
# pass 6 / fail 0   ·   duree totale : 0,24 s
```

Le faux DOM fait **139 lignes**. Il calcule le plan complet, rend l'écran de préparation
(« 07:37 Réveil / 07:42 Douche / ... / 08:29 C'est l'heure »), démarre la session et répond aux
gestes. Coût : zéro dépendance, un quart de seconde.

Ce que ça veut dire concrètement : **le filet peut exister avant la découpe de `ui.js`.** Ce n'est
pas une contrepartie que je demande à Nour, c'est un préalable que je peux livrer seul. Voir §6.1,
c'est mon désaccord principal.

---

## 3. Stratégie de test du rendu sans dépendance

### 3.1 L'obstacle, mesuré

`js/ui.js:22` :

```js
const root = document.getElementById('app');
```

Exécuté à l'import du module. En node, `import './js/ui.js'` lève immédiatement.

**Bonne nouvelle, vérifiée fichier par fichier : c'est le seul.** Aucun autre module du dépôt ne
touche `document`, `window`, `navigator`, `localStorage`, `AudioContext` ou `speechSynthesis` au
niveau du module. `audio.js` construit son contexte paresseusement (`ensureCtx`), `speech.js` teste
`typeof window !== 'undefined'`, `wakelock.js` teste `'wakeLock' in navigator`, `scene.js` ne touche
au DOM que dans ses fonctions. La discipline de séparation a tenu partout ailleurs.

Et le contournement existe déjà : **installer les globales avant un `import()` dynamique**. Les
modules ES exécutent leur code de haut niveau au moment de l'import, donc :

```js
installClock();                        // Date et minuteries a nous
installDom();                          // globalThis.document existe
const ui = await import('../js/ui.js'); // ligne 22 trouve son #app
```

C'est ce que fait mon prototype, et ça marche aujourd'hui, sans toucher au produit.

### 3.2 Ce que je réclame quand même à Nour, et pourquoi

Le contournement suffit à écrire le filet. Il ne suffit pas à rendre `ui.js` agréable à vivre. Trois
demandes, par ordre décroissant de valeur et croissant de coût.

| # | Demande | Coût | Ce que ça débloque | Est-ce bloquant pour moi ? |
|---|---|---|---|---|
| **D1** | **Extraire la machine à états de session dans `js/live.js`, sans DOM** : `createSession(plan, ctx)`, `confirm(session, now)`, `pause`, `resume`, `applyRescue`, `status(session, now)`. `ui.js` ne fait plus que rendre `status()` et appeler `confirm()`. Fonctions pures, entrées sorties, comme `plan.js` | 1 à 2 j | R2, R3 et le rattrapage deviennent testables comme `plan.js` : sans faux DOM, sans faux temps, en tests de fonction pure. **La règle qui fait le produit rejoint la couche déjà solide du dépôt.** C'est aussi la seule façon de garantir durablement l'invariant : si `ui.js` ne peut plus écrire `session.current`, le bug de la douche devient structurellement impossible | **Non bloquant, mais c'est la demande que je défends le plus.** Sans elle je teste un comportement ; avec elle je teste un invariant |
| **D2** | Remplacer `const root = document.getElementById('app')` par un accès paresseux (`function root() { return document.getElementById('app'); }`) ou une fonction `mount(node)` appelée par `app.js` | 15 min | `import` statique de `ui.js` sous node, harnais plus simple, plus de dépendance à l'ordre d'installation des globales | Non. Confort |
| **D3** | Découper `ui.js` par écran (`ui/home.js`, `ui/live.js`, `ui/bedside.js`, `ui/settings.js`, `ui/mornings.js`), en gardant `ui/el.js` commun | 2 à 3 j | Lisibilité, revue de code possible, surface de conflit réduite. **Aucun gain de testabilité par lui-même** | Non, et je demande qu'il vienne **après** le filet |

Sur D3 je serai précis, parce que c'est le cœur de J1 tel qu'il est écrit : **découper un fichier ne
le rend pas testable.** Cinq fichiers de 400 lignes qui font `document.getElementById` au chargement
sont exactement aussi intestables qu'un fichier de 2 006 lignes. Ce qui rend testable, c'est D1 :
sortir l'état de la couche de rendu. Si je devais choisir entre D1 et D3, je prends D1 sans hésiter
et je laisse `ui.js` à 2 006 lignes.

### 3.3 Les frontières que je teste, et celles que je ne teste pas

| Frontière | Niveau | Outil | Ce qu'on affirme |
|---|---|---|---|
| Logique pure (`predict`, `plan`, `travel`, `bedside`, `store`, `backup`) | Unitaire | `node --test` nu | Les calculs sont justes. **Déjà en place, 41 tests** |
| Machine à états de session (après D1) | Unitaire | `node --test` nu | R2 et R3 sont des invariants du modèle, pas des accidents du rendu |
| Comportement d'écran (`ui.js` piloté par gestes) | Intégration | faux DOM + horloge contrôlée | Les gestes produisent les bonnes transitions ; le temps n'en produit aucune |
| Texte rendu (le DOM sérialisé en chaîne) | Contrat | faux DOM + les motifs de `copy.test.mjs` | R1, R4, R5 tiennent **sur ce qui est réellement affiché**, pas seulement sur `copy.js` |
| Manifeste de cache hors-ligne | Statique | lecture de fichiers, `node --test` | Le service worker couvre tout ce qui est livré |
| Absence de dépendance et de requête tierce | Statique | analyse de source | Le contrat fondateur n'a pas été rompu par inadvertance |

### 3.4 Le contrôle R1 qui manque : tester le DOM rendu, pas les chaînes sources

C'est le trou le plus facile à boucher et il rapporte immédiatement. `copy.test.mjs` inspecte
`copy.js`. Personne n'inspecte ce que l'utilisateur lit.

```js
// tests/render-copy.test.mjs
// R1, R4, R5 verifies sur le texte REELLEMENT rendu, quelle que soit son origine.
const FORBIDDEN = [
  /il (te )?reste/i, /min(utes)? restantes?/i, /encore \d+ ?min/i,
  /dans \d+ ?min/i, /\d+ ?min(utes)? de retard/i, /compte [aà] rebours/i,
  /marge/i, /seuil/i, /—/,
];

// Chaque ecran est visite, son texte integral est passe au tamis.
for (const [name, open] of Object.entries(SCREENS)) {
  test(`ecran ${name} : aucune formulation interdite dans le rendu`, () => {
    open();
    const rendered = body.text();
    for (const re of FORBIDDEN)
      assert.ok(!re.test(rendered), `${name} : ${re} dans "${rendered.slice(0, 200)}"`);
    // R4 : la valeur numerique de la marge ne doit apparaitre nulle part
    assert.ok(!new RegExp(`\\b${currentMargin()}\\b`).test(rendered));
  });
}
```

Bénéfice de bord : ce test attrape aussi les chaînes écrites en dur hors `copy.js`, ce qui rend
enfin **exécutable** le droit de veto de Camille. Aujourd'hui son veto est déclaratif ; là il devient
une assertion. Je propose d'ajouter, quand l'inventaire aura été fait avec elle, un test
complémentaire qui exige que tout texte rendu se retrouve dans `copy.js` (avec une liste
d'exceptions explicites et courte, chaque exception justifiée par une ligne de commentaire).

Un mot d'honnêteté sur `copy.test.mjs` : son parcours des fonctions les appelle dans un
`try {} catch {}` silencieux. Aujourd'hui les 9 fonctions de `COPY` et `UI` sont toutes atteintes,
j'ai vérifié. Mais le jour où Camille ajoute une fonction à trois paramètres, elle sortira du filet
**sans le moindre signal**. Correctif d'une ligne : compter les fonctions atteintes et faire échouer
le test si l'une d'elles n'a pu être appelée. Un filet qui se troue en silence est pire qu'un filet
absent, parce qu'on lui fait confiance.

### 3.5 Ce qui restera hors de portée automatique, et le restera

Je préfère le dire franchement plutôt que de vendre une couverture qui n'existera pas. Un faux DOM
ne modélise ni le moteur de rendu, ni le matériel, ni Safari. Restent en recette manuelle, pour
toujours :

| Domaine | Pourquoi c'est irréductible | Où c'est traité |
|---|---|---|
| **Déverrouillage audio iOS** (P5) | Dépend d'une politique de Safari qui n'a pas d'équivalent simulable. Le repli lumière et vibration aussi | Recette longue, RL-4 |
| **Wake Lock sur une vraie nuit** | Comportement OS, batterie, Low Power Mode, écran verrouillé | Recette longue, RL-4 et RL-5 |
| **Le geste tenu de 600 ms au doigt** | La bonne durée est une question de sensation, pas de logique. Un test dit « 600 ms se sont écoulées », pas « c'est agréable ». Périmètre d'Iris | Recette courte, RC-2, plus les tests utilisateurs de Léa |
| **VoiceOver** | Aucun simulateur crédible sans dépendance | Recette longue, RL-7 |
| **Rendu visuel, scènes, canvas ambiant, contrastes** | Le faux DOM ne calcule aucun style | Recette courte, RC-6 |
| **Web Speech (voix F2)** | Voix système, non déterministe entre appareils | Recette longue, RL-6 |
| **Installation sur l'écran d'accueil, mode standalone** | Comportement Safari | Recette longue, RL-8 |
| **Onglet réseau, absence de requête tierce** | Automatisable **partiellement** en statique (voir CI, job `contrat`). La vérification finale reste visuelle | CI + recette longue, RL-9 |

**Position de principe.** Le harnais automatique ne remplace pas la recette. Il la **désencombre** :
il absorbe tout ce qui est déterministe, pour que le temps humain sur appareil réel aille aux choses
qui ne peuvent être vues que par un humain sur un appareil réel. Une recette de quarante points
n'est jamais faite en entier ; une recette de dix points bien choisis l'est.

---

## 4. L'intégration continue

### 4.1 Ce que la CI exécute

Quatre jobs, tous sans installation de dépendance, parce qu'il n'y en a aucune à installer.

| Job | Ce qu'il vérifie | Bloquant | Durée visée |
|---|---|---|---|
| `logique` | `node --test tests/*.test.mjs` : les 41 existants plus les nouveaux `live-r1/r2/r3` et `render-copy` | **Oui** | < 10 s |
| `cache` | Le manifeste `ASSETS` du service worker couvre tous les fichiers livrés, ne référence aucun fichier disparu, et couvre tous les modules importés | **Oui** | < 3 s |
| `contrat` | Aucune dépendance runtime, aucune URL tierce, aucun tiret cadratin, budget JS sous 220 Ko, version du service worker incrémentée si un fichier caché a changé | **Oui** sauf la version du SW (avertissement) | < 5 s |
| `journal` | Publie un résumé lisible dans l'onglet Actions : nombre de tests, taille du JS, marge de budget | Non | < 2 s |

**Temps d'exécution total visé : moins de 60 secondes**, dont environ 40 pour le démarrage des
runners. Les tests eux-mêmes tournent en 0,35 s aujourd'hui et je table sur moins de 2 s une fois le
harnais ajouté. Une CI qui dépasse deux minutes sur un projet sans build est une CI qu'on finira par
contourner.

### 4.2 Ce qui bloque une fusion

Sur `main`, protection de branche avec les vérifications requises `logique`, `cache`, `contrat`. Plus
deux règles humaines :

- **Aucune fusion sans revue.** Sur ce projet à six, la revue croisée est le seul substitut au
  contrôle qualité continu.
- **Aucune fusion touchant `ui.js`, `js/live.js` ou `holdButton` sans que le testeur ait exécuté au
  moins la recette courte.** Case à cocher obligatoire dans le gabarit de PR, avec la date et
  l'appareil. Non déclarée, je bloque.

Et une règle qui me concerne directement : **je ne peux pas exercer mon droit de veto sans
protection de branche.** Un veto qui repose sur ma vigilance est un veto qui tombe le jour où je suis
en congé. La protection de branche est la forme technique de mon mandat, pas un détail de
configuration.

### 4.3 Le workflow

```yaml
# .github/workflows/ci.yml
# Douce heure · integration continue.
# Aucune dependance a installer : le depot n'en a aucune, et ce fichier
# doit rester la preuve vivante de cette contrainte.

name: CI

on:
  push:
    branches: ['**']
  pull_request:
    branches: [main]

permissions:
  contents: read

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  logique:
    name: Tests (logique pure + comportement)
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          # Pas de cache : il n'y a pas de node_modules a mettre en cache.

      - name: Aucune dependance ne doit avoir ete introduite
        run: |
          if [ -f package-lock.json ] || [ -d node_modules ]; then
            echo "::error::Une dependance a ete introduite. Contrainte d'architecture violee (CLAUDE.md §3)."
            exit 1
          fi
          node -e "
            const p = require('./package.json');
            for (const k of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
              if (p[k] && Object.keys(p[k]).length) {
                console.error('::error::package.json declare des ' + k + '. Zero dependance runtime ET zero dependance de test.');
                process.exit(1);
              }
            }
          "

      - name: Tests
        run: node --test tests/*.test.mjs

  cache:
    name: Manifeste de cache hors-ligne
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - name: Le service worker couvre tous les fichiers livres
        run: node --test tests/service-worker.test.mjs

  contrat:
    name: Contrat fondateur (zero tiers, budgets, typographie)
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v4

      - name: Aucune requete tierce dans le code livre
        run: |
          # Les polices sont auto-hebergees : aucune URL absolue hors du depot.
          if grep -rniE "https?://(?!localhost)" --include='*.js' --include='*.css' --include='*.html' \
               --include='*.webmanifest' . \
               | grep -v '^./tests/' | grep -v '^./docs/' \
               | grep -viE 'www\.w3\.org|schema|^\s*(//|\*|<!--)' ; then
            echo "::error::URL tierce detectee. CLAUDE.md §3 : zero requete tierce."
            exit 1
          fi

      - name: Aucun tiret cadratin nulle part
        run: |
          if grep -rlP '\x{2014}' --include='*.js' --include='*.css' --include='*.html' \
               --include='*.md' --include='*.webmanifest' . ; then
            echo "::error::Tiret cadratin detecte (CLAUDE.md §7)."
            exit 1
          fi

      - name: Budget JS (< 220 Ko non minifie)
        run: |
          BYTES=$(cat js/*.js | wc -c)
          LIMIT=225280
          echo "JS livre : ${BYTES} octets sur ${LIMIT} ($(( BYTES * 100 / LIMIT )) %)"
          echo "JS_BYTES=${BYTES}" >> "$GITHUB_ENV"
          if [ "$BYTES" -gt "$LIMIT" ]; then
            echo "::error::Budget JS depasse (CLAUDE.md §3)."
            exit 1
          fi
          if [ "$BYTES" -gt $(( LIMIT * 90 / 100 )) ]; then
            echo "::warning::Budget JS a plus de 90 %. Le prochain jalon doit retirer du code."
          fi

      - name: Version du service worker incrementee si un fichier cache a change
        if: github.event_name == 'pull_request'
        run: |
          git fetch --no-tags --depth=1 origin "${{ github.base_ref }}"
          CHANGED=$(git diff --name-only "origin/${{ github.base_ref }}"...HEAD -- js css index.html manifest.webmanifest assets || true)
          SW_CHANGED=$(git diff "origin/${{ github.base_ref }}"...HEAD -- service-worker.js | grep -c "^\+const VERSION" || true)
          if [ -n "$CHANGED" ] && [ "$SW_CHANGED" -eq 0 ]; then
            echo "::warning::Des fichiers caches ont change sans incrementer VERSION dans service-worker.js. Les utilisateurs installes garderont l'ancienne version."
          fi

  journal:
    name: Journal de livraison
    runs-on: ubuntu-latest
    needs: [logique, cache, contrat]
    if: always()
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - name: Resume
        run: |
          {
            echo "## Douce heure · etat du socle"
            echo ""
            echo "| Indicateur | Valeur |"
            echo "|---|---|"
            echo "| Fichiers de test | $(ls tests/*.test.mjs | wc -l) |"
            echo "| JS livre | $(cat js/*.js | wc -c) octets / 225280 |"
            echo "| Modules dans le cache hors-ligne | $(grep -c \"^  './\" service-worker.js) |"
            echo "| Version du service worker | $(grep -oP \"VERSION = '\\K[^']+\" service-worker.js) |"
          } >> "$GITHUB_STEP_SUMMARY"
```

### 4.4 La vérification du manifeste de cache

Écrite, exécutée, verte sur l'état actuel, et vérifiée capable de détecter une dérive : j'ai copié le
dépôt, ajouté un `js/live.js` non déclaré, et le test est passé au rouge avec le bon message
(`absents du cache hors-ligne : ./js/live.js`). Trois assertions, parce que la dérive va dans les
deux sens et que la troisième est la plus vicieuse.

```js
// tests/service-worker.test.mjs
// Le cache hors-ligne est la seule chose qui separe un utilisateur installe
// d'une app cassee en mode avion. Il est maintenu a la main : il doit etre verifie.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SKIP_DIRS = new Set(['.git', '.github', 'tests', 'docs', 'node_modules']);
const SHIPPED = /\.(js|css|html|webmanifest|woff2|png|svg|jpg|ico)$/i;
const NOT_CACHED = new Set(['service-worker.js']);   // ne se met pas en cache lui-meme

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    if (SKIP_DIRS.has(e)) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (SHIPPED.test(e)) out.push('./' + relative(ROOT, p));
  }
  return out;
}

function swAssets() {
  const src = readFileSync(join(ROOT, 'service-worker.js'), 'utf8');
  const block = src.match(/const ASSETS = \[([\s\S]*?)\];/);
  assert.ok(block, 'liste ASSETS introuvable dans service-worker.js');
  return [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

test('le manifeste couvre tous les fichiers livres', () => {
  const listed = new Set(swAssets());
  const missing = walk(ROOT).filter((f) => !listed.has(f) && !NOT_CACHED.has(f.slice(2)));
  assert.deepEqual(missing, [], `absents du cache hors-ligne : ${missing.join(', ')}`);
});

test('le manifeste ne reference aucun fichier disparu', () => {
  // Un seul chemin mort et addAll() rejette : l'installation echoue EN ENTIER,
  // l'app n'est plus disponible hors-ligne du tout. Panne silencieuse maximale.
  const onDisk = new Set(walk(ROOT));
  const ghosts = swAssets().filter((a) => a !== './' && !onDisk.has(a));
  assert.deepEqual(ghosts, [], `references mortes : ${ghosts.join(', ')}`);
});

test('tout module importe par un module cache est lui-meme cache', () => {
  const listed = new Set(swAssets());
  const missing = [];
  for (const f of walk(ROOT).filter((f) => f.endsWith('.js'))) {
    const src = readFileSync(join(ROOT, f.slice(2)), 'utf8');
    for (const m of src.matchAll(/from\s+'(\.\/[^']+)'/g)) {
      const resolved = './js/' + m[1].slice(2);
      if (!listed.has(resolved)) missing.push(`${f} importe ${resolved}, absent du cache`);
    }
  }
  assert.deepEqual(missing, [], missing.join(' · '));
});
```

Résultat sur l'état actuel : **3 tests, 3 verts.** C'est une base saine, et c'est précisément
pourquoi il faut l'installer maintenant : un vérificateur qu'on ajoute quand la dérive existe déjà
demande d'abord de réparer, et on ne l'ajoute jamais.

---

## 5. La recette manuelle

### 5.1 Principe

Deux recettes, pas une. Le README en liste dix, dont une qui exige une nuit complète : c'est
inapplicable avant chaque livraison, donc ce n'est appliqué jamais. Je scinde selon un critère
unique : **ce qui peut casser à chaque commit** contre **ce qui ne casse qu'en changeant de jalon**.

| | Recette courte (RC) | Recette longue (RL) |
|---|---|---|
| Quand | Avant **chaque** livraison sur `main` | Avant **chaque** clôture de jalon, et avant toute mise en ligne publique |
| Durée | **22 minutes**, chronométrées | **une nuit + 55 minutes** le lendemain matin |
| Appareils | 1 iPhone installé sur l'écran d'accueil | iPhone principal + 1 iPhone plus ancien + 1 Android |
| Qui | Une personne, n'importe laquelle de l'équipe | Moi, plus la personne responsable du jalon |
| Sortie | Ligne dans `docs/recettes/journal.md` | Fiche complète `docs/recettes/AAAA-MM-JJ-<jalon>.md` |

**Règle du matériel.** L'iPhone de recette est **installé depuis l'écran d'accueil**, jamais testé
dans l'onglet Safari. Le mode standalone a son propre cycle de vie et c'est le seul que nos
utilisateurs connaîtront. Une recette faite dans un onglet ne compte pas.

### 5.2 Recette courte · 22 minutes

Ordre non négociable : les tests bloquants d'abord, tant que l'attention est fraîche.

| # | Test | Durée | Ce qu'on fait exactement | Ce qu'on observe, précisément | Bloquant |
|---|---|---|---|---|---|
| **RC-1** | **Bug de la douche** | 6 min | Lancer une session. Sur la deuxième étape, poser le téléphone écran allumé et **ne rien toucher pendant 5 minutes chronométrées** | Le titre d'étape est **strictement identique** au bout de 5 min. L'écran a pu changer de ton, proposer, vibrer une fois. Il n'a **pas** changé d'étape | **Oui** |
| **RC-2** | **Appui interrompu** | 3 min | 5 appuis relâchés « trop tôt » à vue de nez, puis 3 appuis glissés hors du bouton avant la fin | Zéro avancement sur les 8. Le remplissage reflue à chaque fois. Aucune vibration de confirmation | **Oui** |
| **RC-3** | **Aucun compte à rebours** | 4 min | Traverser une session complète en lisant **chaque** écran, y compris le tiroir de séquence, la carte de rattrapage et l'écran de départ | Aucun nombre de minutes autre qu'une **heure cible** (`08:29`). Aucun « il reste », aucun « dans X min », aucun signe moins | **Oui** |
| **RC-4** | **Écran allumé** | 2 min | Session en cours, ne pas toucher, observer 90 secondes | L'écran ne s'éteint pas et ne se verrouille pas | **Oui** |
| **RC-5** | **Retour d'arrière-plan** | 3 min | Session en cours, basculer sur une autre app 2 min, revenir | Même étape, même message. Pas de saut, pas de rechargement, pas d'écran d'accueil | **Oui** |
| **RC-6** | **Coup d'œil visuel** | 2 min | Parcourir accueil, préparation, live, réglages | Rien de tronqué, rien d'illisible, pas de couleur d'alerte. Vérifier en taille de texte système agrandie | Non |
| **RC-7** | **Mode avion** | 2 min | Activer le mode avion, forcer la fermeture, rouvrir depuis l'écran d'accueil | Démarrage normal, polices correctes (pas de police système par défaut), navigation complète | **Oui** |

Les 7 points sont bloquants sauf RC-6. Une croix, je bloque la livraison, sans discussion et sans
délai de grâce.

### 5.3 Recette longue · une nuit et 55 minutes

Elle inclut la recette courte, puis ce que seule une vraie nuit peut révéler.

**La veille au soir, 20 minutes.**

| # | Test | Ce qu'on fait | Ce qu'on observe | Bloquant |
|---|---|---|---|---|
| **RL-1** | Préparation de la nuit | Charger l'iPhone à 100 %, le brancher, noter le pourcentage de batterie et l'heure exacte. Armer le chevet à une heure réelle. Appuyer sur « Bonne nuit » | L'écran passe en quasi-noir. L'horloge est lisible dans le noir sans éblouir | **Oui** |
| **RL-2** | Wake Lock nocturne | Poser le téléphone et **ne plus y toucher**. Vérifier à 30 min | Écran toujours allumé, jamais verrouillé | **Oui** |
| **RL-3** | Anti burn-in | Photographier l'horloge à 30 min d'intervalle | Le décalage de position est visible | Non |

**Le matin, au réveil, 20 minutes.** C'est le seul moment où l'on peut observer ces points, et il ne
se rejoue pas : le testeur doit avoir la fiche sous la main **avant** de dormir.

| # | Test | Ce qu'on observe, précisément | Bloquant |
|---|---|---|---|
| **RL-4** | **Aube et son** | L'aube commence bien 10 min avant l'heure. Le son démarre **sous le seuil d'audibilité** et monte sur environ 90 s. **Il n'escalade jamais.** Si le son n'est pas parti : les vibrations et la lumière ont pris le relais, et le son revient au premier appui | **Oui** |
| **RL-5** | **Le réveil n'avance pas seul** | Quand ça sonne, **ne rien faire pendant 4 minutes**. L'app sonne, propose, et **reste sur l'écran de réveil**. Aucune session de guidage ne démarre | **Oui** |
| **RL-6** | **« Pas encore »** | Appuyer sur « Pas encore ». Le silence se fait. Environ 5 min plus tard, re-proposition **lumineuse et silencieuse** | **Oui** |
| **RL-7** | **Le lever** | Appui tenu. Session du matin, audio et voix fonctionnels dès le premier son | **Oui** |
| **RL-8** | **Batterie** | Noter le pourcentage | Le téléphone est chargé. Le noter dans la fiche, même si ce n'est pas bloquant | Non |

**Le matin, en poursuivant, 35 minutes.**

| # | Test | Ce qu'on fait | Ce qu'on observe | Bloquant |
|---|---|---|---|---|
| **RL-9** | Recette courte intégrale | RC-1 à RC-7 | Voir §5.2 | **Oui** |
| **RL-10** | **Trajet réel** | Faire un vrai trajet. Confirmer « Je pars », puis « Je suis arrivé » | La mesure est prise. Refaire avec un trajet de moins de 5 min : **aucune** mesure, **aucun** message d'erreur | **Oui** |
| **RL-11** | **Trajet abandonné** | Partir, ne jamais confirmer l'arrivée. Rouvrir le lendemain | Aucune trace, aucune relance, aucun message | **Oui** |
| **RL-12** | **Réseau** | Safari de bureau connecté à l'iPhone, onglet réseau, session complète | Uniquement des ressources de notre origine. **Zéro** requête tierce, **zéro** requête contenant une donnée utilisateur | **Oui** |
| **RL-13** | **Export puis import** | Exporter sur l'iPhone A. Importer sur un iPhone B vierge | État strictement identique : profils, mesures, destinations, historique, réglages | **Oui** |
| **RL-14** | **VoiceOver** | VoiceOver actif, traverser une session entière | Chaque étape est annoncée. Le geste de confirmation est **atteignable et exécutable**. Périmètre d'Iris : je constate, elle tranche | **Oui à partir de J4** |
| **RL-15** | **Voix (F2)** | Activer la voix, traverser une session | La voix prononce **exactement** le texte affiché. Aucune durée prononcée | **Oui** |
| **RL-16** | **Appareil secondaire** | Rejouer RC-1 à RC-5 sur un iPhone plus ancien et sur un Android | Comportement identique. Une divergence Android est notée, pas bloquante | Non pour Android |

### 5.4 Comment on consigne

Deux artefacts, et l'un des deux est délibérément minuscule pour qu'il soit réellement rempli.

**Le journal, une ligne par livraison.** `docs/recettes/journal.md` :

```
| Date | Version | Recette | Appareil | iOS | Résultat | Par | Notes |
|---|---|---|---|---|---|---|---|
| 2026-08-12 | v2.1.0 | courte | iPhone 12 | 18.5 | 7/7 | Milo | RAS |
| 2026-08-19 | v2.2.0 | courte | iPhone 12 | 18.5 | 6/7 BLOQUÉ | Nour | RC-3 : « encore 4 min » dans le tiroir |
```

**La fiche de jalon, une par recette longue.** `docs/recettes/2026-09-03-J1.md` : le tableau complet
RL-1 à RL-16, une colonne par observation attendue, une colonne résultat, une colonne notes. Plus
trois obligations :

- **La nuit se décrit en toutes lettres.** Heure du coucher, heure de réveil réglée, heure de réveil
  observée, pourcentage de batterie au coucher et au lever, modèle et version d'iOS. Une nuit de
  recette qu'on ne peut pas reproduire n'est pas une donnée.
- **Toute croix ouvre une issue**, référencée dans la fiche. Sans issue, la croix n'existe pas.
- **La fiche est signée** par la personne qui a dormi avec le téléphone. Pas de recette anonyme.

**Ce qui déclenche mon veto** : une case bloquante en croix ; une recette courte non consignée pour
une livraison qui touche `ui.js` ou `live.js` ; une fiche de jalon sans nuit réelle. Dans les trois
cas la conversation est close jusqu'à correction, et je n'ai pas besoin de me justifier plus
longuement que ça.

---

## 6. Mes désaccords avec la vision

Ils sont trois. Le premier est un vrai désaccord de séquencement et j'y tiens.

### 6.1 J1 est dans le mauvais ordre, et cet ordre est dangereux

**Ce que dit la vision.** J1 « Socle de confiance » énonce quatre chantiers dans cet ordre :
intégration continue, **découpe de `ui.js`**, tests de non-régression au niveau du DOM, vérification
du manifeste. Critère de sortie : « on peut modifier `ui.js` sans peur ».

**Mon désaccord.** Découper 2 006 lignes non testées avant d'avoir posé le filet, c'est refactorer
sans filet précisément le fichier où le bug le plus grave du projet est né. La découpe est
l'opération qui a **le plus de chances** de réintroduire le bug de la douche, et l'ordre proposé la
place **avant** l'unique instrument capable de le détecter. On construirait le filet en dessous du
trapéziste après le saut.

L'objection attendue est : « on ne peut pas tester `ui.js` tant qu'il est monolithique ». **C'est
faux, et je l'ai vérifié.** Mon prototype pilote le `ui.js` actuel, non modifié, 2 006 lignes
comprises, en 0,24 s, avec 139 lignes de faux DOM. Six assertions passent déjà, dont le gel d'onglet.
L'obstacle réel se réduit à `document.getElementById('app')` à la ligne 22, et il se contourne en
installant les globales avant un import dynamique.

**L'ordre que je demande.**

| | Étape | Livrable | Qui | Pourquoi cet ordre |
|---|---|---|---|---|
| 1 | **CI + vérification du manifeste** | `.github/workflows/ci.yml`, `tests/service-worker.test.mjs` | Moi, 1 j | Zéro risque, valeur immédiate, et rien ne peut plus régresser sans qu'on le sache |
| 2 | **Le filet sur le `ui.js` actuel** | `tiny-dom.mjs`, `live-r1/r2/r3.test.mjs`, `render-copy.test.mjs` | Moi, 3 j | **Le filet doit exister avant la première ligne de refactor.** Il fixe le comportement d'aujourd'hui, verrues comprises, comme référence |
| 3 | **Extraction de `js/live.js`** (D1) | machine à états pure | Nour, 2 j | Le filet valide chaque commit. R2 devient un invariant testé comme `plan.js` |
| 4 | **Découpe par écran** (D3) | `ui/*.js` | Nour, 3 j | Confort et lisibilité, **une fois** le comportement verrouillé |

**Et je conteste le critère de sortie.** « On peut modifier `ui.js` sans peur » est un sentiment, pas
une porte. Il ne se contrôle pas, donc il se déclare, donc il se déclare vrai. Je propose de le
remplacer par quatre conditions vérifiables :

1. `tests/live-r2.test.mjs` couvre les cinq chemins d'avancement : geste accompli, geste interrompu,
   geste annulé, temps qui passe, réveil. Vert en CI.
2. La CI est branchée en protection de branche, et un commit qui casse R2 est **démontré** rouge (on
   introduit volontairement la régression sur une branche jetable, on vérifie que le filet la voit,
   on jette la branche). Un filet non éprouvé n'est pas un filet.
3. `tests/service-worker.test.mjs` vert, et sa capacité de détection démontrée de la même façon.
4. Une recette courte consignée dans `docs/recettes/journal.md`.

**Ce que J1 retire** (la vision demande que chaque jalon retire quelque chose, et J1 tel qu'écrit ne
retire rien) : il retire la **confiance aveugle**. Concrètement, il retire deux choses réelles du
dépôt, les deux `confirm()` et le `prompt()` qui bloquent l'exécution. Voir le point suivant.

### 6.2 Les dialogues natifs doivent descendre de J4 à J1

**Ce que dit la vision.** Les quatre `confirm()` et `prompt()` sont listés au diagnostic §1 point 5,
et leur suppression est confiée à J4, chez Iris.

**Mon désaccord, et il est technique avant d'être esthétique.** `confirm()` et `prompt()` sont
**bloquants et non simulables**. Chacun est un mur au milieu d'un chemin de test :

- `js/ui.js:1709` : la sortie du mode chevet. Je ne peux pas tester automatiquement qu'on peut
  quitter la nuit, ni qu'on n'en sort pas par accident. C'est le chemin le plus sensible du produit,
  à 3 h du matin, et il est structurellement hors d'atteinte.
- `js/ui.js:1410` : l'import d'une sauvegarde. Le chemin de restauration, le seul filet de sécurité
  des données de l'utilisateur, n'est testable de bout en bout que jusqu'à ce mur.
- `js/studio.js:647` et `js/ui.js:540` / `js/studio.js:591` : suppression d'un départ, création d'une
  destination.

Un `confirm()` n'est donc pas seulement une contradiction de marque. C'est **une zone que la qualité
ne peut pas atteindre**, et elle se trouve pile sur les deux chemins les plus destructeurs de l'app :
perdre sa nuit, perdre ses données.

**Ce que je demande.** Un composant de confirmation maison, non bloquant, dans J1. Trente lignes,
Iris en fait la version définitive en J4. C'est aussi la chose que J1 retire, ce qui répond à la
règle « chaque jalon retire quelque chose » avec du concret plutôt qu'avec une métaphore.

### 6.3 La vision surestime le filet existant, et cette phrase précise doit être corrigée

**Ce que dit la vision.** §1, colonne « ce qui est solide » : « R1 à R5 ne sont pas des slogans : ils
sont exécutables, et `tests/copy.test.mjs` les fait respecter par la machine. Peu de produits ont
ça. »

**Mon désaccord.** La deuxième moitié de la phrase est fausse et c'est la moitié rassurante.
`copy.test.mjs` inspecte 246 chaînes statiques et 9 fonctions de `copy.js`. Il n'inspecte pas ce que
l'utilisateur lit : environ 49 littéraux français vivent hors de `copy.js` dans `ui.js`, `studio.js`,
`card.js` et `social.js` (`'Prénom'`, `'Canal préféré'`, `'Nouvelle étape'`, `'Durée en minutes'`,
`'Glisser pour réordonner'`, `'Ajouter un départ'`, `'Parti(e) à l\'heure'`, entre autres). Aucun ne
passe le filet. Et surtout : **R2 et R3, les deux règles qui ne vivent pas dans les chaînes, ne sont
soumises à aucune machine.** Sur cinq règles, une et demie sont réellement exécutables.

**Pourquoi j'insiste sur une phrase.** Parce qu'un document de vision fixe ce que l'équipe croit
acquis, et qu'on ne finance jamais la protection de ce qu'on croit déjà protégé. Je demande que le
paragraphe soit réécrit ainsi : « R1, R4 et R5 sont partiellement exécutables sur `copy.js`. R2 et R3
ne sont couvertes par rien. C'est le premier trou à boucher. » Ce n'est pas de la coquetterie de
rédaction : c'est la différence entre un J1 qu'on prend au sérieux et un J1 qu'on abrège parce que
« le plus dur est fait ».

**Un point d'accord franc, pour équilibrer.** Le classement du risque en §1 est juste et bien
ordonné, et le refus de la télémétrie est la bonne décision. La recette du §5 est le substitut que la
vision appelle de ses vœux au point 6 : pas de données, mais un protocole écrit, daté, signé, et
reproductible.

---

## 7. Deux défauts trouvés en construisant ce document

Je n'étais pas venu chercher des bugs. Le harnais en a sorti un en six assertions, ce qui est
l'argument le plus court possible en sa faveur.

### 7.1 Le clavier contourne entièrement R2, et empoisonne le modèle (R3)

**Où.** `js/ui.js:167-173`, dans `holdButton` :

```js
btn.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    haptics.buzz('confirm');
    onConfirm();          // aucun maintien, aucune garde e.repeat
  }
});
```

**Ce que ça fait.** Un `keydown` sur Entrée confirme **instantanément**, sans les 600 ms, quel que
soit `settings.confirmMode`. Et comme `e.repeat` n'est pas testé, la répétition automatique du
clavier envoie des dizaines de `keydown` par seconde.

**Reproduit, mesuré :**

```
R2 VIOLE : "Réveil" -> "Douche" apres un keydown de 0 ms
etapes traversees en 0 ms : Réveil > Douche > Tenue > Petit déjeuner > Sac > Clés, prêt·e
R3 VIOLE : 6 etapes confirmees en 0 ms, chacune ecrite a v=1 min
```

**Gravité.** Double, et la seconde est pire que la première.

1. **R2** : la matinée entière est brûlée en maintenant une touche. Le scénario n'est pas exotique :
   clavier Bluetooth, iPad, ou VoiceOver dont l'activation passe par ce chemin.
2. **R3** : `confirmNext` fait `Math.max(1, Math.round(...))`, donc chaque confirmation fantôme écrit
   `v = 1` dans `step.real`. Le FIFO garde 8 mesures. **Une seule touche maintenue suffit à remplir
   toute la mémoire d'une étape avec des mesures d'une minute**, et le moteur d'apprentissage y
   croira. C'est exactement le mode de panne décrit au §1.1 comme le pire du projet : différé,
   silencieux, et invisible depuis l'intérieur de l'app.

**Ce que je demande.** Correctif en J1, avec le test qui va avec. Le geste clavier doit exiger un
maintien réel (`keydown` démarre le minuteur, `keyup` l'annule, `e.repeat` est ignoré), ou basculer
explicitement sur le mode `tap` documenté de R2. **Ce point relève d'Iris** (accessibilité) et je ne
prescris pas la solution : je constate la violation, je fournis le test, elle tranche la forme.

### 7.2 La scène Nuit est atteignable par les réglages, ce que le §6 interdit

**Où.** `js/scene.js:15-19`, `resolveScene` retourne `pref` dès que `SCENES.includes(pref)`, et
`SCENES` contient `'night'`. L'interface de réglages ne propose que `auto`, `dawn`, `day`, `evening`
(`js/ui.js:1394-1396`), donc le chemin est fermé côté produit. Mais `backup.js` ne valide pas
l'énumération de `settings.scene` : un fichier de sauvegarde contenant `"scene": "night"` verrouille
l'app en quasi-noir toute la journée, hors mode chevet.

**Gravité.** Faible en probabilité, élevée en effet : app inutilisable, et rien dans l'interface ne
permet d'en sortir puisque « night » n'est pas un choix affiché. `resolveScene` n'a aucun test.

**Ce que je demande.** Trois lignes dans `backup.js` (restreindre l'énumération à `auto`, `dawn`,
`day`, `evening`), plus un test unitaire sur `resolveScene` qui affirme que `'night'` n'est jamais
retournée quels que soient l'heure et les réglages. Coût : une heure. Piège P7 fermé pour de bon.

---

## 8. Ce que je propose pour la semaine 1

| Jour | Livrable | Dépendance |
|---|---|---|
| J+1 | `.github/workflows/ci.yml` + `tests/service-worker.test.mjs`, verts, en protection de branche | Accès administrateur du dépôt |
| J+2 | `tests/helpers/tiny-dom.mjs` durci et documenté | aucune |
| J+3 à J+4 | `tests/live-r2.test.mjs` complet, les cinq chemins d'avancement | aucune |
| J+4 | `tests/render-copy.test.mjs` + inventaire des chaînes hors `copy.js`, remis à Camille | une heure avec Camille |
| J+5 | Régression volontaire du bug de la douche sur une branche jetable, pour éprouver le filet. Première recette courte consignée | un iPhone installé |

Ce que j'attends de la réunion : l'accord sur l'ordre du §6.1, la décision sur le §6.2, la correction
de la phrase du §6.3, et un iPhone de recette qui ne soit pas le téléphone personnel de quelqu'un.

---

*Milo Vasseur · Ce document a été écrit après exécution des 41 tests existants et de trois
prototypes de harnais. Aucun fichier du produit ni des tests n'a été modifié.*

# S0 · Ce qui saigne

**Jalon** : J0 · **Précède tout le reste** · **Coût estimé** : moins de 150 lignes cumulées

Huit défauts vérifiés dans le code. Aucun ne demande d'arbitrage de conception : ce sont des
choses cassées. Aucun n'était dans le document de vision d'ouverture, ce qui est le meilleur
argument en faveur de la réunion qui les a sortis.

**Règle de cette spec.** Un défaut, un commit, un test. Pas de regroupement, pas de
correction opportuniste en passant. Chaque test doit être **éprouvé au rouge** : on
réintroduit le défaut sur une branche jetable, on vérifie que le test le voit, on jette la
branche. Un test non éprouvé n'est pas un test.

---

## B1 · Les mesures du matin sont perdues si l'app est fermée

**Gravité : maximale.** L'app invite explicitement au geste qui détruit son apprentissage.

**Constat.** `departNow` (`js/ui.js:1088`) place `live.measurements` dans un objet `session`
qui n'existe qu'en mémoire, passé à `showTrip`. L'écran Trajet affiche « Tu peux fermer
l'app. Je redemanderai à la prochaine ouverture. » (`js/copy.js:256`). Au retour, la bannière
d'accueil (`js/ui.js:360-373`) appelle `confirmArrival` puis `showHomeFresh()` : elle ne
passe jamais par `showFeedback`. Or `onFeedback` (`js/predict.js:60`), unique chemin
d'écriture des mesures dans `step.real`, n'est appelé que depuis `showFeedback`
(`js/ui.js:1174`).

**Conséquence.** Le trajet est appris, la préparation ne l'est jamais, pour tout utilisateur
qui suit l'invitation de l'app. Le moteur d'apprentissage reste vide indéfiniment. C'est le
scénario nominal, pas un cas limite.

**Comportement attendu.** Les mesures sont persistées **au fil de l'eau, à chaque
confirmation**, et non à la fin de la session. Le bilan déclaratif ne conditionne plus
l'écriture des durées : il ne conditionne que `latenessScore`.

**Conception.** Ajouter à l'état un champ de session en cours, purgé comme `pendingTrip` :

```
pendingSession: { profileId, ctx, measurements: [ { stepKey, v } ], startedTs } | null
```

`confirmNext` (`js/ui.js:713`) écrit dans `pendingSession` à chaque confirmation non polluée.
`onFeedback` est scindé : `recordDurations(state, realDurs, ctx)` d'un côté, appelé au fil de
l'eau, et `recordOutcome(state, status, ctx)` de l'autre, appelé au bilan. Purge de
`pendingSession` après 8 h sans écriture, silencieuse, comme `pendingTrip`.

**Séparation à respecter.** `recordDurations` et `recordOutcome` sont purs et vivent dans
`js/predict.js`. Aucun DOM.

**Tests.**
- Une session confirmée jusqu'au départ, puis l'app est « fermée » (l'état est rechargé
  depuis le stockage) : les mesures des étapes confirmées sont présentes dans `step.real`.
- Une étape polluée par un imprévu (F6) n'écrit toujours rien (R3).
- Une session abandonnée en cours de route écrit les étapes déjà confirmées, et rien d'autre.
- `pendingSession` vieille de plus de 8 h est purgée sans écriture et sans message.

**Règles engagées** : R3 (c'est le correctif qui la rend effective), R5 (purge silencieuse).

---

## B2 · Le clavier contourne R2 et empoisonne le modèle

**Gravité : maximale.** Viole deux règles, dont la plus difficile à détecter.

**Constat.** `js/ui.js:167-173` :

```js
btn.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    haptics.buzz('confirm');
    onConfirm();          // aucun maintien, aucune garde e.repeat
  }
});
```

Un `keydown` confirme instantanément, sans les 600 ms, quel que soit `settings.confirmMode`.
Sans garde sur `e.repeat`, la répétition automatique du clavier envoie des dizaines
d'événements par seconde.

**Conséquence, reproduite par le harnais de Milo.** La matinée entière est traversée en
maintenant une touche. Et comme `confirmNext` fait `Math.max(1, Math.round(...))`, chaque
confirmation fantôme écrit `v = 1` dans `step.real`. Le FIFO garde 8 mesures : **une seule
touche maintenue remplit toute la mémoire d'une étape avec des durées d'une minute**, et le
moteur y croit. C'est le pire mode de panne du projet : différé, silencieux, invisible
depuis l'intérieur de l'app.

**Comportement attendu.** Le chemin clavier applique R2 comme le chemin tactile : `keydown`
arme le minuteur, `keyup` l'annule, `e.repeat` est ignoré sans effet. En mode `tap`, le
clavier suit le mode `tap`.

**Propriétaire.** Iris tranche la forme (elle traite le même composant en B3), Milo fournit
le test.

**Tests bloquants.**
- Espace maintenu n'avance que d'une étape.
- Une rafale de `keydown` avec `repeat: true` n'avance rien au-delà de la première.
- Après le scénario clavier, aucune valeur `v = 1` parasite n'existe dans `step.real`.

**Règles engagées** : R2, R3.

---

## B3 · Sous VoiceOver, l'app est inutilisable

**Gravité : maximale pour la population concernée.** Abandon au matin 1, étape 1.

**Constat.** En mode `hold`, `holdButton` (`js/ui.js:149-173`) n'écoute que `pointerdown`,
`pointerup`, `pointercancel` et `keydown`. **Aucun gestionnaire `click`.** L'activation
VoiceOver sur iOS synthétise une paire `pointerdown` / `pointerup` quasi instantanée, puis un
`click`. Le minuteur est donc annulé avant expiration, et le `click` ne trouve personne.

Même problème, aggravé, sur le mode chevet : `renderNight` (`js/ui.js:1693`) et
`renderWakeProposal` (`js/ui.js:1743`) posent leurs gestionnaires sur le `<main>`. Pas un
`<button>`, pas de `role`, pas de `tabindex`, pas de nom accessible.

**Conséquence.** Une personne aveugle ne peut ni confirmer une étape, ni régler la
luminosité nocturne, ni **sortir du mode chevet le matin**. Elle arme le chevet le soir et
ne peut pas l'éteindre.

**Comportement attendu.** Un chemin d'activation assistive existe, distinct du maintien, et
il satisfait R2 : il ne doit pas pouvoir se déclencher par accident. Conception détaillée
dans `S2-le-geste.md`. En J0 on livre le minimum vital : le chevet devient actionnable
(éléments focusables, nommés, activables), et le live cesse d'être un cul-de-sac.

**Rappel de DEC-08.** Le « tap simple » n'est pas une réponse à ce problème. C'est une option
de motricité. Le chemin assistif est une obligation distincte de R2, pas un réglage.

**Tests.** Un `click` synthétique isolé sur le bouton de confirmation produit exactement une
avance d'étape, ni zéro, ni deux. Le mode chevet expose au moins un élément focusable et
nommé sur chacun de ses écrans.

**Règles engagées** : R2, et l'obligation d'accès introduite par DEC-08.

---

## B4 · Fuite de Wake Lock : l'écran ne s'éteint plus jamais

**Gravité : élevée. Certaine dès le deuxième usage.**

**Constat.** `js/wakelock.js:16-30`. `release()` met `lock = null`, mais l'écouteur
`visibilitychange` posé par `bindVisibility()` n'est jamais retiré (il est gardé par le seul
drapeau `bound`). Son corps est `if (visible && !lock) acquire()`. Donc après **une** session
live ou **une** nuit de chevet, chaque retour au premier plan réacquiert un verrou d'écran,
sur n'importe quel écran, pour le reste de la vie de la page.

**Conséquence.** Batterie vidée en permanence, sur une app dont le pacte explicite est
« L'écran restera allumé pendant le guidage » (`js/copy.js:221`). On prend à l'utilisateur la
contrepartie exacte qu'on lui a demandée, sans le prévenir.

**Correctif.** Un drapeau `wanted`, remis à `false` par `release()` et consulté par le
gestionnaire. Cinq lignes.

**Test.** Après `acquire()` puis `release()`, un événement `visibilitychange` vers `visible`
ne réacquiert pas le verrou.

---

## B5 · `saveState()` sans garde, `history` sans FIFO

**Constat.** `js/store.js:213-215` : `localStorage.setItem` sans `try/catch`. Un
`QuotaExceededError` lève au milieu d'un `confirmNext()` et casse le matin en cours. Et
`history` croît sans borne, alors que `step.real` et `destinations` ont un FIFO de 8 : c'est
`history` qui alimente le dépassement de quota.

**Correctif.** `try/catch` autour de l'écriture, échec silencieux plutôt que matin cassé
(R5). FIFO sur `history`, borné à 200 entrées, appliqué aussi dans `migrate()` et à
l'import.

**Test.** Un `setItem` qui lève ne propage pas l'exception. `history` ne dépasse jamais 200
entrées après 500 sessions.

---

## B6 · Repli mort du service worker

**Constat.** `service-worker.js:83` : `.catch(() => cached)`. Dans cette branche, `cached`
vaut `undefined` par construction, puisqu'on n'y arrive que si `caches.match` n'a rien
trouvé.

**Conséquence.** Hors-ligne, une ressource absente du cache produit un **écran blanc**, pas
une dégradation.

**Correctif.** Repli explicite : pour une navigation, servir `./index.html` depuis le cache ;
sinon, une réponse d'erreur construite. Jamais `undefined`.

**Test.** Une requête hors-ligne pour une ressource non cachée renvoie une réponse valide.

---

## B7 · La destination choisie le matin n'est jamais retenue

**Constat.** `js/ui.js:511` **lit** `profile.defaults.destinationId`, mais les lignes 529,
534 et 543 n'écrivent que dans l'objet local `data`. Seul `js/studio.js` persiste dans
`profile.defaults`. Or `confirmArrival` (`js/travel.js:51`) refuse d'écrire sans destination.

**Conséquence.** Pour qui passe par l'Aperçu et ne va jamais dans le Studio, la boucle
d'apprentissage du trajet (F5) ne se ferme **jamais**. Le trajet déclaré n'est corrigé
nulle part, ce qui explique en partie l'écart mesuré dans les simulations du chantier moteur.

**Correctif.** L'Aperçu persiste le choix de destination et de transport dans
`profile.defaults` au lancement de la session.

**Test.** Après une session lancée depuis l'Aperçu avec une destination choisie, l'état
rechargé porte cette destination dans `profile.defaults.destinationId`.

---

## B8 · La scène Nuit est atteignable par un import

**Constat.** `js/scene.js:15-19` : `resolveScene` retourne `pref` dès que `SCENES.includes(pref)`,
et `SCENES` contient `'night'`. L'interface ne propose que `auto`, `dawn`, `day`, `evening`
(`js/ui.js:1394-1396`), donc le chemin produit est fermé. Mais `js/backup.js` ne valide pas
l'énumération de `settings.scene` : une sauvegarde contenant `"scene": "night"` verrouille
l'app en quasi-noir toute la journée, hors mode chevet, sans aucun moyen d'en sortir par
l'interface.

**Correctif.** Restreindre l'énumération à l'import, et surtout garantir l'invariant à la
source : `resolveScene` ne retourne jamais `'night'`, quels que soient l'heure et les
réglages. La scène Nuit n'est atteignable que par le mode chevet.

**Test.** `resolveScene` ne retourne jamais `'night'` sur l'ensemble des combinaisons
réglage × heure. Un import contenant `"scene": "night"` est normalisé.

**Piège fermé** : `CLAUDE.md` §6, « Scène Nuit par l'horloge ».

---

## Critère de sortie de J0

Les huit défauts corrigés, chacun avec son test, chaque test éprouvé au rouge. Les 41 tests
existants toujours verts. Aucune découpe, aucun renommage, aucune amélioration opportuniste
dans ces commits.

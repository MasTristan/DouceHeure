# R1 · Léa Ferrand · Recherche produit et TDAH vécu

**Jalon possédé** : J2, La première semaine.
**Objet** : diagnostic du parcours jour 1 à jour 7, analyse du vice de l'estimation initiale,
trois propositions, protocole de validation sans télémétrie, désaccords.
**Statut** : document de travail, aucune ligne de produit modifiée.

---

## 0. Méthode, et ce que je considère comme vérifié

J'ai lu `CLAUDE.md`, `docs/00-vision.md`, `js/copy.js`, `js/ui.js` en entier (2 006 lignes),
`js/store.js`, `js/predict.js`, `js/plan.js`, `js/travel.js`, `js/bedside.js`, `js/backup.js`,
`js/app.js` et `js/studio.js`. Les 41 tests node passent.

Trois niveaux de preuve dans ce document, et je les distingue partout :

- **[CODE]** : lisible directement dans un fichier, avec la ligne. Non discutable.
- **[SIM]** : résultat d'une simulation que j'ai exécutée sur le code réel, avec une hypothèse
  d'utilisateur explicitée. Le calcul est exact, l'hypothèse est un choix.
- **[HYP]** : hypothèse de recherche. Non prouvée, à tester par le protocole de la section 4.

La simulation de référence utilisée dans tout le document : profil « Matin classique » par
défaut, arrivée 09:00, à pied, `latenessScore` initial 0,5, aucune destination, et un
utilisateur dont les durées réelles sont wakeup 12, douche 25, tenue 14, petit déjeuner 18,
sac 9, prêt 5. Soit 83 minutes réelles contre 52 minutes d'estimations par défaut, un écart
de 31 minutes. Cet écart n'est pas une provocation : c'est l'ordre de grandeur usuel de la
sous-estimation chez une personne en cécité temporelle, et c'est précisément la population
cible. Un utilisateur qui ne sous-estime pas n'a pas besoin de ce produit.

---

## 1. Diagnostic du parcours jour 1 à jour 7

### 1.1 La chaîne réelle d'écrans, telle qu'elle est câblée

Ce que traverse un testeur au premier matin, dans l'ordre, tiré du code :

`showOnboarding` screen1 (prénom) → screen2 (archétype, arrivée, transport) → screen3 (geste,
voix) → `showHome` → `showPreview` → `startLive` / `renderLive` → `renderLeave` → `departNow`
→ `showTrip` → `showFeedback` → `showCardOffer` → `showMornings`.

Douze surfaces avant de retrouver l'accueil. La vision parle de « onze surfaces » pour le
produit entier : en comptant les rendus réels (`render(...)` avec une clé d'écran distincte),
j'en compte dix-sept, dont quatre sur le seul chemin post-arrivée. Ce n'est pas un détail de
comptage : **le premier matin se termine par quatre écrans consécutifs après que la personne
est arrivée**, c'est-à-dire au moment exact où elle n'a plus aucune raison de tenir son
téléphone.

### 1.2 Jour 1 : l'app donne une heure de lever fausse de 24 minutes, puis l'oublie

**a) L'onboarding ne demande aucune durée, et c'est plus grave que s'il en demandait.**
[CODE] `showOnboarding` (`js/ui.js:180-336`) collecte : prénom, archétype, heure d'arrivée,
transport, mode de confirmation, voix. Rien d'autre. Les durées viennent de `DEFAULT_STEPS`
(`js/store.js:19-27`) : réveil 5, douche 15, tenue 10, petit déjeuner 12, soins 10, sac 6,
prêt 4. Ce sont les durées d'une personne fictive et moyenne. Le `latenessScore` initial est
codé en dur à 0,5 (`js/store.js:93`), jamais demandé, jamais expliqué.

Le mandat que j'ai reçu dit « l'onboarding demande à l'utilisateur combien de temps prennent
ses étapes ». Ce n'est pas le cas, et je corrige : **l'onboarding ne demande rien et décide à
sa place**. La saisie de durée existe, mais ailleurs et plus tard, dans le studio
(`js/studio.js:397-411`, slider de 2 à 60 minutes). Cette correction n'atténue pas le
diagnostic, elle le déplace : le produit ne souffre pas d'une mauvaise question, il souffre
d'une absence de question suivie d'une réponse inventée.

**b) L'écran Aperçu affiche la conséquence de cette invention en gros caractères.**
[CODE] `showPreview` (`js/ui.js:500-626`) construit le plan et titre
`UI.preview_subtitle(fromMin(plan.startMin))`, soit « Lève-toi vers HH:MM ». C'est la
première affirmation forte que l'app fait sur la vie de la personne.

[SIM] Avec les hypothèses ci-dessus : lever 07:37, départ 08:29, marge interne 7 minutes.
L'utilisateur qui suit son vrai rythme sort à 09:00 et arrive à **09:24**. Vingt-quatre
minutes de retard, produits par l'app, au premier matin, pour quelqu'un qui l'a installée
pour ne plus être en retard.

**c) L'Aperçu impose quatre décisions, à l'heure du lever.**
[CODE] Heure d'arrivée (`input type=time`), transport (4 pilules), destination (n pilules +
« + Nouvelle destination »), trajet estimé (`input type=number`, valeur initiale 20 en dur,
`js/ui.js:510`). Puis une frise de 7 lignes horodatées, puis un encart Wake Lock, puis deux
boutons.

C'est l'écran que je conteste le plus fort, et c'est là que j'utilise mon veto : **quatre
décisions numériques et catégorielles, entre le réveil et la première action**. Pour une
personne en cécité temporelle, l'heure du lever est le pire moment cognitif de la journée.
Cet écran est aussi celui qui suit immédiatement le mode chevet (`renderGoodMorning` →
`showPreview`, `js/ui.js:1798`) : la première chose que l'app propose après avoir dit
« Bonjour » est un formulaire.

**d) L'heure de lever affichée peut être déjà passée, sans que rien ne le dise.**
[CODE] `plan.startMin` n'est jamais comparé à l'heure courante dans `showPreview`. Une
personne qui ouvre l'app à 07:50 lit « Lève-toi vers 07:37 ». Le produit dont la promesse est
l'honnêteté et l'absence de reproche affiche donc, à la personne déjà en retard, une heure
passée présentée comme une consigne. Ce n'est pas culpabilisant par les mots (R5 est tenue au
sens strict), c'est culpabilisant par la situation.

**e) Le premier matin se termine sur « Encore rien ».**
[CODE] `showFeedback` → `showCardOffer` (`js/ui.js:1180`), dont le bouton secondaire
« Pas cette fois » mène à `showMornings` (`js/ui.js:1254`). Sur cet écran, la carte « Ce que
l'app a appris » exige `step.real.length >= 3` (`js/ui.js:1295`) : au jour 1 elle affiche
`UI.mornings_learned_empty`, « Encore rien. Quelques matins et ça vient. »

La phrase est juste, honnête, bien écrite. Le problème est son emplacement : c'est le dernier
mot du premier matin, après quatre écrans, chez quelqu'un qui vient de se demander si tout ça
valait le coup.

### 1.3 Jours 2 et 3 : le moment où le testeur tranche, et où l'app n'a encore rien à montrer

**a) La correction est lente par construction, et le premier signe visible arrive au jour 3.**
[CODE] `predict` (`js/predict.js:14-28`) : `w = Math.min(real.length / 5, 1)` et
`dur = est * (1 - w) + mean * w`. Le poids atteint 1 à **cinq** mesures, pas huit. La FIFO de
8 (`js/predict.js:79`) est la longueur de mémoire, pas le délai de convergence.

Je corrige donc aussi la formulation de la vision : ce ne sont pas « environ huit matins pour
avoir un avis », ce sont **cinq matins mesurés pour cesser d'être dominé par un a priori
faux**, et la valeur n'est jamais purement réelle avant la cinquième. Sur une semaine avec un
week-end, cinq matins mesurés en semaine, c'est jour 7 au plus tôt.

[SIM] Trajectoire de l'arrivée réelle, mêmes hypothèses, sans rattrapage :

| Matin | Heure de lever affichée | Marge interne | Somme des durées du plan | Arrivée réelle |
|---|---|---|---|---|
| J1 | 07:37 | 7 | 52 | 09:24 (+24) |
| J2 | 07:29 | 9 | 58 | 09:16 (+16) |
| J3 | 07:22 | 10 | 64 | 09:09 (+9) |
| J4 | 07:15 | 10 | 71 | 09:02 (+2) |
| J5 | 07:09 | 10 | 77 | 08:56 (-4) |
| J6 | 07:04 | 9 | 83 | 08:51 (-9) |
| J7 | 07:05 | 8 | 83 | 08:52 (-8) |

L'app devient juste au sixième matin. Le testeur tranche au troisième, où elle le fait encore
arriver avec neuf minutes de retard. **La courbe d'apprentissage et la courbe de patience se
croisent après le point d'abandon.** C'est, en une phrase, tout le problème de J2.

**b) Le seul signal visible d'apprentissage arrive au troisième matin, et il est minuscule.**
[CODE] Le badge `UI.preview_learned` (« Calé sur tes vraies durées. ») exige
`s.confidence > 0 && s.real.length >= 2` (`js/ui.js:555`) : il apparaît donc au matin 3, en
petit, sous le libellé de chaque étape, dans une frise de 7 lignes. C'est un badge répété
jusqu'à huit fois, pas un message. Rien, nulle part, ne dit à la personne « je te connais
mieux qu'hier ».

**c) Le rattrapage sauve le matin et empêche l'apprentissage.**
[CODE] `rescueCandidates` (`js/plan.js:89-93`) ne propose que les étapes `kind: 'comfort'`.
Dans le profil par défaut, ce sont exactement douche, petit déjeuner et soins. Une étape
sautée n'écrit aucune mesure (`js/ui.js:838`, R3 correctement appliquée).

[SIM] Avec la même hypothèse et acceptation du rattrapage quand il est proposé : le
rattrapage se déclenche au matin 1, juste après la douche, et coupe le petit déjeuner.
L'arrivée passe de 09:24 à 09:06, ce qui est une vraie réussite produit. Mais le petit
déjeuner a alors **une mesure de retard permanente** sur toutes les autres étapes, visible
jusqu'au septième matin (6 mesures contre 7).

Autrement dit : le mécanisme de sauvetage du matin agit préférentiellement sur les étapes les
plus longues et les plus sous-estimées, et le prix payé est de ne jamais les mesurer. Plus
l'app a besoin d'apprendre une étape, plus elle a de chances de la couper. Ce n'est pas un bug,
c'est une boucle de rétroaction négative structurelle, et elle est invisible dans les tests
actuels parce qu'aucun test ne simule une semaine.

### 1.4 Jours 4 à 7 : le trajet, la promesse la plus vendeuse, est inatteignable par défaut

`UI.preview_travel_known` (« Le trajet, je connais. Je m'en occupe. ») est la meilleure phrase
du produit après « C'est le deal ». C'est le moment où l'app cesse d'être un post-it. Or
[CODE] :

1. `confirmArrival` (`js/travel.js:59-60`) refuse toute écriture si
   `getDestination(state, trip.destinationId)` est nul. Sans destination explicite, **aucune
   mesure de trajet n'est jamais écrite**.
2. `showPreview` initialise `destinationId: profile.defaults.destinationId || null`
   (`js/ui.js:511`). Or **aucun chemin de `ui.js` n'écrit jamais dans
   `profile.defaults.destinationId`** : `grep` sur `defaults\.` dans `js/ui.js` ne rend que
   `arrival` et `transport` (lignes 199-200). Seul le studio l'écrit
   (`js/studio.js:580, 585, 594`).
3. Conséquence : une destination créée depuis l'Aperçu est bien ajoutée à `state.destinations`,
   mais **le lendemain matin la sélection est repartie à zéro**. La personne doit re-choisir
   sa destination chaque matin, sans jamais comprendre pourquoi.
4. Même chose pour le trajet déclaré : `data.travel` est une variable locale
   (`js/ui.js:510`), jamais persistée nulle part. La valeur 20 revient tous les matins.

Le chemin qui mène à « Le trajet, je connais » est donc : ouvrir l'Aperçu, toucher
« + Nouvelle destination », répondre à un `prompt()` natif iOS (`js/ui.js:540`), puis
recommencer la sélection chaque matin pendant au moins cinq matins, sans jamais être guidé
vers ce chemin. [HYP] Je fais l'hypothèse que le taux de testeurs qui atteignent
naturellement cette phrase en quatorze jours est proche de zéro, et c'est la première chose
que je veux mesurer.

### 1.5 Le défaut le plus grave n'est pas un choix produit, c'est une perte de données

[CODE] `live.measurements` est un tableau en mémoire, alimenté à chaque confirmation
(`js/ui.js:720`). Il n'est écrit dans `localStorage` qu'au bout de la chaîne, dans
`showFeedback` → `submit` → `onFeedback` → `saveState` (`js/ui.js:1174-1177`).

Entre les deux, il y a `departNow` (`js/ui.js:1088`), qui persiste **uniquement** le
`pendingTrip`, puis `showTrip`, qui affiche
`UI.trip_close_hint` : « **Tu peux fermer l'app.** Je redemanderai à la prochaine ouverture. »

Et à la réouverture, la bannière « Bien arrivé(e) ? » de l'accueil appelle `confirmArrival`
puis `showHomeFresh()` (`js/ui.js:365-372`) : elle ne mène jamais au bilan.

Donc : **l'app invite explicitement l'utilisateur à faire le geste qui détruit toutes les
mesures du matin.** Sur iOS, une PWA au premier plan pendant vingt minutes de marche, écran
allumé par Wake Lock, dans une poche, c'est un scénario improbable. Le chemin nominal réel est
celui qui perd les données. Seule la mesure de trajet survit, et seulement si une destination
était sélectionnée, ce qui est déjà rare (1.4).

Impact sur J2, chiffré : chaque matin perdu, c'est un cinquième du poids d'apprentissage
(`w = n/5`). Perdre deux matins sur sept, c'est repousser la convergence d'une semaine
entière, c'est-à-dire au-delà de tout horizon de test.

C'est aussi, accessoirement, une contradiction directe avec R5 : l'app promet
« Je retiens le trajet » (`COPY.trip_arrived`) et « Je note » (`COPY.feedback_early`) dans des
situations où elle ne retient rien.

### 1.6 Trois autres défauts vérifiés, à corriger sans débat

- [CODE] **Contamination du week-end.** Dans `predict`, `pool` est filtré sur
  `r.day === ctx.day || r.type === ctx.type`, mais si `pool.length < 2` on retombe sur `real`
  entier, tandis que `w` est calculé sur `real.length` et non sur `pool.length`
  (`js/predict.js:21-26`). Un testeur qui commence un samedi et un dimanche arrive au lundi
  avec un poids de 0,4 sur des mesures de week-end, présentées comme du contexte « travail ».
  Périmètre Sacha (J3), mais l'effet se produit dans la première semaine, donc je le signale ici.
- [CODE] **`varBoost` est inerte au démarrage à froid.** `buildPlan` calcule
  `varBoost = 1.5` pour une destination jamais mesurée (`js/plan.js:27`), puis l'applique à
  `totalVariance * 0.8 * varBoost` (`js/predict.js:53`). Au jour 1, `totalVariance` vaut 0 :
  `0 * 1,5 = 0`. Le gonflement de +50 % documenté dans `CLAUDE.md` §8 n'a **aucun effet dans
  le seul cas pour lequel il a été écrit**. Vérifié : `safetyMargin(0, 0.5, 1)` et
  `safetyMargin(0, 0.5, 1.5)` rendent tous deux 7.
- [CODE] **Deux `prompt()` et quatre `confirm()` natifs**, dont celui de création de
  destination sur le chemin critique de l'apprentissage du trajet (`js/ui.js:540`,
  `js/studio.js:591`). Périmètre Iris (J4), mais il est sur mon chemin, donc je le compte
  dans mes retraits.

---

## 2. Le problème de l'estimation initiale

### 2.1 Reformulation exacte du vice

Le vice n'est pas « on demande une estimation à quelqu'un qui estime mal ». C'est :

> **L'app prend une décision à fort enjeu (l'heure de lever) à partir d'une valeur qu'elle n'a
> ni mesurée, ni demandée, ni annoncée comme incertaine, et elle l'affiche avec exactement la
> même assurance typographique que la valeur apprise du septième matin.**

Trois défauts empilés, dans cet ordre de gravité :

1. **La source.** `est` est une moyenne de personne fictive (`DEFAULT_STEPS`). Pour la
   population cible, elle est systématiquement basse.
2. **La confiance.** L'app ne distingue nulle part une durée inventée d'une durée mesurée, ni
   dans le calcul de la marge, ni dans l'affichage.
3. **Le recours.** Le seul moyen de corriger est un slider de minutes dans le studio, c'est-à-dire
   **redemander une estimation de durée à une personne en cécité temporelle**, ce qui est la
   question à laquelle elle répond le plus mal au monde.

### 2.2 Le cœur du problème : zéro donnée est lu comme zéro incertitude

C'est le point technique le plus important de ce document.

[CODE] `predict` rend `{ dur: step.est, variance: 0, confidence: 0 }` quand il n'y a aucune
mesure (`js/predict.js:16-18`). Et `safetyMargin` est construite sur la variance
(`js/predict.js:52-56`). Donc :

> **La marge de sécurité invisible est à son minimum exactement au moment où l'incertitude est
> à son maximum.**

Au jour 1 : `safetyMargin(0, 0.5)` = `round(3 + 0 + 4)` = **7 minutes**. Au jour 6, quand
l'app connaît vraiment la personne, la marge est plus grande. C'est l'inverse de ce qu'il
faut. Une absence de mesure n'est pas une variance nulle, c'est une variance inconnue, et une
variance inconnue doit coûter cher.

Ce seul défaut explique une bonne partie de l'écart de 24 minutes du jour 1, et il se corrige
entièrement dans la logique métier pure, sans une seule ligne d'interface, sans un mot affiché,
sans aucune décision supplémentaire le matin. C'est le meilleur rapport effet / risque de tout
le cycle.

### 2.3 Mais la marge seule ne peut pas suffire, et il faut le dire avant de s'y fier

[CODE] `fromVar` est plafonné à 10 (`Math.min(totalVariance * 0.8 * varBoost, 10)`) et
`fromLate` à 8 (`latenessScore` ∈ [0,1]). La marge invisible ne peut donc **jamais dépasser
3 + 10 + 8 = 21 minutes**, quelles que soient les données.

Or l'erreur de départ dans ma simulation est de 31 minutes. **Aucun réglage de la marge ne
peut absorber une sous-estimation systématique de la somme des étapes.** J'ai vérifié : avec
une variance a priori généreuse au démarrage à froid, la marge sature à son plafond de 21 et
l'arrivée du jour 1 passe de 09:24 à 09:14. Mieux, mais toujours en retard.

Conclusion, et c'est la charnière de tout J2 : **il faut les deux**, une marge honnête face à
l'ignorance ET un point de départ moins faux. Livrer l'un sans l'autre ne fait pas arriver
quelqu'un à l'heure au premier matin.

### 2.4 Comment obtenir un meilleur point de départ sans violer R1 ni R3

Les contraintes, telles que je les lis :

- **R3** interdit d'écrire quoi que ce soit dans `step.real` qui ne soit pas mesuré entre deux
  confirmations. Elle **n'interdit pas** de choisir une meilleure valeur d'`est` : c'est
  exactement ce que fait déjà le slider du studio. La frontière est nette et elle est dans le
  modèle de données : `est` est une configuration, `real` est une mesure. Je ne toucherai
  jamais à `real`.
- **R1** interdit toute durée restante affichée ou prononcée, et autorise explicitement une
  heure cible. Poser une question à la configuration n'est pas un décompte.
- Mon propre veto interdit d'ajouter une décision le matin. Toute question de calibrage doit
  vivre dans l'onboarding ou le studio, jamais dans l'Aperçu.

**Le principe : ne jamais demander une durée, demander deux heures d'horloge.**

Les personnes en cécité temporelle estiment très mal les intervalles et se souviennent
correctement des évènements horodatés. « Combien de temps prend ta douche ? » est la mauvaise
question. « La dernière fois que tu es parti à l'heure, tu t'es levé à quelle heure, et tu es
sorti à quelle heure ? » est deux fois la même question facile, et leur différence donne un
total observé, jamais saisi comme une durée. Ce total sert à mettre à l'échelle les `est` de
l'archétype, proportionnellement. Aucune écriture dans `real`. Aucun chiffre affiché en
retour, seulement une heure de lever, autorisée par R1.

**La règle de sécurité qui va avec, et qui n'est pas négociable de mon côté : la mise à
l'échelle ne peut que monter, jamais descendre.** `scale = max(1, total_observé / somme_est)`.
Raison : l'erreur de rappel va dans le même sens que l'erreur d'estimation, vers le bas. Et
l'asymétrie des coûts est totale. Arriver vingt minutes trop tôt coûte du confort, et l'app
sait déjà absorber ça sans presser (état `suggested`, aucun décompte). Arriver vingt minutes
trop tard coûte le travail, la confiance, et le testeur. Une app d'aide à la ponctualité qui
se trompe doit se tromper dans un seul sens.

Et c'est réversible sans intervention : [SIM] un plan volontairement gonflé à 83 minutes chez
quelqu'un qui en prend réellement 52 converge vers 52 en cinq matins mesurés, exactement comme
dans l'autre sens. La sur-estimation s'auto-corrige en silence ; la sous-estimation
s'auto-corrige aussi, mais en produisant trois matins de retard visibles avant d'y arriver.

**Ce que je refuse explicitement, et pourquoi :**

- **Demander à l'utilisateur d'estimer ses durées, mieux ou autrement.** Le formuler autrement
  ne change pas qu'on interroge la faculté déficiente. Je veto toute variante.
- **Chronométrer un matin « à blanc » avant de donner un plan.** Cela ferait de J1 une journée
  sans service, et le testeur nous quitte avant d'avoir reçu quoi que ce soit.
- **Injecter les valeurs par défaut d'un archétype dans `real` pour « amorcer » le modèle.**
  Violation frontale de R3, et le piège nommé « Mesures théoriques injectées » de `CLAUDE.md`
  §6. Je le mentionne parce que c'est la solution que tout le monde propose en réunion, et
  qu'il faut qu'elle soit refusée par écrit une fois pour toutes.
- **Faire dire à l'app qu'elle a « pris de la marge ».** R4 et le test
  `tests/copy.test.mjs` l'interdisent, et ils ont raison.

---

## 3. Trois propositions

Chaque proposition indique ce qu'elle retire. C'est la règle de la vision et je la trouve
bonne, avec une réserve que je développe en 5.2.

---

### P1 · L'ignorance coûte cher, et de moins en moins

**Problème traité** · §2.2. La marge invisible est minimale au jour 1 et maximale au jour 6 :
exactement l'inverse du besoin. Et `varBoost` est inerte au démarrage à froid (§1.6).

**Comportement attendu** · `predict` et `predictTravel` cessent de rendre `variance: 0` en
l'absence de mesure. Elles rendent une **variance a priori** décroissante avec la confiance,
proportionnelle à la durée de l'étape (une étape de 25 minutes est plus incertaine qu'une
étape de 4). Formulation à figer avec Sacha, forme visée :
`variance = spread_mesuré * confidence + prior(est) * (1 - confidence)`.
Conséquence mécanique : la marge est large au premier matin et se resserre à mesure que l'app
mesure. `varBoost` disparaît, remplacé par le même mécanisme, cette fois non nul.

Rider éditorial, à écrire par Camille : **une phrase, une seule, sur l'Aperçu**, pilotée par la
confiance globale du plan et sans aucun chiffre. Trois états, du type « Je ne te connais pas
encore. Je prends large. » / « Je commence à te connaître. » / « Je te connais. » C'est la
traduction visible du mécanisme invisible, et c'est exactement l'honnêteté que la vision
réclame en §2. R4 tient : on ne nomme ni la marge, ni un seuil, ni une durée.

**Écrans et modules touchés** · `js/predict.js`, `js/plan.js` (suppression de `varBoost`),
`js/copy.js` (trois chaînes), `js/ui.js` `showPreview` (une ligne de rendu). Aucun nouvel
écran, aucune décision ajoutée.

**Coût** · **S** pour le moteur, **S** pour la copie. Le vrai coût est le banc de calibration
sur historiques simulés, qui est déjà prévu en J3 et que je demande à anticiper.

**Ce qu'on retire** · Le paramètre `varBoost` et sa branche dans `buildPlan` : du code mort
en pratique, qui donne l'illusion qu'un problème est traité. Et les **badges
« Calé sur tes vraies durées. » répétés jusqu'à huit fois** dans la frise de l'Aperçu
(`js/ui.js:555-556`), remplacés par la phrase unique. Huit signaux faibles contre un signal
lisible.

---

### P2 · Un matin ne se perd jamais parce que l'app s'est fermée

**Problème traité** · §1.5. Les mesures du matin sont détruites si l'app est fermée entre
« Je pars » et le bilan, alors que l'app invite explicitement à la fermer.

**Comportement attendu** ·

1. **À chaque confirmation**, la mesure est écrite dans l'état persistant, dans la clé unique
   existante, sous une entrée `pendingSession` (mêmes garanties que `pendingTrip` :
   horodatée, purgée en silence après 4 h par `purgeExpiredTrip`, jamais de toast d'erreur).
   R3 est respectée à la lettre : ce sont des durées réellement mesurées entre deux
   confirmations, et l'étape polluée par un imprévu continue de n'écrire rien.
2. **À la réouverture**, si une `pendingSession` existe et qu'elle est fraîche, la bannière
   « Bien arrivé(e) ? » déjà présente sur l'accueil devient l'entrée unique de la fin de
   matin : elle confirme le trajet **et** enchaîne sur le bilan. Le `latenessScore` et
   l'historique restent écrits au bilan, comme aujourd'hui ; seules les durées mesurées sont
   sauvées plus tôt.
3. **Corollaire obligatoire** : `profile.defaults.destinationId` et le trajet déclaré sont
   persistés depuis l'Aperçu (§1.4). Sans ça, la boucle du trajet ne se ferme jamais.

**Écrans et modules touchés** · `js/store.js` (un champ dans le schéma v2, pas de nouvelle
clé), `js/travel.js` ou un petit module de session, `js/ui.js` `confirmNext`, `departNow`,
`showHome`. Aucun nouvel écran : la bannière existe.

**Coût** · **M**. C'est du travail sur le chemin le plus sensible du produit, donc il ne part
pas avant que les tests DOM de non-régression R2 de Milo existent. Je ne demande pas à sauter
cette garantie.

**Ce qu'on retire** · **La carte du matin sort du chemin critique.** `showCardOffer` n'est plus
appelée automatiquement après chaque bilan (`js/ui.js:1180`) ; elle devient une action offerte
depuis « Tes matins ». Le chemin post-arrivée passe de quatre écrans à deux. On retire aussi
le bouton fantôme « Le bilan » de l'écran Trajet (`js/ui.js:1163`), qui existait pour rattraper
un chemin devenu inutile.

---

### P3 · Le calibrage d'ouverture, deux heures d'horloge, plus jamais une durée

**Problème traité** · §2.1 et §2.3. Le point de départ est celui d'une personne fictive, et la
marge ne peut pas absorber l'écart.

**Comportement attendu** ·

1. Dans l'onboarding **existant**, écran 2, après le choix de l'archétype et sur la même
   surface : deux champs `type=time`, formulés autour d'un souvenir et non d'une évaluation.
   Rédaction à faire par Camille, intention : « Ton dernier matin qui s'est bien passé : tu
   t'es levé(e) à … et tu es sorti(e) à … ». Les deux champs sont sautables ; sautés, on garde
   le comportement actuel.
2. La différence donne un total observé. Les `est` de l'archétype sont mis à l'échelle
   proportionnellement, avec `scale = max(1, total / somme_est)` (§2.4). **Écriture dans `est`
   uniquement, jamais dans `real`.**
3. Aucun retour chiffré. La seule restitution est l'heure de lever de l'Aperçu, déjà autorisée
   par R1.
4. Les étapes libres créées ensuite héritent d'un `est` neutre dérivé du profil calibré, au
   lieu d'être saisies à la main.

**Écrans et modules touchés** · `js/ui.js` `showOnboarding` screen2, `js/store.js` (une
fonction pure `calibrateSteps(steps, totalObserved)`, testable), `js/copy.js`. **Aucun nouvel
écran.**

**Coût** · **M**. La fonction de calibrage est triviale et testable ; le coût réel est
rédactionnel, parce que la question doit convoquer un souvenir sans induire de réponse et sans
jamais ressembler à un jugement (R5).

**Ce qu'on retire** · **Le slider de durée par étape disparaît du studio**
(`js/studio.js:397-411`). C'est le retrait que je défends le plus fort : à partir de P3,
**l'utilisateur ne saisit plus jamais une durée d'étape, nulle part, dans tout le produit**.
Il donne deux heures d'horloge une fois, et l'app mesure le reste. Cela retire une décision
mal posée, une source d'erreur systématique, un slider, et une ligne de code par étape.

---

**Ordre que je défends** : P1, puis P2, puis P3. P1 rend le jour 1 moins dangereux pour un
coût minuscule et sans toucher au rendu. P2 rend toute mesure ultérieure fiable, donc conditionne
la validité du protocole de la section 4. P3 est le plus visible mais le moins urgent, parce
que son effet est nul si les mesures se perdent encore.

---

## 4. Protocole de validation sans télémétrie

### 4.1 Le principe, et ce qu'il faut assumer d'entrée

L'app ne collecte rien et ne doit rien collecter. Le substitut n'est pas une télémétrie
déguisée : c'est **l'export JSON déjà livré (F7) plus la parole des testeurs**, les deux
transmis volontairement par la personne, à son rythme, par le canal de son choix. Aucune
requête réseau n'est ajoutée, aucun code de recherche n'entre dans le produit.

Il faut assumer une limite d'entrée : **avec la taille de panel qu'on peut réellement tenir,
on ne mesurera pas un taux d'abandon, on identifiera un mécanisme d'abandon.** Un protocole
qui prétendrait mesurer une rétention avec six personnes serait de la fausse rigueur. Ce qu'on
cherche est causal, pas statistique : *à quel écran, à quel matin, et pour quelle raison
dite dans ses mots, une personne cesse d'ouvrir l'app.*

### 4.2 Panel

**Six à huit testeurs**, iPhone, app installée sur l'écran d'accueil via Safari. Critères :

- au moins quatre personnes avec un TDAH diagnostiqué ou auto-identifié, et une cécité
  temporelle qu'elles décrivent spontanément ;
- au moins deux personnes n'ayant jamais utilisé d'app de routine matinale, pour ne pas ne
  tester que des gens déjà équipés de stratégies ;
- une contrainte horaire réelle au moins quatre jours par semaine, avec une conséquence en cas
  de retard ;
- **exclusion** des personnes déjà ponctuelles : elles ne peuvent pas échouer, donc elles ne
  peuvent rien nous apprendre ;
- deux profils de trajet différents au moins, dont un en transports en commun (le buffer de 14
  minutes et la variance réelle y sont les plus fortes).

**Quatorze jours.** Justification tirée du code, pas du confort : cinq matins mesurés sont
nécessaires pour que `w` atteigne 1 (§1.3), le week-end interrompt la série, et il faut de la
marge pour au moins un matin raté sans invalider le test.

### 4.3 Ce qu'on leur demande

- **Utiliser l'app tous les matins ouvrés**, sans consigne particulière, et **sans consigne de
  ne pas l'abandonner**. Il faut leur dire explicitement, par écrit, qu'arrêter de s'en servir
  est un résultat autorisé et attendu, pas un échec de leur part. Sinon on mesure la
  politesse.
- **Un mémo vocal de 90 secondes maximum, juste après être arrivé.** Vocal, jamais un
  formulaire : demander à quelqu'un de taper un questionnaire à 8 h 40 en arrivant au travail,
  c'est fabriquer un abandon supplémentaire. Une question par jour, tournante, dont
  systématiquement : *« à quelle heure devais-tu être là, à quelle heure y étais-tu »*, en
  heures d'horloge, jamais en durée, pour les raisons de §2.4.
- **Quatre exports JSON**, à J1 au soir, J3, J7 et J14. Envoyés par le canal de leur choix.
  **Cette cadence n'est pas négociable** et voici pourquoi : `step.real` est une FIFO de 8
  (`js/store.js:52`). Sur un test de quatorze jours, **les mesures des premiers matins sont
  écrasées avant la fin du test**. Sans export à J3 et J7, la première semaine, c'est-à-dire
  l'objet même de J2, est définitivement perdue.
- **Un entretien de 30 minutes à J8**, non directif, sur un seul objet : le matin où ils ont
  failli arrêter. Pas de démonstration, pas de liste de fonctionnalités.
- **Un entretien de 20 minutes à J15**, ouvert par la question de sortie de la vision, posée
  telle quelle : *« qu'est-ce que l'app a appris de toi ? »*, et on note le verbatim, pas le
  résumé.

Pas de relance à J4, alors que c'est le jour que je soupçonne. Une relance à J4 est une
intervention qui modifie précisément ce qu'on veut observer, et avec six personnes on ne peut
pas se permettre un groupe témoin. Les mémos vocaux sont le canal, et leur absence est une
donnée.

### 4.4 Ce qu'on mesure, et où c'est lisible

L'export JSON contient déjà tout ce qui suit ; rien à ajouter au produit sauf le point 5.

| Question | Source dans l'export | Lecture |
|---|---|---|
| Quel jour l'abandon commence | `history[].ts`, écarts entre entrées consécutives | Le premier trou de plus de 48 h en semaine |
| L'app s'est-elle calée | `profiles[].steps[].real` et l'écart entre `est` et la moyenne des mesures | Convergence atteinte ou non à J14 |
| A-t-elle fait arriver à l'heure | `history[].status` **croisé** avec les deux heures d'horloge du mémo vocal | Le statut auto-déclaré est biaisé chez cette population, le mémo est l'arbitre |
| La boucle du trajet s'est-elle fermée | `destinations[].byTransport[].real` non vide | Test direct de l'hypothèse de §1.4 |
| Le rattrapage mange-t-il l'apprentissage | Nombre de mesures de `douche`/`petit déjeuner` contre celui de `tenue`/`sac` | Un déficit persistant sur les étapes `comfort` confirme §1.3c |
| **Des matins ont-ils été perdus** | `history.length` contre le nombre de matins déclarés dans les mémos | **Tout écart est une occurrence du défaut §1.5, mesurée en conditions réelles** |

La dernière ligne est le contrôle le plus important du protocole, et elle a une propriété rare :
elle mesure un bug **sans instrumenter le bug**.

**Point 5, la seule addition que je demande au produit.** La `pendingSession` de P2 laisse
naturellement une trace de session : début, fin, nombre de confirmations, statut final ou
absence de statut. Je demande qu'on conserve les 30 dernières, dans la clé unique existante,
**jamais affichées dans l'interface** (R5 : ce ne doit jamais devenir un score), et présentes
dans l'export. Ce n'est pas de la télémétrie : rien ne part de l'appareil sans que la personne
exporte et envoie elle-même, exactement comme aujourd'hui. Et ce n'est pas un ajout gratuit :
P2 a besoin de cette structure pour fonctionner. La recherche en est un sous-produit, pas la
cause.

Si l'équipe juge que même ça franchit la ligne, je m'en passe et je m'appuie sur la ligne
« matins perdus » du tableau, qui est moins précise mais suffisante.

### 4.5 Critère de sortie de J2, tel que je propose de le réécrire

Voir §5.3 : je conteste le critère actuel. Ce que je propose de tenir pour J2 :

1. Sur les mémos de J1 à J3, **aucun testeur n'arrive plus tard que son habitude déclarée à
   l'inscription**. Ce critère est atteignable, vérifiable, et c'est le vrai seuil de survie.
2. À J14, **au moins la moitié du panel ouvre encore l'app**, sans relance.
3. À J15, **au moins la moitié du panel formule spontanément une chose juste que l'app a
   apprise d'eux**, sans qu'on ait montré l'écran « Tes matins ».
4. Zéro testeur ne cite un chiffre de durée restante ou de retard vu dans l'app. C'est le
   contrôle R1 en conditions réelles, et il est gratuit.

---

## 5. Mes désaccords avec la vision

### 5.1 Désaccord principal : l'ordre J1 puis J2 nous fait payer deux fois, et détruit des preuves pendant ce temps

La vision place J1, Socle de confiance, avant J2, et le justifie ainsi : « critère de sortie :
on peut modifier `ui.js` sans peur ». Je suis d'accord avec l'objectif. Je conteste
l'ordonnancement, sur deux arguments.

**Un.** J1 contient la découpe de `ui.js` en modules de rendu par écran, « sans changer un
pixel ». Or trois de mes propositions retirent du chemin critique des morceaux entiers de ce
fichier : `showCardOffer` sort du flux, le bouton « Le bilan » disparaît, huit badges de frise
disparaissent, le slider du studio disparaît. **Découper avec soin un code qu'on va ensuite
supprimer, c'est le seul type de travail que je sais reconnaître comme perdu à coup sûr.**
L'ordre inverse coûte moins cher : on retire d'abord, on découpe ce qui reste.

**Deux, et c'est le vrai argument.** Le défaut de §1.5 n'est pas une dette, c'est une perte de
données active. Tant qu'il n'est pas corrigé, **toute observation qu'on fera est corrompue à
la source** : on ne saura pas distinguer un testeur qui a arrêté d'un testeur dont les matins
n'ont pas été enregistrés. Le protocole de la section 4 ne peut pas démarrer avant P2. Et
comme le protocole prend quatorze jours plus deux semaines de recrutement, chaque semaine où
P2 attend derrière un refactor est une semaine perdue sur le seul chantier qui produit de la
connaissance.

**Ce que je propose concrètement, et où je cède.** Je ne demande pas de sauter J1. Je demande
de le couper en deux :

- **Tout de suite, avant J2** : l'intégration continue, la vérification automatique de la
  liste `ASSETS` du service worker, et surtout **les tests DOM de non-régression R1 et R2**.
  Ce sont les garde-fous, ils sont peu coûteux, et je refuse absolument que P2 touche
  `confirmNext` sans le harnais du bug de la douche. Là-dessus Milo a raison et j'applaudis.
- **Après J2** : la découpe de `ui.js` en modules, sur un fichier déjà allégé de ce qu'on aura
  retiré.

Autrement dit : **les tests d'abord, le refactor après le retrait.** Nour et Milo vont
probablement contester, et c'est la discussion que je veux ouvrir en réunion plutôt que de la
trancher seule.

### 5.2 Désaccord de fond : « chaque jalon retire quelque chose » compte le mauvais objet

La règle est excellente et je l'applique dans mes trois propositions. Mais la vision l'applique
aux écrans (« aucun nouvel écran principal », « le produit a déjà onze surfaces »). Or dans un
produit destiné à des gens en cécité temporelle, **la bonne unité n'est pas l'écran, c'est la
décision prise après le réveil.**

La preuve est dans le code. Le studio impose une vingtaine de décisions de configuration, une
fois, à froid, à un moment choisi par la personne : son coût réel est proche de zéro. L'Aperçu
impose quatre décisions, tous les matins, à l'heure du lever, immédiatement après « Bonjour »
(§1.2c). Supprimer un écran entier du studio ne rendrait service à personne. **Supprimer un
seul champ de l'Aperçu vaut plus que supprimer trois écrans ailleurs.**

Je demande donc que la règle soit amendée dans la vision : *chaque jalon retire au moins une
décision prise après le réveil.* Et je note l'ironie : la contrainte « aucun nouvel écran
principal » est parfaitement respectée par le produit actuel, dont le pire écran est un écran
qu'il possède déjà.

### 5.3 Désaccord sur le critère de sortie de J2 : il est inatteignable et il pousse à tricher

La vision écrit : « un testeur qui n'a jamais vu l'app arrive à l'heure au premier essai ».

Je pense que ce critère est faux, et surtout dangereux. Faux, parce que l'app ne dispose au
premier matin d'aucune information vraie sur la personne, et que **la seule façon de garantir
l'arrivée à l'heure au premier essai est de gonfler la marge**. Dangereux, parce que c'est
exactement ce que J3 interdit ensuite en toutes lettres : « arriver à l'heure, oui, mais sans
se lever quarante minutes trop tôt ». On donne à J2 un objectif que J3 punit. Un critère qui
se satisfait par la triche est un critère qui sera atteint par la triche, sans mauvaise foi de
personne.

J'ajoute la mesure : le plafond de la marge est de 21 minutes (§2.3). Sur ma simulation, même
saturée, l'arrivée du jour 1 reste en retard de 14 minutes. **Le critère actuel n'est pas
seulement discutable, il est mécaniquement hors d'atteinte sans modifier ce plafond**, et
personne dans l'équipe ne l'avait vu parce que personne n'avait simulé une semaine.

Je propose de le remplacer par le critère de §4.5, plus dur qu'il n'en a l'air : *ne pas faire
arriver plus tard que d'habitude, et savoir dire qu'on ne promet pas mieux.* Il correspond au
vrai contrat moral du produit : l'app ne prétend rien savoir le premier jour, elle le dit, elle
prend large, et elle le prouve au septième.

### 5.4 Un point où la vision se sous-estime

La vision classe le mode chevet dans « ce qui est solide et qu'on ne touche pas », et l'envoie
en J4 pour la recette nocturne. Je pense qu'il est sous-évalué comme levier de première
semaine. C'est le seul endroit du produit où une décision est prise **le soir**, à froid, par
quelqu'un de disponible. C'est le bon moment pour tout ce que je refuse de demander le matin.
Je ne le propose pas dans mes trois propositions parce que je n'ai pas encore la preuve que les
testeurs branchent leur téléphone toutes les nuits, et c'est une des choses que le protocole de
§4 doit m'apprendre. [HYP] Si le taux d'usage nocturne dépasse la moitié des nuits, l'Aperçu
du matin devrait pouvoir disparaître entièrement au profit d'une préparation la veille au soir.
Ce serait le plus gros retrait possible du produit, et je veux les données avant de le
proposer.

---

## 6. Ce que je demande pour la prochaine réunion

1. Un arbitrage sur §5.1 : les tests DOM avant P2, la découpe de `ui.js` après J2.
2. Un accord de principe de Sacha sur P1, la variance a priori, et une décision sur le plafond
   de 10 de `fromVar`, qui est le vrai verrou du démarrage à froid.
3. Un accord de Camille sur les trois chaînes d'incertitude de P1 et sur la formulation du
   calibrage de P3, qui est la question la plus difficile à écrire de tout le produit.
4. Un accord de principe sur le retrait du slider de durée du studio. C'est le retrait qui
   engage le plus le produit, et je ne veux pas le faire passer en silence.
5. Le lancement immédiat du recrutement du panel, en parallèle du développement. Six personnes
   qui correspondent aux critères de §4.2 prennent deux semaines à trouver, et c'est le chemin
   critique réel de tout ce cycle.

---

*Léa Ferrand · veto exercé dans ce document sur deux points : toute question de durée posée à
l'utilisateur (§2.4), et toute décision ajoutée à l'écran Aperçu (§1.2c).*

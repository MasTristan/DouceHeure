# R1 · Camille Ndiaye · Direction éditoriale et voix

Document de réunion. Audit d'entrée sur `js/copy.js`, la voix (F2), les fuites de chaînes
hors de `copy.js`, et le filet automatique de `tests/copy.test.mjs`.

Lu avant écriture : `CLAUDE.md` en entier, `docs/00-vision.md`, `docs/01-equipe.md`,
`js/copy.js` (388 l.), `tests/copy.test.mjs`, `js/speech.js`, `js/ui.js` (2 006 l.),
`js/studio.js` (728 l.), et par nécessité `js/store.js`, `js/plan.js`, `js/card.js`,
`js/social.js`, `js/predict.js`, `js/app.js`.

Aucun fichier produit n'a été modifié. Tout ce qui suit est une proposition.

---

## 0. Ce que j'ai mesuré avant d'écrire

Chiffres établis sur le fichier réel, pas à l'estime.

| Mesure | Valeur |
|---|---|
| Chaînes de variation dans `COPY` | 61, réparties sur 22 clés |
| Chaînes fixes dans `UI` | 178 (plus 8 gabarits fonction) |
| Longueur maximale d'une chaîne prononçable | 68 caractères |
| Chaînes de `COPY` contenant un chiffre | **0** |
| Chaînes de `COPY` sans ponctuation finale | **0** |
| Chaînes de `COPY` avec parenthèses de genre | 5 |
| Chaînes de `COPY` à plus de deux phrases | 3 |
| Clés mortes (définies, jamais appelées) | 4 |
| Surface réellement prononcée par `speech.speak()` | 5 points d'appel dans `ui.js` |

Deux de ces lignes sont des bonnes nouvelles et méritent d'être protégées par un test avant
que quelqu'un ne les casse : **zéro chiffre** et **zéro chaîne sans point final** dans tout
le registre prononcé. Ce sont des invariants gagnés par accident, pas par contrat. Je les
transforme en règles au §5.

---

## 1. Audit du ton, sans complaisance

La refonte « ton direct et lucide, zéro métaphore spa » a réussi sur un point et échoué sur
deux. Réussi : il n'y a effectivement aucune métaphore de bien-être, aucun « respire »,
aucune « parenthèse douceur ». Échoué : le fichier n'a pas **un** locuteur, et il confond
« direct » avec « drôle ».

### 1.1 Le défaut structurel : trois locuteurs dans le même produit

C'est le problème n°1, avant toute question de goût. Le fichier parle alternativement à la
première personne, à la première du pluriel, et à la troisième personne.

- **« je »** : `"Légèrement hors plan. Rien de grave, j'ai recalculé."` (l. 106),
  `"En avance. Je note."` (l. 128), `"Bien arrivé(e). Je retiens le trajet."` (l. 156),
  `"La prochaine fois je préviens plus tôt."` (l. 138),
  `preview_travel_known: "Le trajet, je connais. Je m'en occupe."` (l. 215).
- **« on »** : `"On a pris un peu plus de temps."` (l. 105), `"On s'occupe du reste."`
  (l. 61), `"On est pas pressés."` (l. 100), `"Qu'est-ce qu'on met aujourd'hui."` (l. 44).
- **« l'app », troisième personne** : `mornings_learned_step` (l. 282-284) produit
  `"Douche, l'app connaît. Le plan en tient compte."`, et `mornings_learned_travel`
  (l. 285) produit `"À pied vers Bureau, l'app connaît."`. Le fichier `ob1_headline`
  ouvre d'ailleurs sur `"Douce heure ne te presse pas."` (l. 170), puis
  `"Elle marche à ton rythme"` (l. 171) : l'app se désigne à la troisième personne dans
  l'écran d'accueil, et dit « je » quarante lignes plus loin.

À l'écrit c'est une gêne. **À la voix c'est une rupture d'identité** : la même voix de
synthèse dit « je retiens le trajet » le lundi et « l'app connaît » le mardi. L'utilisateur
n'a pas de modèle mental stable de qui lui parle.

**Doctrine que je pose.**

1. **« je » = l'app.** C'est le locuteur par défaut. Elle a un point de vue, elle assume.
2. **« on » = l'app et toi, ensemble, pendant la session seulement.** Autorisé dans le live
   (`"On a pris un peu plus de temps."`), interdit ailleurs. C'est une nuance de complicité,
   pas un pluriel de majesté.
3. **La troisième personne est interdite.** Jamais « l'app », jamais « Douce heure » comme
   sujet d'un verbe de connaissance. Exception unique : le wordmark et l'onboarding 1, où le
   produit se présente avant d'exister comme interlocuteur.
4. **Jamais « nous ».** Il n'y a pas d'équipe derrière l'écran à 7 h du matin.

Conséquence immédiate : `mornings_learned_step` et `mornings_learned_travel` (l. 282-285)
sont à réécrire, et ce sont précisément les deux chaînes que le §3 va reprendre.

### 1.2 Les chaînes que je retire, avec le motif

Veto sur les cinq premières. Ce ne sont pas des questions de goût.

| l. | Chaîne | Motif | Remplacement proposé |
|---|---|---|---|
| 58 | `"Deux minutes pour toi. Pas trois, deux."` | **Violation de R1.** Une durée prescriptive en toutes lettres, prononcée. Le test actuel ne l'attrape pas parce qu'il ne cherche que des chiffres. Aggravant : l'étape `grooming` est configurée à `est: 10` (`store.js` l. 24). L'app annonce deux minutes pour une étape qu'elle a planifiée à dix. | `"Un moment pour toi. Il est prévu."` |
| 100 | `"On est pas pressés. Enfin si, un peu. Mais ça va."` | **Violation de R5.** C'est un message de `nudge`, donc il arrive exactement quand la personne dérape. La blague avoue la pression au moment où elle est la plus toxique. Trois phrases, prosodie hachée. | `"Rien ne brûle."` |
| 67 | `"Le moment où on réalise qu'on a oublié quelque chose."` | Instille un doute non résolu au moment de fermer le sac, chez un public à forte tendance à la vérification. C'est une boucle anxieuse offerte gratuitement. | `"Ce qui doit partir avec toi part maintenant."` |
| 54 | `"Petit-déj. On ne négocie pas avec ça."` | Seule chaîne autoritaire du fichier. Et contradiction produit : `breakfast` est `kind: 'comfort'`, donc F3 propose de la couper. L'app interdit de négocier ce qu'elle négocie elle-même vingt minutes plus tard. | `"Petit-déj. Même debout, même vite."` |
| 40 | `"La meilleure partie du matin pour beaucoup de gens. Profites-en."` | Comparaison sociale implicite (« beaucoup de gens »), et présomption fausse : la douche est fréquemment l'étape de blocage. Dire « la meilleure partie » à quelqu'un qui la redoute est une petite gifle quotidienne. | `"Sous l'eau, rien d'autre à décider."` |

Puis les cinq qui vieillissent mal, sans être fautives au premier matin.

| l. | Chaîne | Ce qui se passe au sixième matin | Remplacement |
|---|---|---|---|
| 46 | `"Le truc que tu porteras toute la journée. Choisis bien-ish."` | « bien-ish » est un anglicisme de réseau social. Une voix `fr-FR` le prononce « bien-iche » ou épelle. Drôle une fois, daté au bout d'un mois. | `"La première qui vient est la bonne."` |
| 52 | `"Ton cerveau fonctionne mieux avec du carburant, c'est prouvé."` | Argument d'autorité, registre magazine. Six matins de suite, c'est une leçon. | `"Quelque chose de chaud, si tu peux."` |
| 32 | `"Yep, c'est le matin."` | Anglicisme prononcé, seul écart de registre du fichier. | `"Voilà, c'est le matin."` |
| 30 | `"Le monde peut attendre deux minutes."` | Durée en toutes lettres, et c'est faux : le monde n'attend pas, il y a un train. L'app perd en crédibilité sur une phrase gratuite. | `"Le monde attendra. Il attend toujours."` |
| 59 | `"La partie où tu décides de ce que les autres voient en premier."` | Ramène le regard des autres dans la tête d'une personne anxieuse, à l'étape la plus facultative. | `"Ce qui te fait du bien, rien d'autre."` |

Et trois corrections plus fines, mais qui comptent.

- l. 61 `"On s'occupe du reste."` : promesse creuse. L'app ne s'occupe de rien à la place de
  l'utilisateur, c'est même sa règle fondatrice (R2). Une phrase qui ment sur le contrat
  produit. Remplacement : `"Le reste peut attendre."`
- l. 33 `"Tu t'es levé(e). C'est déjà ça."` : « c'est déjà ça » sous-entend « c'est peu ».
  Condescendance involontaire. Remplacement : `"Debout. Le plus dur est fait."` (et le
  problème de genre disparaît, cf. §2).
- l. 129 `"Arrivé(e) avant tout le monde. Bon réflexe."` : l'app ne sait pas si l'utilisateur
  est arrivé avant qui que ce soit. C'est une flatterie fausse, et la vision (§2, « l'honnêteté
  est un moteur ») interdit ce genre de gentillesse gratuite. Remplacement :
  `"En avance, et sans courir."`

### 1.3 Prosodie : les points valent des silences

Trois chaînes cumulent trois phrases (donc trois arrêts complets de la voix) :

- l. 65 `"Clés. Téléphone. Le reste."`
- l. 68 `"Sac. Clés. C'est tout ce qui compte là."`
- l. 100, déjà retirée ci-dessus.

À l'écrit, le staccato est un effet de style et il fonctionne. À la voix, chaque point
produit un silence de fin de phrase : « Clés [silence] Téléphone [silence] Le reste. »
On dirait un inventaire de gare. Les virgules donnent la liste sans les trous.

- `"Clés, téléphone, le reste."`
- `"Sac, clés, c'est tout ce qui compte là."`

Cas particulier, l. 74 : `"Presque."` Une chaîne d'un mot, prononcée seule après le libellé
d'étape (`"Clés, prêt·e. Presque."`, cf. §2). Hors contexte visuel, elle n'est pas
auto-portante. Remplacement : `"Tout est là."`

**Règle d'écriture qui en découle** : toute chaîne prononcée doit rester compréhensible les
yeux fermés, sans l'écran. C'est le test à faire mentalement avant d'ajouter une ligne.

### 1.4 Deux défauts mécaniques que l'audit de texte fait remonter

Ce ne sont pas des problèmes de chaîne, ce sont des problèmes d'orchestration, mais ils
détruisent le travail éditorial. Ils appartiennent à J1/J2, je les signale ici.

**a. Le message qui clignote toutes les cinq secondes.** `ui.js` l. 888 :

```js
const message = suggested ? pick('suggested') : live.stepMessage;
```

`renderLive()` est rappelé par un `setInterval` de 5 000 ms (l. 663). Le message d'étape est
mémorisé dans `live.stepMessage` (l. 884-887), donc stable. Le message `suggested`, lui, est
re-tiré à **chaque rendu**. Le pool `suggested` compte deux entrées et `pick()` interdit la
répétition immédiate : les deux phrases **alternent donc strictement toutes les cinq
secondes** sous les yeux de l'utilisateur, à l'instant précis où l'app lui suggère
d'avancer. Un texte qui bouge tout seul est un signal d'urgence. C'est contraire à R5, et
c'est de ma responsabilité de le dire même si le correctif est dans `ui.js` : `suggested`
doit être figé au moment où l'état passe à `suggested`, exactement comme `stepMessage`.

**b. La collision « Bonne route ».** `COPY.leave` (l. 86) et `COPY.trip_road` (l. 152)
contiennent tous deux `"Bonne route."`. Le mécanisme anti-répétition de `pick()` travaille
par clé (`_last[key]`, l. 20), pas entre clés. L'écran de départ peut donc afficher
« Bonne route. », puis l'écran de trajet, trente secondes plus tard, afficher et prononcer
« Bonne route. » de nouveau. Correctif éditorial : `"Bonne route."` appartient au trajet.
Dans `leave`, le remplacer par `"La porte, et c'est fait."`

**c. Quatre clés mortes.** Définies, jamais appelées, donc jamais relues, donc dangereuses
le jour où quelqu'un les branche sans les réviser :

| Clé | l. | Situation |
|---|---|---|
| `COPY.slip` | 104-107 | Aucun `pick('slip')` dans le code. Deux chaînes orphelines. |
| `UI.leave_slip` | 248 | Jamais référencée, et strictement identique à `leave_arrival` (l. 247). |
| `UI.bedside_quit_yes` | 302 | Jamais référencée : `ui.js` l. 1709 utilise `confirm()` natif, dont les boutons sont ceux du système. |
| `UI.bedside_quit_no` | 303 | Idem. |

Les deux dernières racontent une histoire précise : **quelqu'un a écrit les bons mots, puis
le code a pris un raccourci natif et les mots sont restés sur le carreau.** À 3 h du matin,
dans une app dont la promesse est de ne jamais agresser, la boîte système gagne contre
`copy.js`. C'est le meilleur argument pour la suppression des dialogues natifs prévue en J4,
et je m'y associe.

### 1.5 Ce qui est réussi, et qu'on ne touche pas

Pour être honnête dans les deux sens.

- `ob3_body` (l. 180), `"Pendant le guidage, l'écran reste allumé et l'app reste ouverte.
  Si tu la fermes, elle attend sans sonner. C'est le deal."` La vision a raison : c'est la
  meilleure phrase du produit. Elle dit une limite technique sans s'excuser et sans jargon.
  C'est le modèle de tout le reste.
- `"Une tenue. N'importe laquelle ira."` (l. 45) : anti-paralysie du choix, exactement le
  bon service rendu au bon moment.
- `"Vérifie une dernière fois. Juste une."` (l. 73) : borne la vérification au lieu de
  l'ouvrir. Rare et juste.
- `rescue_title` / `rescue_body` (l. 120-125) : une proposition, un choix, aucun chiffre,
  aucun reproche. R5 tenue dans le moment le plus difficile du produit.
- `mornings_privacy` (l. 286) et `social_guardrail` (l. 376) : la contrainte technique
  devient une promesse. C'est de la bonne écriture produit.
- Le principe du pool de variation lui-même. Sur un produit quotidien, c'est ce qui évite
  l'usure. Il faut juste que les quatre variantes soient d'égale qualité, ce qui n'est pas
  le cas aujourd'hui : dans chaque famille, une variante est nettement plus faible que les
  autres, et c'est elle qu'on entend un matin sur quatre.

---

## 2. Écriture inclusive et synthèse vocale

### 2.1 Le constat, précisément

Cinq chaînes de `COPY` et trois de `UI` utilisent la parenthèse de genre. Le point médian
apparaît une fois, ailleurs, et c'est le pire cas du produit.

| Fichier | l. | Chaîne | Prononcée ? |
|---|---|---|---|
| `copy.js` | 33 | `"Tu t'es levé(e). C'est déjà ça."` | oui |
| `copy.js` | 89 | `"Vas-y, t'es prêt(e)."` | oui |
| `copy.js` | 93 | `"Quand tu es prêt(e)."` | oui |
| `copy.js` | 129 | `"Arrivé(e) avant tout le monde. Bon réflexe."` | non (toast) |
| `copy.js` | 156 | `"Bien arrivé(e). Je retiens le trajet."` | non (toast) |
| `copy.js` | 203 | `home_arrived_banner: 'Bien arrivé(e) ?'` | VoiceOver |
| `copy.js` | 204 | `home_arrived_yes: 'Oui, bien arrivé(e)'` | VoiceOver |
| `copy.js` | 255 | `trip_arrived_cta: 'Je suis arrivé(e)'` | VoiceOver |
| `card.js` | 17-19 | `'Parti(e) en avance, sans courir'` et ses deux sœurs | image partagée |
| `social.js` | 12, 15 | `` `Je suis parti(e) à l'heure ce matin 🌿` `` | **envoyée à un tiers** |
| `store.js` | 26 | `label: 'Clés, prêt·e'` | **oui** |

Le cas `store.js` l. 26 est le plus grave et personne ne l'a vu, parce qu'il n'est pas dans
`copy.js` et que le test ne le regarde pas. Or `ui.js` l. 708-709 compose et prononce :

```js
speech.speak(`${step.label}. ${live.stepMessage}`);
```

Le libellé d'étape **est** une chaîne prononcée. `"Clés, prêt·e"` passe donc dans
`speechSynthesis` tel quel. Selon la voix, le point médian est ignoré (« prête », correct par
hasard), lu (« prêt point e »), ou provoque une coupure de segment. On ne peut pas livrer un
comportement qu'on ne peut pas prédire.

Les cas `social.js` sont d'une autre nature : ces textes ne sont ni affichés ni prononcés par
l'app, **ils sortent de l'app** vers un proche. C'est le seul endroit où Douce heure écrit au
nom de l'utilisateur, à un tiers, avec une typographie qui n'est pas la sienne. Le proche
reçoit « Je suis parti(e) à l'heure ce matin ». C'est la signature de l'app sur un message
personnel. Veto.

### 2.2 Ma doctrine : formulations épicènes, sans exception

Je ne veux ni parenthèse, ni point médian, ni doublet (« parti ou partie »). La contrainte
vocale et la contrainte de lecteur d'écran pointent dans la même direction que la contrainte
de style : **la langue épicène est plus courte, plus directe, et se prononce.**

Six procédés, dans l'ordre où il faut les essayer.

1. **Supprimer l'accord en changeant de temps.** Le passé composé avec « être » est le seul
   coupable. Le présent ne s'accorde pas : « je suis parti(e) » devient « je pars ».
2. **Nominaliser.** « Bien arrivé(e). » devient « Arrivée notée. » L'accord porte sur le
   nom, pas sur la personne.
3. **Passer par « y ».** « Je suis arrivé(e) » devient « J'y suis ». Court, oral, épicène,
   et c'est même du meilleur français parlé.
4. **Passer par un état non genré.** « levé(e) » devient « debout ». « prêt(e) » devient
   « tout est là », « c'est bon », « tu peux y aller ».
5. **Passer à l'impératif ou à l'infinitif.** Aucun accord possible.
6. **Si les cinq échouent, changer d'idée.** Aucune phrase du produit ne vaut une parenthèse.
   Il n'existe pas de contenu indispensable qui exige un participe passé à la première
   personne.

**Règle unique à retenir, testable** : aucune chaîne du produit ne contient `(`, `)`, `·`
ou un participe passé accordé à la personne. Le test du §5 le garantit.

### 2.3 Réécriture complète des chaînes concernées

| Fichier, l. | Avant | Après | Procédé |
|---|---|---|---|
| `copy.js` 33 | `"Tu t'es levé(e). C'est déjà ça."` | `"Debout. Le plus dur est fait."` | 4 |
| `copy.js` 89 | `"Vas-y, t'es prêt(e)."` | `"Tu peux y aller."` | 4 |
| `copy.js` 93 | `"Quand tu es prêt(e)."` | `"Quand c'est fait, confirme."` | 5 |
| `copy.js` 129 | `"Arrivé(e) avant tout le monde. Bon réflexe."` | `"En avance, et sans courir."` | 6 |
| `copy.js` 156 | `"Bien arrivé(e). Je retiens le trajet."` | `"Arrivée notée. Je retiens ce trajet."` | 2 |
| `copy.js` 203 | `'Bien arrivé(e) ?'` | `'Tu y es ?'` | 3 |
| `copy.js` 204 | `'Oui, bien arrivé(e)'` | `"Oui, j'y suis"` | 3 |
| `copy.js` 255 | `'Je suis arrivé(e)'` | `"J'y suis"` | 3 |
| `copy.js` 172 | `'Ton prénom (optionnel)'` | `'Ton prénom, si tu veux'` | parenthèse |
| `copy.js` 214 | `'Trajet estimé (minutes)'` | `'Trajet estimé, en minutes'` | parenthèse |
| `store.js` 26 | `'Clés, prêt·e'` | `'Clés en main'` | 4, et écho de `COPY.ready` |
| `card.js` 17 | `'Parti(e) en avance, sans courir'` | `'Départ en avance, sans courir'` | 2 |
| `card.js` 18 | `"Parti(e) à l'heure, sans courir"` | `"Départ à l'heure, sans courir"` | 2 |
| `card.js` 19 | `'Parti(e) ce matin, à son rythme'` | `'Départ ce matin, à son rythme'` | 2 |
| `social.js` 12 | `` `Je suis parti(e) à l'heure ce matin 🌿` `` | `` `Je pars à l'heure ce matin` `` | 1 |
| `social.js` 13 | `` `Bonne journée en chemin, je t'embrasse ☀️` `` | `` `Bonne journée, je suis en route` `` | emoji |
| `social.js` 14 | `` `Je pars maintenant, on se parle plus tard 🫶` `` | `` `Je pars maintenant, on se parle plus tard` `` | emoji |
| `social.js` 15 | `` `Parti(e) à l'heure ! La journée commence bien.` `` | `` `Je pars à l'heure, la journée commence bien.` `` | 1 |

Sur les emojis de `social.js` : ils sont lus par VoiceOver (« brin d'herbe », « soleil ») et
ils contredisent une décision déjà prise ailleurs, celle du sprite SVG monoline qui a
remplacé les emojis d'étapes en v2 (`store.js` l. 8-13, migration `EMOJI_TO_ICON`). Le
produit a une identité graphique sans emoji ; le seul texte qui sort de l'app en est couvert.
Je les retire.

### 2.4 L'arbitrage que je NE demande pas, et celui que je demande

**Je ne demande pas de séparer chaîne affichée et chaîne prononcée.** C'est la solution
paresseuse et elle coûte cher. Trois raisons.

1. Deux versions d'un texte, c'est deux textes à maintenir et un seul qui sera relu. La
   version prononcée dérivera, et elle dérivera précisément là où R1 et R4 se jouent.
2. `tests/copy.test.mjs` garantit aujourd'hui les règles sur **toutes** les chaînes parce
   qu'elles sont identiques. Une version vocale distincte devient un deuxième corpus à
   couvrir, et le premier oubli est une fuite de marge prononcée.
3. Le besoin réel disparaît une fois les parenthèses supprimées. Après la réécriture ci
   dessus, il ne reste **aucune** chaîne qu'on ne puisse prononcer telle quelle. La
   séparation résoudrait un problème que la langue résout mieux.

**Je demande en revanche un arbitrage, plus étroit, et j'en ai besoin pour J2.**

État actuel : la spec dit « la voix prononce exactement les chaînes affichées ». Dans les
faits, `ui.js` **compose** ce qui est prononcé :

- l. 708-709 : `` `${step.label}. ${live.stepMessage}` `` (affiché : un `h1` et un `p`
  séparés, donc jamais cette chaîne-là telle quelle)
- l. 1000-1001 : `` `${UI.leave_title}. ${live.leaveMessage}` ``
- l. 1782 : `` `${pick('goodmorning')}${state.name ? ' ' + state.name + '.' : ''}` ``

La règle est donc déjà interprétée : « les mêmes mots », pas « la même chaîne ». Je ne
propose pas de changer ce comportement, il est bon. Je demande que **la composition
redescende dans `copy.js`**, sous la forme d'une fonction exportée par clé
(`spoken.step(label, message)`, `spoken.leave(message)`, `spoken.greeting(name)`), pour
trois raisons : le point et l'espace entre le libellé et le message sont de la prosodie,
donc de mon périmètre ; le test automatique ne voit pas aujourd'hui ce qui est réellement
prononcé, seulement ses morceaux ; et l'ajout du prénom en apposition
(`"Bonjour Marie."`, sans virgule, l. 1782) est une faute de ponctuation qui rend la
prosodie plate là où l'app dit bonjour pour la seule fois de la journée. Correct :
`"Bonjour, Marie."`

C'est le seul assouplissement que je demande, et il **renforce** la règle au lieu de la
contourner : après lui, tout ce qui est prononcé est écrit dans `copy.js`, ce qui n'est pas
le cas aujourd'hui.

---

## 3. Le vocabulaire de l'incertitude

Ce registre n'existe pas. Aujourd'hui l'app dispose d'exactement deux phrases pour dire
qu'elle sait (`preview_travel_known` l. 215, `preview_learned` l. 224), et d'une seule pour
dire qu'elle ne sait pas : `mornings_learned_empty` l. 281,
`"Encore rien. Quelques matins et ça vient."` La première moitié est mauvaise : « Encore
rien » place l'app en déficit et, par contrecoup, l'utilisateur en dette. La seconde moitié
est excellente et donne la clé du registre entier : **une constatation, puis une projection
tranquille, sans chiffre et sans échéance.**

### 3.1 Les sept règles d'écriture du registre

1. **Le sujet de l'ignorance est l'app, jamais l'utilisateur.** « Je ne connais pas encore
   tes matins », jamais « tu n'as pas encore assez utilisé l'app ». Toute formulation qui
   crée une dette côté utilisateur est refusée (R5).
2. **Aucun chiffre, aucun compte, aucune échéance.** Ni « trois matins », ni « bientôt à
   80 % », ni barre de progression. Compter les matins restants est un compte à rebours
   déguisé, donc R1 s'applique.
3. **Ne jamais justifier par la compensation.** C'est le piège R4. La phrase honnête qui
   vient naturellement sous la plume est « comme je ne te connais pas encore, je prends de
   la marge ». Elle est interdite. On dit ce qu'on ne sait pas, jamais ce qu'on en fait.
   **L'honnêteté porte sur l'état de la connaissance, jamais sur la compensation.**
4. **L'ignorance est un présent actif, pas un manque.** Verbes d'action au présent :
   « je regarde », « j'observe », « je note ». Interdits : « je ne peux pas », « désolée »,
   « malheureusement », « approximatif », « peu fiable », « estimation grossière ». L'app
   ne s'excuse pas d'être neuve.
5. **Une phrase, deux au maximum, et jamais pendant le live.** Voir §6 : le registre de
   l'incertitude vit dans l'aperçu, le bilan et « Tes matins ». Jamais entre deux étapes,
   quand la personne est debout et pressée.
6. **La même grammaire du jour 1 au jour 30, seul le verbe change.** « Ce trajet, je ne l'ai
   pas encore fait avec toi. » puis « Le trajet, je connais. » Le progrès se lit dans la
   phrase, pas dans un indicateur. C'est ce qui permet à un testeur de dire au septième
   matin ce qui a changé, sans qu'on lui ait jamais montré un score.
7. **« encore » est le mot pivot du registre, et il est réservé.** Il porte à lui seul le
   caractère temporaire. On ne l'utilise nulle part ailleurs dans le produit.

### 3.2 Registre froid, jour 1 à jour 7 : huit chaînes prêtes

Clés proposées, à ajouter dans `UI` sauf mention contraire.

| Clé | Chaîne | Où |
|---|---|---|
| `cold_plan` | `"Premier plan. Il part de tes estimations, je regarde ce qui se passe vraiment."` | Aperçu, quand aucune étape n'a de mesure |
| `cold_plan_alt` | `"Aujourd'hui ce plan est le tien. Bientôt il sera un peu le mien aussi."` | Variante d'aperçu, jours 2 à 4 |
| `cold_step` | `"Sur ton estimation."` | Ligne de timeline, à la place de `preview_learned` quand `confidence === 0` |
| `cold_travel` | `"Ce trajet, je ne l'ai pas encore fait avec toi."` | Aperçu, symétrique exact de `preview_travel_known` |
| `cold_first_leave` | `"Premier départ ensemble. Je regarde comment ça se passe."` | Écran de départ, première session |
| `cold_feedback` (dans `COPY`) | `"Noté. C'est comme ça que j'apprends."` | Bilan, tant que l'historique est court |
| `cold_mornings` | `"Rien à dire encore. Ça se remplit tout seul, matin après matin."` | Remplace `mornings_learned_empty` l. 281 |
| `cold_warming` | `"Je commence à voir comment tes matins se passent."` | « Tes matins », dès la première mesure et avant la confiance pleine |

Vérification règle par règle sur ces huit chaînes : aucun chiffre, aucune échéance, aucune
mention de marge ni de compensation, aucune excuse, aucune dette côté utilisateur, aucune ne
dépasse 76 caractères, toutes se terminent par un point, aucune parenthèse, aucun anglicisme.

### 3.3 Registre chaud : dire qu'elle sait, sans se vanter

Le risque symétrique est la fanfaronnade, et il est plus dangereux qu'il n'en a l'air : une
app qui annonce ses progrès demande implicitement d'être félicitée, et c'est le premier pas
vers le score et le streak que la vision refuse en §3.

**Trois règles.**

1. **Constater, ne pas annoncer.** Le passage de l'ignorance à la connaissance n'est jamais
   un évènement. Pas de « ça y est », pas de « j'ai fini d'apprendre », pas de notification
   de palier. La phrase change, c'est tout, et l'utilisateur le remarque ou non.
2. **Le sujet est le plan ou l'utilisateur, jamais la performance de l'app.**
   « Ce plan vient de tes vrais matins » est bon. « Mon modèle est calibré » est une faute.
3. **Une proposition, jamais de comparatif avec avant.** « Je suis plus juste qu'au début »
   invite à évaluer l'app, donc à en douter.

| Clé | Chaîne | Note |
|---|---|---|
| `preview_travel_known` (l. 215) | `"Le trajet, je connais. Je m'en occupe."` | À conserver telle quelle. C'est la meilleure phrase du registre et le modèle des autres. |
| `preview_learned` (l. 224) | `"Calé sur tes vraies durées."` devient `"Calé sur tes matins."` | « durées » appelle un chiffre dans la tête du lecteur, et frôle R1. « Tes matins » dit la même chose et raccorde au vocabulaire de l'écran « Tes matins ». |
| `warm_plan` | `"Ce plan vient de tes vrais matins."` | Aperçu, quand la majorité des étapes ont une mesure |
| `warm_quiet` | `"Rien à ajuster ce matin."` | Aperçu, régime de croisière. Le silence comme livrable, version texte. |
| `mornings_learned_step` (l. 282-284) | `` (label, dayName) => dayName ? `${label}, ça prend son temps le ${dayName}. J'en tiens compte.` : `${label}, je connais. J'en tiens compte.` `` | Supprime la troisième personne (§1.1) et le « le plan » impersonnel |
| `mornings_learned_travel` (l. 285) | `` (transport, dest) => `${dest}, ${transport.toLowerCase()} : je connais.` `` | La forme actuelle produit `"À pied vers Bureau, l'app connaît."` : pas d'article devant le libellé utilisateur, prosodie cassée. La destination d'abord, le mode ensuite, ça se prononce. |

---

## 4. Les fuites hors de `copy.js`

Recensement exhaustif des chaînes affichées, prononcées ou lues par VoiceOver qui ne
transitent pas par `copy.js`. J'exerce mon veto sur l'ensemble : elles échappent au test,
au ton, et à la relecture.

### 4.1 `js/ui.js`

| l. | Chaîne en dur | Nature | Clé `copy.js` proposée |
|---|---|---|---|
| 76 | `'← Retour'` | libellé de bouton | `UI.back` (et retirer le `←` du texte, cf. §5 règle 7) |
| 293 | `` `${ARCHETYPES[i].stepKeys.length} étapes` `` | gabarit | `UI.steps_count(n)` |
| 428 | `` `${stepCount} étapes` + ` · arrivée ${...}` `` | gabarit, avec point médian | `UI.profile_meta(n, arrival)` |
| 708-709 | `` `${step.label}. ${live.stepMessage}` `` | **prononcé** | `spoken.step(label, message)`, cf. §2.4 |
| 818 | `` `Monter ${step.label}` `` | aria-label | `UI.a11y_move_up(label)` |
| 827 | `` `Descendre ${step.label}` `` | aria-label | `UI.a11y_move_down(label)` |
| 825, 834 | `'↑'` `'↓'` | contenu de bouton | glyphe décoratif, à passer en `aria-hidden` avec l'aria-label ci-dessus |
| 937 | `` `${UI.live_next_prefix} ${next.label}` `` | gabarit | `UI.live_next(label)` |
| 942 | `next.label.toLowerCase()` | **décision typographique dans le rendu** | la casse est éditoriale : `UI.live_confirm` doit recevoir le libellé brut et décider |
| 1000-1001 | `` `${UI.leave_title}. ${live.leaveMessage}` `` | **prononcé** | `spoken.leave(message)` |
| 1056 | `'?'` (initiales de repli) | affiché | `UI.contact_initial_fallback` |
| 1066, 1863, 1987 | `` `« ${msg} »` `` | gabarit de citation | `UI.quote(text)`, une seule définition pour les trois |
| 1286 | `aria-label: UI.mornings_count(...)` | conforme, pour mémoire | rien à faire |
| 1410 | `confirm(UI.settings_import_confirm)` | **dialogue natif** | texte dans `copy.js`, mais boutons système hors contrôle. À supprimer en J4 |
| 1511 | `shortcutsUrl` en `<code>` | affiché | acceptable, ce n'est pas de la langue |
| 1709 | `confirm(UI.bedside_quit_confirm)` | **dialogue natif, en pleine nuit** | `bedside_quit_yes` / `bedside_quit_no` existent déjà et attendent, l. 302-303 |
| 1732 | `` `${UI.bedside_wake_label} ${night.bedside.wakeTime}` `` | gabarit | `UI.bedside_wake_at(time)` |
| 1782 | greeting composé, prénom sans virgule | **prononcé** | `spoken.greeting(name)`, cf. §2.4 |
| 1858 | `` `${channel.label} · ${c.number}` `` | gabarit | `UI.contact_meta(channel, number)` |
| 1860-1861 | `'Modifier'`, `'✎'`, `'Supprimer'`, `'×'` | aria-labels et glyphes | `UI.action_edit`, `UI.action_delete` |
| 1922 | `placeholder: 'Prénom'` | placeholder | `UI.contact_name_placeholder` |
| 1928 | `'@pseudo ou +33...'`, `'+33 6...'` | placeholders | `UI.contact_handle_placeholder`, `UI.contact_phone_placeholder` |
| 1936 | `'Ajouter'` / `'Enregistrer'` | boutons | `UI.action_add`, `UI.action_save` |
| 1962 | `'Nouveau proche'` / `'Modifier'` | titre de feuille | `UI.contact_new_title`, `UI.contact_edit_title` |
| 1965 | `'Depuis mes contacts'` | bouton | `UI.contact_pick_native` |
| 1968 | `'Prénom'` | label | `UI.contact_name_label` |
| 1971 | `'Canal préféré'` | label | `UI.contact_channel_label` |
| 1979 | `'Numéro ou pseudo'` | label | `UI.contact_handle_label` |
| 1982 | `'Message envoyé'` | label | `UI.contact_message_label` |
| 1991 | `'Annuler'` | bouton | `UI.action_cancel` |

### 4.2 `js/studio.js`

| l. | Chaîne en dur | Nature | Clé proposée |
|---|---|---|---|
| 169, 201 | `'Choisir une icône'` | aria-label de dialogue | `UI.icon_picker_title` |
| 172, 345 | `'Fermer'` | bouton | `UI.action_close` |
| 212-213, 464 | `"Nom de l'étape"` | placeholder et aria-label | `UI.step_name_label` |
| 220, 228, 399, 408 | `newDur + ' min'`, `step.est + ' min'` | **unité de durée assemblée dans le rendu** | `UI.minutes(n)`. Hors R1 (réglage, pas temps restant) mais la forme doit être décidée une fois |
| 223, 403 | `'Durée en minutes'`, `` `Durée de ${step.label} en minutes` `` | aria-labels | `UI.a11y_duration(label)` |
| 244 | `'Ajouter'` | bouton | `UI.action_add` |
| 249 | `'Nouvelle étape'` | titre de feuille | `UI.step_new_title` |
| 253 | `'Durée'` | label | `UI.duration_label` |
| 261, 302 | `'Annuler'` | bouton | `UI.action_cancel` |
| 296 | `` `${arch.stepKeys.length} étapes · ${arch.checklist.length} objets` `` | gabarit | `UI.archetype_meta(steps, items)` |
| 359 | `'Glisser pour réordonner'` | aria-label | `UI.a11y_drag_handle` |
| 369 | `` `Changer l'icône de ${step.label}` `` | aria-label | `UI.a11y_change_icon(label)` |
| 381 | `` `Modifier le nom : ${step.label}` `` | aria-label | `UI.a11y_rename(label)` |
| 388 | `` `${step.label} : ${...}` `` | aria-label | `UI.a11y_kind(label, kind)` |
| 416 | `` `Supprimer l'étape ${step.label}` `` | aria-label | `UI.a11y_delete_step(label)` |
| 429 | `` `Activer ${step.label}` `` | aria-label | `UI.a11y_toggle_step(label)` |
| 491, 499, 507 | `Monter` / `Descendre` / `Supprimer ${item.label}` | aria-labels | mêmes clés que `ui.js` 818/827 |
| 539 | `'+'` | bouton | glyphe, exige un aria-label : `UI.a11y_add_item` |
| 623 | `'Ajouter un départ'` | aria-label | `UI.a11y_add_profile` |
| 647 | `` confirm(`${UI.studio_delete_profile} ?`) `` | **ponctuation ajoutée par le code, plus dialogue natif** | `UI.studio_delete_confirm`, chaîne complète |
| 667-668 | `'Retour'`, `'← ' + UI.studio_back` | aria-label et préfixe glyphe | `UI.back`, glyphe en CSS |

### 4.3 Ailleurs, et c'est le plus grave

| Fichier, l. | Chaîne | Pourquoi ça compte |
|---|---|---|
| `plan.js` 48 | `label: 'C\'est l\'heure'` | Un libellé **affiché et prononcé**, écrit dans le moteur de calcul. Duplique `UI.leave_title` (l. 171 de `copy.js`). Viole aussi la séparation métier/rendu de `CLAUDE.md` §4. Clé : `plan.js` doit poser `key: 'leave'` et laisser le rendu résoudre le libellé. |
| `store.js` 20-27 | `'Réveil'`, `'Douche'`, `'Tenue'`, `'Petit déjeuner'`, `'Soins'`, `'Sac'`, `'Clés, prêt·e'` | **Prononcés à chaque étape** via `ui.js` l. 709. Aucun ne passe le test. `'Clés, prêt·e'` est le cas critique du §2. Clé : `UI.step_labels`, consommé par `store.js` à la création. |
| `store.js` 29-32, 36-48 | `'Clés'`, `'Téléphone'`, et les six noms d'archétypes (`'Matin express'`, `'Gig'`, `'Voyage'`...) | Affichés partout, jamais relus. `'Gig'` est un anglicisme non prononçable par une voix française. Clé : `UI.archetype_names`, `UI.checklist_defaults`. |
| `store.js` 183 | `name: 'Matin classique'` en dur dans `migrate()` | Un libellé utilisateur écrit dans la migration |
| `card.js` 8-10 | `MONTHS`, `DAYS` | `DAYS` duplique mot pour mot `UI.jours` (`copy.js` l. 386). Deux sources pour les mêmes sept mots |
| `card.js` 17-19 | `PHRASES` | Trois chaînes exportées **en image, vers l'extérieur**. Elles portent parenthèses de genre |
| `card.js` 78, 92 | `'Douce heure'` en dur, deux fois | Duplique `UI.wordmark` |
| `social.js` 5-8 | `'SMS'`, `'WhatsApp'`, `'iMessage'`, `'Telegram'` | Noms propres, tolérables, mais affichés (`ui.js` l. 1858) |
| `social.js` 11-16 | `MESSAGE_TEMPLATES` | **Le seul texte que l'app fait sortir vers un tiers.** Parenthèses de genre et emojis. Priorité maximale |

**Ordre de traitement que je recommande** : `social.js` et `store.js` d'abord (ce sont des
chaînes prononcées ou envoyées à l'extérieur), `plan.js` ensuite (violation d'architecture en
prime), les aria-labels de `studio.js` et `ui.js` pendant J4 avec Iris, puisque ce sont les
mêmes lignes qu'elle touchera.

---

## 5. Renforcer le filet automatique

Le test actuel couvre R1, R4, R5 et le tiret cadratin sur `COPY` et `UI`. Il a trois trous
que l'audit a exposés : il ne connaît que les chiffres (donc rate « Deux minutes pour toi »),
il ne regarde que `copy.js` (donc rate `'Clés, prêt·e'` et les templates sociaux), et il
n'exige rien positivement.

Treize règles. La portée `COPY` désigne le registre prononcé, la portée `UI` le chrome, la
portée `SOURCE` un balayage des autres fichiers JS.

| # | Règle | Portée | Expression | Justification | État actuel |
|---|---|---|---|---|---|
| 1 | Aucun chiffre dans une chaîne prononçable | `COPY` | `/\d/` | R1 sous sa forme la plus forte. Une heure cible est autorisée mais elle vit dans un gabarit `UI` ; le registre prononcé n'a jamais besoin d'un nombre | **0 violation**, invariant à figer |
| 2 | Aucune durée en toutes lettres | `COPY` + `UI` | `/\b(une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|quinze|vingt|trente|quarante)\s+(secondes?|minutes?|heures?)\b/i` | Le contournement naturel de la règle 1. C'est exactement ce qui a produit `"Deux minutes pour toi"` et `"attendre deux minutes"` | 2 violations |
| 3 | Aucune parenthèse | `COPY` + `UI` | `/[()]/` | Prosodie et lecteur d'écran (§2). Volontairement plus large que la seule parenthèse de genre : `'Trajet estimé (minutes)'` doit tomber aussi | 5 + 5 violations |
| 4 | Aucun point médian ni point de genre | `COPY` + `UI` + `SOURCE` | `/[·•]/` et `/\p{Ll}\.e\b/u` | `'Clés, prêt·e'` est prononcé. Le balayage `SOURCE` est indispensable, la règle est inutile sans lui | 1 violation dans `store.js`, plus les séparateurs `·` de `ui.js` 428/937/1858 |
| 5 | Ponctuation finale obligatoire | `COPY` | `/[.?!]$/` | Sans ponctuation finale, la voix termine en suspension et enchaîne mal. C'est de la prosodie, pas de la typographie | **0 violation**, invariant à figer |
| 6 | Deux phrases au maximum | `COPY` | `(s.match(/[.?!]/g) || []).length <= 2` | Chaque point est un silence complet. Trois arrêts sur une phrase de cinq mots donne un débit robotique | 3 violations, dont les deux énumérations à passer en virgules (§1.3) |
| 7 | Aucun glyphe non prononçable | `COPY` + `UI` | `/[←→↑↓✓✗×·•+]/` | `'✓ envoyé'`, `'← Retour'`, `'+ Départ'` : lus « coche », « flèche gauche », ou ignorés selon la voix. Les glyphes appartiennent au CSS, pas à la langue | `UI.social_sent`, `UI.studio_add_profile`, `UI.preview_destination_add`, plus les fuites `ui.js`/`studio.js` |
| 8 | Longueur maximale d'une chaîne prononcée : 76 caractères | `COPY` | `s.length <= 76` | À `rate: 1`, une voix `fr-FR` débite environ 14 caractères par seconde : 76 caractères font 5 secondes. Au-delà, la voix parle encore quand la personne a déjà agi, et l'app se retrouve à commenter le passé | Maximum actuel 68, la marge est confortable, la règle est donc gratuite aujourd'hui et protège demain |
| 9 | Aucun anglicisme dans le registre prononcé | `COPY` | `/\b(yep|ish|check|deal|top|nice|ok|fail|timer)\b/i` | Une voix `fr-FR` prononce mal ou épelle. Portée volontairement limitée à `COPY` : `"C'est le deal"` (`ob3_body`) et `"Ok. À demain."` sont dans `UI`, ne sont pas prononcés, et sont assumés | 3 violations : `"Yep"`, `"bien-ish"`, `"Check rapide"` |
| 10 | R4 étendu aux paraphrases de la marge | `COPY` + `UI` | `/marge|seuil|tampon|coussin|par précaution|au cas où|prendre? du large|je pars large|sécurité/i` | La règle actuelle ne bloque que les mots techniques. Personne n'écrira « marge » ; tout le monde écrira « au cas où ». C'est par là que R4 fuira, et le registre du §3 rend le risque imminent | 0 aujourd'hui, prévention |
| 11 | R5 étendu à l'excuse et à la dette | `COPY` + `UI` | `/désolée?|malheureusement|dommage|tu n'as pas (encore )?(assez|su)|tu aurais|il aurait fallu|tu es en retard|rattraper ton retard/i` | Symétrique de la règle 10 pour le §3. Le premier réflexe de quiconque écrit l'incertitude est de s'excuser | 0 aujourd'hui, prévention |
| 12 | Aucune clé morte | `COPY` + `UI` | chaque clé apparaît au moins une fois dans `js/*.js` hors `copy.js` | Une chaîne que personne n'appelle est une chaîne que personne ne relit, et elle revient un jour telle quelle. Attrape `COPY.slip`, `UI.leave_slip`, `UI.bedside_quit_yes`, `UI.bedside_quit_no` | 4 violations |
| 13 | Aucune chaîne affichable hors `copy.js` | `SOURCE` | littéral de plus de 3 caractères contenant une lettre accentuée ou un espace, dans un contexte `aria-label:`, `placeholder:`, ou un enfant textuel de `el(...)` | C'est mon droit de veto rendu exécutable. Heuristique, donc à démarrer avec une liste d'exemptions explicite (`'min'`, noms de canaux, `'douce-heure.png'`) qu'on réduit à chaque jalon | environ 60 violations recensées au §4 |

Les règles 1, 5 et 8 sont des **règles positives** : elles n'interdisent pas, elles exigent.
C'est ce qui manque le plus au filet actuel, et ce sont les moins chères à ajouter puisque le
corpus les respecte déjà.

La règle 13 est la seule qui demande un vrai travail (analyse de `js/*.js`, faux positifs à
gérer). Je propose de la livrer en dernier, en mode avertissement d'abord, avec un compteur
qui ne doit jamais remonter : c'est le format que Milo utilise pour les dettes qu'on résorbe
sans bloquer.

---

## 6. Mes désaccords avec la vision

### 6.1 Désaccord principal : le registre de l'incertitude n'a rien à faire dans le live

La vision fait de J2, « La première semaine », le jalon le plus important, et lui donne
comme objet « la façon de parler de l'incertitude sans chiffre ». Je suis d'accord sur la
priorité et en désaccord sur le lieu.

La pente naturelle de ce jalon, telle que le document l'écrit, est de rendre l'app plus
bavarde au moment où elle sait le moins. Or les sept premiers matins sont aussi ceux où
l'utilisateur est le plus fragile, où il n'a pas encore de raison de faire confiance, et où
la moindre phrase mal placée décide de l'abandon au jour 4 que la vision veut précisément
éviter. Une app qui doute à voix haute pendant qu'une personne anxieuse s'habille ne fait
pas preuve d'honnêteté : elle transfère sa charge.

**Ma position : pendant le live, le jour 1 et le jour 30 doivent être indiscernables.** Mêmes
mots, même assurance, même absence de commentaire sur soi. L'app guide, point. Le registre de
l'incertitude vit dans trois endroits, et trois seulement :

- **l'aperçu**, avant que la session commence, quand l'utilisateur est encore assis et peut
  encore décider ;
- **le bilan**, après le départ, quand tout est joué et que plus rien ne presse ;
- **« Tes matins »**, l'écran de consultation, où l'on va exprès pour savoir.

Cela a une conséquence concrète sur J2 : les huit chaînes du §3.2 sont toutes placées hors
du guidage, aucune n'est prononcée pendant une étape, et je demande que ce soit écrit dans
la spec du jalon, pas laissé à l'appréciation du moment. La vision dit que « le silence est
un livrable » et que chaque jalon doit retirer quelque chose. Voilà ce que J2 retire :
**le droit de l'app de parler d'elle-même pendant que l'utilisateur agit.**

### 6.2 Désaccord secondaire : le critère de sortie de J2 fabrique de la gamification

Le critère écrit est : « un testeur qui n'a jamais vu l'app arrive à l'heure au premier
essai, et sait dire au septième matin ce que l'app a appris de lui ».

La seconde moitié pousse mécaniquement à faire du moteur un spectacle : écrans de preuve,
phrases de démonstration, mise en scène des acquis. C'est à un pas de la gamification que la
vision refuse explicitement au §3, et cela contredit son propre §6, qui vise
« Je ne sais pas comment elle sait, mais elle sait ».

Contre-proposition, plus dure à atteindre et plus fidèle au produit : **au septième matin, le
testeur se lève plus tard qu'au premier sans avoir rien remarqué, et il ne sait dire ce que
l'app a appris que s'il va exprès le consulter.** L'apprentissage se prouve par un lever plus
tardif à ponctualité constante, pas par une phrase que l'app se décerne.

### 6.3 Une tension à trancher, dans `CLAUDE.md` et pas ailleurs

La vision pose « l'honnêteté est un moteur » et R4 pose « la marge est invisible ». Ces deux
principes se croisent exactement sur la phrase la plus honnête que l'app pourrait dire, et
que R4 interdit : « comme je ne te connais pas encore, je pars plus tôt ».

Je tranche en faveur de R4, sans hésiter, mais je demande que l'arbitrage soit **écrit**,
parce que sinon quelqu'un rédigera cette phrase de bonne foi dans six mois, en croyant
appliquer la vision. La ligne que je propose d'ajouter à `CLAUDE.md` §2, sous R4 :

> L'app est honnête sur l'état de sa connaissance, jamais sur ce qu'elle en fait. Elle peut
> dire ce qu'elle ne sait pas encore ; elle ne dit jamais comment elle compense.

C'est court, c'est testable par la règle 10 du §5, et cela referme le seul chemin par lequel
R4 peut tomber.

---

## 7. Ce que je propose de faire, dans l'ordre

1. **Avant tout le reste** : les quatre règles du filet qui ne coûtent rien et gèlent les
   invariants déjà acquis (règles 1, 3, 5, 8 du §5). Une heure de travail, et le corpus ne
   peut plus régresser.
2. **`social.js` et `store.js`** : ce sont des chaînes prononcées ou envoyées à un tiers.
   `'Clés, prêt·e'` et `'Je suis parti(e) à l'heure ce matin 🌿'` sont les deux plus mauvaises
   chaînes du produit et elles ne sont pas dans mon fichier.
3. **La passe de ton sur `copy.js`** : les cinq retraits du §1.2, les cinq réécritures du
   §1.2 bis, la doctrine du locuteur unique du §1.1, les virgules du §1.3.
4. **Le registre de l'incertitude** (§3), en même temps que J2 et pas avant : ces chaînes
   n'ont de sens qu'articulées au moment où le moteur sait dire s'il sait.
5. **Les fuites** (§4), avec Iris pendant J4 pour les aria-labels, avec Nour pendant J1 pour
   `plan.js` l. 48 puisqu'elle découpe `ui.js` de toute façon.
6. **La règle 13**, en dernier, en avertissement, avec un compteur qui ne remonte jamais.

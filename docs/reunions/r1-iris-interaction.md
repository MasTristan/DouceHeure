# R1 · Iris Tanaka · Design d'interaction et accessibilité

Chantier J4, « Le corps de l'app ». Document de prise de poste, écrit après lecture
intégrale de `js/ui.js`, `js/studio.js`, `js/haptics.js`, `js/speech.js`, `js/scene.js`,
`js/app.js`, des quatre feuilles de style et de `index.html`. Aucun fichier produit n'a
été modifié.

Les contrastes cités sont calculés sur les valeurs réelles de `css/tokens.css`, méthode
WCAG 2.1 (luminance relative). Les numéros de ligne renvoient à l'état du dépôt au
moment de la lecture.

---

## 0. Verdict, avant le détail

Trois constats commandent tout le reste. Les deux premiers sont des vetos au sens de mon
périmètre : ils décrivent des interactions inatteignables, pas des interactions perfectibles.

**V1. Sous VoiceOver, en mode `hold`, l'app est inutilisable.** `holdButton`
(`js/ui.js:125-176`) ne confirme que sur un `setTimeout` de 600 ms armé au `pointerdown`
et désarmé au `pointerup` (lignes 149-166). L'activation VoiceOver sur iOS synthétise une
paire `pointerdown`/`pointerup` quasi instantanée puis un `click`. Le timer est donc annulé
avant d'avoir expiré, et aucun gestionnaire `click` n'existe sur la branche `hold`. Résultat :
la personne double-tape, rien ne se passe, et rien ne le lui dit. Elle ne peut ni avancer
d'une étape, ni sortir du live autrement qu'en quittant. Le mode `tap` la sauverait, mais il
est en réglages, derrière trois écrans qui utilisent eux-mêmes des boutons standards, donc
atteignables : elle peut y aller, mais il faut qu'elle devine que c'est là le problème. Ce
n'est pas une réponse d'accessibilité, c'est une énigme.

**V2. Le mode chevet n'a aucun élément actionnable.** `renderNight` (`js/ui.js:1693-1739`)
et `renderWakeProposal` (`js/ui.js:1743-1776`) posent leurs gestionnaires `onpointerdown`,
`onpointermove`, `onpointerup` directement sur le `<main class="screen screen--night">`.
Pas un `<button>`, pas un `role`, pas un `tabindex`, pas un nom accessible. Conséquences :
la luminosité n'est pas réglable au clavier ni sous lecteur d'écran, la sortie du mode
chevet non plus, et surtout **la confirmation du réveil est impossible sous VoiceOver**.
Une personne aveugle qui arme le mode chevet le soir ne peut pas l'éteindre le matin.

**V3. Le live se reconstruit intégralement toutes les 5 secondes.** `liveTicker`
(`js/ui.js:663`) appelle `renderLive` qui appelle `render` qui fait
`root.replaceChildren(node)` (`js/ui.js:100`). Le focus clavier est donc perdu toutes les
5 s, et le curseur VoiceOver est renvoyé en haut de page toutes les 5 s. Même si V1 était
corrigé, atteindre le bouton de confirmation resterait une course contre le ticker. C'est
la cause racine de plusieurs symptômes plus bas, et c'est le premier correctif à écrire.

Le reste du document déroule ces trois points et les met en regard des règles R1 à R5,
qu'aucune des corrections proposées ne remet en cause.

---

## 1. Audit du geste de confirmation

### 1.1 Lecture ligne par ligne de `holdButton` (`js/ui.js:125-176`)

| Lignes | Ce que fait le code | Verdict |
|---|---|---|
| 126-131 | Branche `mode === 'tap'` : `<button>` nu, `onclick` immédiat, `haptics.buzz('confirm')` puis `onConfirm()`. | Correct pour l'AT et le clavier, mais **aucun filet** : un tap accidental avance et écrit une mesure. Aucune annulation possible. |
| 128 | Classe `hold-btn--tap` posée. | **Cette classe n'existe dans aucune feuille de style.** Vérifié par recherche sur `css/`. Le mode tap est donc visuellement identique au mode hold, alors que le geste attendu est l'inverse. Le seul différenciateur est la ligne de texte `UI.live_tap_hint` (`js/copy.js:230`), placée sous le bouton, en `t-meta` 13 px, couleur `--text-dim`. |
| 134-137 | `<button class="hold-btn" aria-label={label}>` avec un `<span class="hold-btn__fill" aria-hidden>` et un `<span class="hold-btn__label">{label}`. | `aria-label` duplique exactement le libellé visible : inoffensif ici, mais fragile. Si un jour le libellé visible et l'`aria-label` divergent, on casse WCAG 2.5.3 (label-in-name) et la commande vocale « Appuie sur C'est fait ». À figer par convention. Pas de `type="button"`. |
| 134 | Aucun `aria-describedby`. | L'instruction du geste (« Maintiens pour confirmer ») est un `div` frère, sans lien programmatique (`js/ui.js:948`). Un lecteur d'écran annonce le bouton **sans jamais dire qu'il faut le maintenir**. C'est le défaut d'affordance central : l'information existe à l'écran et n'existe pas dans l'arbre d'accessibilité. |
| 139-147 | `cancel()` : `clearTimeout`, `holdActive = false`, retrait de `is-holding`, animation `is-spring` 300 ms. | Conforme à R2 et R3 : appui interrompu, rien n'avance, rien ne s'écrit. Bien. Mais **muet** : aucun `announce`, aucun haptique, aucun son. Une personne qui a raté son appui de 80 ms ne sait pas pourquoi il ne se passe rien. Elle recommencera, ratera encore, et conclura que l'app est cassée. |
| 149-164 | `pointerdown` : `preventDefault`, `setPointerCapture`, `--hold-x` depuis le point de contact, `is-holding`, timer 600 ms. | La capture de pointeur et l'absence d'annulation au mouvement sont **le bon choix** : un tremblement ou une dérive du doigt n'interrompent pas l'appui. C'est le seul endroit du code déjà pensé pour la motricité imparfaite. À conserver tel quel. |
| 155 | `--hold-x` calculé sur `e.clientX`. | Le remplissage part du point de contact. Joli, et sans effet fonctionnel. Sous `prefers-reduced-motion`, la transition tombe à 150 ms (`css/components.css:2014-2018`) : **le seul retour de progression visuel disparaît**, alors que le geste dure toujours 600 ms. Régression d'accessibilité créée par une règle d'accessibilité. |
| 157-163 | À l'expiration : `holdActive = false`, `haptics.buzz('confirm')`, `onConfirm()`. | Aucun `announce()`. La confirmation n'est signalée à un lecteur d'écran que par le rendu de l'étape suivante, via `speakStep` (`js/ui.js:702-710`), qui appelle bien `announce`. En pratique ça marche, par ricochet, mais rien ne dit « c'est enregistré ». |
| 161 | `haptics.buzz('confirm')`. | **`navigator.vibrate` n'existe pas sur Safari iOS** (`js/haptics.js:20` teste l'API et dégrade en silence, le commentaire ligne 2 l'assume). Sur la cible principale du produit, **le retour haptique est nul**. Il ne reste que le visuel. Pour une personne aveugle sur iPhone, le geste tenu n'est donc pas seulement difficile : il est aveugle et muet du début à la fin. |
| 165-166 | `pointerup` et `pointercancel` appellent `cancel`. | Manque `lostpointercapture` et `blur`. Cas réel : notification système ou changement d'app pendant l'appui, la capture est perdue sans `pointercancel` garanti, `holdActive` reste à `true`, et `renderLive` se bloque définitivement sur son garde ligne 875. L'écran fige jusqu'au prochain changement d'étape. |
| 167-173 | `keydown` sur Entrée ou Espace : `preventDefault`, `haptics.buzz`, `onConfirm()` immédiat. | **Deux défauts graves.** (a) Au clavier, R2 n'est pas appliquée du tout : un appui simple avance, alors que la règle produit exige un geste tenu. Le clavier est le seul périphérique capable de tenir une touche aussi bien qu'un doigt, et c'est celui où on a renoncé. (b) **`e.repeat` n'est pas testé.** Espace maintenu déclenche la répétition clavier (environ 30 `keydown`/s après 500 ms) : `onConfirm()` est appelé en boucle et **l'app traverse plusieurs étapes d'un seul appui**, en écrivant des mesures de durée nulle arrondies à 1 minute (`js/ui.js:718`, `Math.max(1, ...)`). C'est le bug de la douche par une autre porte : l'étape avance sans qu'un geste distinct ait été accompli pour elle, et le modèle est pollué en violation de R3. |
| 123, 875 | `holdActive` est un booléen **module**, partagé par toutes les instances. | Un seul bouton tenu à la fois dans les faits, donc pas de bug aujourd'hui. Mais c'est un état global caché dans un fichier qui va être découpé en six modules au J1 (Nour). À encapsuler avant la découpe, pas après. |

### 1.2 Les défauts, par gravité

1. **Bloquant.** Impossible de confirmer sous VoiceOver en mode `hold` (V1).
2. **Bloquant.** Espace maintenu au clavier avance plusieurs étapes et écrit des mesures
   fausses (ligne 167, `e.repeat` non testé). Violation de R2 et de R3.
3. **Bloquant.** Aucune instruction dans l'arbre d'accessibilité : le geste n'est pas
   annoncé (pas d'`aria-describedby`).
4. **Grave.** Aucun retour de progression non visuel, et sur iPhone aucun retour haptique
   du tout. L'appui tenu est un geste à l'aveugle pour qui ne voit pas l'écran.
5. **Grave.** L'appui interrompu est silencieux : pas de diagnostic pour la personne qui
   n'arrive pas à tenir.
6. **Grave.** `prefers-reduced-motion` supprime le seul indicateur de progression.
7. **Moyen.** Le mode `tap` n'a aucun style et aucun filet d'annulation.
8. **Moyen.** Fuite d'état sur perte de capture (`holdActive` bloqué à `true`).

### 1.3 Conception proposée : `confirmControl`

Un composant unique, quatre chemins d'activation **toujours actifs simultanément**, sans
aucun réglage préalable. Le réglage `confirmMode` survit, mais il ne conditionne plus
l'accessibilité : il choisit seulement le geste par défaut du pointeur.

```js
confirmControl({
  label,        // texte visible ET nom accessible, identique (copy.js)
  onConfirm,    // appelé au plus une fois par activation aboutie
  onUndo,       // optionnel : active la fenêtre d'annulation du chemin D
  mode,         // 'hold' | 'tap', defaut 'hold'
  tone,         // 'primary' | 'quiet' | 'night'
  holdMs = 600,
}) -> HTMLButtonElement
```

Le composant rend un `<button type="button">` porteur de :
`aria-describedby` vers un noeud d'aide qu'il crée et possède, `data-path` (`hold`, `tap`,
`assistive`) pour le style et pour les tests DOM de Milo, et `data-armed` pour le chemin C.

**Chemin A · Pointeur tenu** (comportement par défaut, mode `hold`)

- `pointerdown` : `preventDefault`, `setPointerCapture`, pose `--hold-x`, classe
  `is-holding`, `haptics.buzz('tap')` immédiat comme accusé de contact, arme deux timers :
  300 ms et `holdMs`.
- Aucune annulation au mouvement. Tolérance au tremblement conservée telle quelle.
- 300 ms : `haptics.buzz('crank')` (le motif existe déjà, `js/haptics.js:9`, et n'est utilisé
  nulle part) et, si `settings.sound`, une nouvelle signature audio `hold` très brève et très
  basse à ajouter dans `CUES` (`js/audio.js:71-76`). C'est le retour de progression non
  visuel qui manque aujourd'hui sur iPhone, où l'haptique n'existe pas.
- `holdMs` : retrait de `is-holding`, `haptics.buzz('confirm')`, `announce(UI.confirm_done)`,
  puis `onConfirm()`. Un drapeau `fired` garantit un appel unique par cycle.
- Relâchement avant `holdMs` : `is-spring`, aucune écriture (R3 intact), **et**
  `announce(UI.confirm_released)`. Au **deuxième** relâchement interrompu consécutif sur le
  même bouton, le noeud d'aide bascule sur le texte du chemin C. On détecte ainsi une
  motricité en difficulté sans jamais l'écrire dans un réglage ni la nommer à la personne.
- Annulation aussi sur `pointercancel`, `lostpointercapture`, `blur` et `visibilitychange`.

**Chemin B · Clavier**

- `keydown` Entrée ou Espace : `if (e.repeat) return;` puis `preventDefault` et démarrage du
  **même** timer que le chemin A, avec la même classe `is-holding` et le même remplissage.
- `keyup` ou `blur` avant `holdMs` : annulation, rien n'avance, rien ne s'écrit.
- R2 devient enfin vraie au clavier, et la répétition de touche cesse de traverser la
  séquence. C'est un durcissement de R2, pas un assouplissement.

**Chemin C · Activation assistive** (VoiceOver, Contrôle de sélection, Voice Control)

C'est la réponse à V1, et c'est le coeur de la proposition.

- Détection, sur l'écouteur `click` : l'activation est synthétique si `e.detail === 0`
  **ou** si aucun `pointerdown` n'a été reçu sur ce bouton dans les 1000 ms précédentes.
  Dans ces conditions, un maintien est physiquement hors de portée de la personne : la
  technologie d'assistance envoie une activation atomique, pas une pression.
- Réponse : **on ne confirme pas.** Le bouton passe en état armé :
  - `data-armed="true"`, style dédié (bordure ambre, pas d'animation),
  - le libellé visible **et** `aria-label` deviennent `UI.confirm_armed(next)`,
  - `announce(UI.confirm_armed_hint)` : « Encore une fois pour confirmer. »,
  - désarmement automatique après 8 s, à tout re-rendu, et à la perte de focus.
- Deuxième activation synthétique dans la fenêtre : `onConfirm()`.
- **Deux actes délibérés et séparés remplacent un acte tenu.** L'intention de R2 est
  respectée à la lettre : aucun avancement accidentel, aucun faux tap, l'app n'avance
  jamais seule. Ce qui change, c'est la modalité de la délibération, pas son existence.
- Recette bloquante, sur iPhone réel, VoiceOver actif : double-tap unique puis 9 s d'attente
  ne doit rien avancer ; deux double-taps en moins de 8 s doivent avancer d'exactement une
  étape ; le rotor doit annoncer le bouton, son libellé et son instruction.
- La détection par `e.detail === 0` est à valider sur appareil. Si elle s'avère instable sur
  une version de Safari, le repli est un réglage explicite « Confirmation en deux temps »,
  mais je considère le repli comme un échec de conception, pas comme la cible.

**Chemin D · Tap** (réglage explicite, motricité empêchant tout maintien)

- Confirmation immédiate au `click`, comme aujourd'hui : la personne a choisi ce mode pour
  sa directivité, on ne la ralentit pas.
- **Nouveauté : une fenêtre d'annulation de 6 s.** Le noeud d'aide sous le bouton devient
  un bouton « Revenir à \<étape précédente\> ». Annuler restaure `live.current`, restaure
  `live.startedAt` depuis un enregistrement d'annulation, et **retire la dernière entrée de
  `live.measurements`**. R3 est tenue exactement : pas de mesure fantôme, pas de mesure
  tronquée, et la mesure éventuelle de l'étape reprise reste un temps réellement écoulé.
- La fenêtre se ferme au bout de 6 s, ou à la confirmation suivante, et son ouverture comme
  sa fermeture sont annoncées.
- Le mode tap cesse d'être « le mode où une erreur est irréversible ».

**Style et mouvement.** `.hold-btn--tap` doit exister (`css/components.css`, aujourd'hui
absent) : pas de `hold-btn__fill`, un `:active` net. Et sous `prefers-reduced-motion`, le
remplissage ne doit pas être raccourci à 150 ms (`css/components.css:2014-2018`) mais
**remplacé par une progression discrète** : quatre paliers d'opacité de fond, à 0, 200, 400
et 600 ms. On respecte la demande (pas d'animation continue) sans supprimer l'information.

---

## 2. Audit d'accessibilité général

### 2.1 Bloquant

**B1. Le live détruit son DOM toutes les 5 secondes.** (`js/ui.js:663`, `95-101`, `873`)
Focus clavier perdu, curseur VoiceOver renvoyé en haut de page, toute exploration
interrompue. Le garde `if (holdActive) return` (ligne 875) protège l'appui en cours mais
pas le focus. Correctif : le ticker ne doit plus jamais reconstruire l'écran. Il ne fait
varier que trois choses (l'état `suggested`, le message, la carte de rattrapage) : ce sont
trois mutations ciblées de texte et de classe. Le `replaceChildren` reste réservé aux
changements d'étape.

**B2. Aucun élément actionnable dans le mode chevet.** (`js/ui.js:1702-1736`, `1748-1764`)
Détail de V2. Correctif : deux vrais `<button>` en bas de l'écran nuit, plus un
`<input type="range">` masqué visuellement mais exposé, avec `aria-label` « Luminosité »,
pour donner au clavier et au lecteur d'écran l'équivalent du swipe. Le swipe reste, il
devient un raccourci et cesse d'être le seul chemin. La zone de confirmation du réveil
(`renderWakeProposal`) devient un `confirmControl` plein écran, donc automatiquement
pourvue des chemins B et C.

**B3. Sous VoiceOver, en mode `hold`, aucune confirmation possible.** Voir §1.

**B4. Espace maintenu avance plusieurs étapes.** (`js/ui.js:167-173`) Voir §1.1.

**B5. `.btn--primary` échoue le contraste minimum en scène Jour.** L'encre est codée en
dur `#1a1208` (`css/components.css:31`) sur `--amber: #8a6018` (`css/tokens.css:113`) :
**3,32:1** pour du texte de 15 px en graisse 600. Le seuil AA est 4,5:1 (le texte n'est pas
« large » au sens WCAG : il faudrait 18,66 px en gras). C'est le bouton d'action principal
de **tous** les écrans, entre 8 h et 18 h. Et le commentaire `css/tokens.css:99` affirme
« AA partout, AAA sur le mot d'étape et le bouton de confirmation » : l'affirmation est
fausse et personne ne l'a vérifiée. Correctif : `--amber-ink` en token par scène, et
`#f5efe3` sur `#8a6018` donne 6,5:1.

**B6. Aucun support de la taille de texte système.** Recensement sur
`css/components.css` : **65 déclarations `font-size` en pixels fixes contre 7 qui passent
par `var(--base-scale)`.** Le « mode lisible » (`css/tokens.css:193-202`) porte
`--base-scale: 1.12` et relève `--t-body` et `--t-meta`, mais :
- `.btn` 15 px, `.pill` 13,5 px, `.text-input` 15 px, `.toast__body` 12 px ne bougent pas ;
- `--t-title` reste 22 px, `--t-hero` et `--t-step` sont des `clamp()` en `vw` : **le mot
  d'étape, l'élément le plus important de l'écran le plus important, ne grossit pas d'un
  pixel en mode lisible.**
En pratique le mode lisible change surtout la police (Atkinson) et laisse la typographie
à sa taille. Une personne réglée en Dynamic Type AX3 sur iOS n'obtient rien. Correctif au
§5, proposition 2.

### 2.2 Grave

**G1. L'état sélectionné des `pill` est purement visuel.** Transports (`js/ui.js:519-524`,
`302-307`, `js/studio.js:563-572`), destinations (`528-536`), scènes (`1436-1441`), mode de
confirmation (`1445-1452`), profils du chevet (`1581-1586`), filtres des matins
(`1316-1329`), canaux de contact (`js/ui.js:1972-1977`). Aucune n'expose `aria-pressed`,
aucun groupe n'est un `radiogroup`. Sous lecteur d'écran, **il est impossible de savoir
quel transport ou quelle destination est sélectionné.** Échec WCAG 4.1.2, sur au moins sept
groupes. Correctif mécanique : `role="radio"` + `aria-checked` dans un conteneur
`role="radiogroup"` avec `aria-label`, et navigation aux flèches. Une seule fonction
`pillGroup()` couvre les sept cas.

**G2. Aucun changement d'écran n'est annoncé.** `render()` (`js/ui.js:95-101`) remplace le
contenu sans déplacer le focus, sans mettre à jour `document.title`, sans région
d'annonce. Onze surfaces, zéro annonce de navigation. Correctif : après
`replaceChildren`, poser `tabindex="-1"` sur le premier titre et le focaliser, et annoncer
son texte. Coût : quatre lignes dans `render`.

**G3. `announce()` est sous-utilisée et sous-configurée.** (`js/ui.js:104-111`)
La région est `aria-live="polite"` sans `role="status"` ni `aria-atomic="true"`, et deux
textes identiques consécutifs ne sont pas ré-annoncés. Surtout, elle n'est appelée que
depuis `speakStep` (708) et `renderLeave` (1000). **Ne passent pas par elle** : le nudge
(`958-969`, qui va au `toast` et à `speech` uniquement), la mise en pause (`770-775`), la
reprise (`777-785`), l'arrivée du trajet (`1153-1161`), la proposition de rattrapage
(`895-917`), la bascule d'un réglage. Autrement dit, une personne qui a la voix F2 coupée
et un lecteur d'écran actif rate le nudge, c'est-à-dire le seul moment où l'app essaie
d'attirer son attention.

**G4. `toast()` est invisible pour les technologies d'assistance.** (`js/ui.js:80-93`)
Aucun `role`, aucun `aria-live`. Correctif : `role="status"`, ou mieux, router tout toast
par `announce()`. Même remarque pour le toast de mise à jour du service worker
(`js/app.js:22-27`), qui construit son `div` à la main.

**G5. Aucune modale ne piège le focus ni n'écoute Échap.** Recherche exhaustive : un seul
`Escape` dans tout le code, sur l'input de renommage du studio (`js/studio.js:475`). Les
surfaces concernées : le tiroir de séquence (`js/ui.js:852-868`), la feuille contact
(`1960-2002`), la modale d'ajout d'étape et le picker d'icône du studio
(`js/studio.js:169`, qui déclare pourtant `role="dialog" aria-modal="true"` sans en tenir
la promesse). Le focus reste derrière la modale, l'arrière-plan reste navigable au
lecteur d'écran, et le seul moyen de fermer est de viser le fond ou le bouton.

**G6. Le contraste du focus visible est insuffisant sur les surfaces.** `:focus-visible`
utilise `--border-focus` (`css/base.css:235-238`). Contre `--surface-hi`, qui est le fond
du bouton de confirmation : **3,05:1 en scène Aube**, sous le seuil de 3:1 une fois arrondi
à la précision utile, et **1,44:1 en scène Nuit** (`#3a2410` sur noir), c'est-à-dire
invisible. Correctif : anneau à deux couches, un liseré sombre plus un liseré clair, ce
qui rend le focus lisible quel que soit le fond, et un token `--focus-ring` dédié par
scène plutôt que le recyclage de `--border-focus`.

**G7. Cibles tactiles sous 44 px.** `.pill` fait environ 38 px de haut (`padding: 10px 16px`
sur 13,5 px de texte, `css/components.css:544-556`) et c'est le contrôle le plus utilisé de
l'app. `.drawer-move` 34x34 (`1707-1716`), `.drawer-skip` `min-height: 34px` (`1726`),
`.social-card-edit` et `.social-card-delete` 32x32 (`1297-1300`), `.toggle` 46x26
(`501-504`). Le minimum Apple est 44x44 pt. Les deux dernières sont des actions
destructives à 32 px. Correctif sans changer le dessin : `min-height: 44px` sur `.pill` et
pseudo-élément d'extension de zone (`::before` en `position:absolute; inset:-6px`) sur les
petits boutons carrés, ce qui agrandit la cible sans agrandir la forme.

**G8. Le libellé d'un `settingRow` n'est pas cliquable.** (`js/ui.js:1369-1380`) Seul
l'interrupteur de 46x26 px réagit. Correctif : envelopper la ligne entière, ou porter le
`onclick` sur la ligne et laisser le `role="switch"` sur l'interrupteur.

**G9. Les champs texte déclenchent le zoom iOS.** `.text-input` est en 15 px
(`css/components.css:471`). Safari iOS zoome le viewport à la mise au point de tout champ
sous 16 px, puis ne dézoome pas. Le `meta viewport` (`index.html:5`) n'a heureusement pas
de `maximum-scale`, donc le pincement reste possible, mais le saut visuel est brutal. Champs
concernés : prénom de l'onboarding (`js/ui.js:323-326`), trajet déclaré (`592-596`), prénom
et numéro de contact (`1921-1931`), nom d'étape du studio. Correctif : 16 px.

**G10. Ordre de lecture inversé sur l'écran live.** (`js/ui.js:931-954`) L'ordre du DOM est
wordmark, mot d'étape, « ensuite : X », carte de rattrapage, bouton de confirmation,
instruction du geste, liens du bas. L'instruction du geste est donc lue **après** le bouton
qu'elle décrit. Corrigé de fait par l'`aria-describedby` du §1.3, qui la rattache au bouton
où qu'elle soit dans le DOM.

**G11. Le bouton désactivé du bilan est hors du parcours clavier.**
(`js/ui.js:1214-1218`) `disabled` retire l'élément de l'ordre de tabulation : une personne
au clavier tabule et ne trouve jamais le bouton, sans savoir qu'il faut d'abord choisir une
option. Correctif : `aria-disabled="true"` plus un blocage dans le gestionnaire, en gardant
l'élément focalisable.

**G12. Les couleurs codées en dur hors de `tokens.css`.** Violation de la convention §7 de
`CLAUDE.md`, avec un effet direct sur l'accessibilité, puisque ces valeurs ne suivent
aucune scène : `.btn--primary { color: #1a1208 }` (`components.css:31`, voir B5),
`.toggle__thumb { background: white }` (`517`), `.social-card-delete:hover { color:
#e87a70 }` (`1324`), les `hsl()` en ligne des avatars (`js/ui.js:1062`, `1854`), et une
douzaine de `rgba()` d'ombre. Le blanc pur de l'interrupteur en scène Nuit est un point
lumineux dans un écran conçu pour n'en avoir aucun.

### 2.3 Le cas particulier du mode chevet dans le noir

Les tokens de la scène Nuit (`css/tokens.css:165-189`) donnent, sur fond `#000000` :

| Élément | Couleur | Contraste, voile à 0 | Voile par défaut 0,55 | Voile max 0,92 |
|---|---|---|---|---|
| `.night-clock` | `--amber` `#3a2410` | **1,44:1** | **1,12:1** | 1,02:1 |
| `.night-hint` (« Appui long pour quitter ») | `--text-mid` `#3a2410` | **1,44:1** | **1,12:1** | 1,02:1 |
| `.night-clock--waking` | `--text` `#4a2f14` | **1,71:1** | 1,18:1 | 1,03:1 |
| Anneau de focus | `--border-focus` `#3a2410` | **1,44:1** | | |

Le choix d'une luminance très basse la nuit est **juste** : le produit a raison de refuser
d'éblouir, et ces valeurs ne doivent pas être « corrigées » vers AA, qui n'a aucun sens à
3 h du matin. Le problème est ailleurs, et il est double.

1. **Le voile par défaut à 0,55 (`js/ui.js:1625`) rend l'écran illisible dès qu'il y a la
   moindre lumière ambiante** : lampadaire, veilleuse, lampe du conjoint. L'horloge à
   1,12:1 disparait. La personne ne peut plus lire l'heure, ce qui est la fonction première
   de l'écran, et n'a aucun moyen de le savoir. Correctif : partir à 0,25 et laisser le
   swipe assombrir. On peut toujours éteindre plus ; on ne devine pas qu'on peut éclaircir.
2. **L'unique indice de découverte du geste de sortie est invisible.** `.night-hint` est
   affiché à 1,12:1. La personne qui ne sait pas déjà qu'il faut un appui long est piégée
   dans le mode chevet. Correctif : porter le hint sur `--text` plutôt que `--text-mid`, et
   surtout, remplacer le geste caché par un vrai bouton (§3, dialogue 3).

Trois autres défauts nocturnes, hors contraste :

- **Conflit de gestes.** `renderNight` arme un `holdTimer` de 1 s à chaque `pointerdown`
  (`js/ui.js:1708-1710`) et ne l'annule qu'après 12 px de déplacement (`1715`). Un réglage
  de luminosité **lent et délicat**, exactement celui qu'on fait à moitié endormi, franchit
  moins de 12 px en une seconde et **déclenche la boîte de dialogue de sortie**. Le geste le
  plus légitime déclenche l'action la plus destructrice.
- **Course entre le tick et le geste.** `nightTick` toutes les 30 s (`1635`) appelle
  `renderNight` (`1678`), qui fait `replaceChildren`. Si un doigt est posé à ce moment, le
  `holdTimer` de la fermeture d'origine reste armé dans son ancienne portée et peut faire
  surgir le `confirm()` sur un écran qui n'existe plus, tandis que `night.swipeStart`
  (porté par l'objet `night`, donc partagé) est réutilisé par le nouveau noeud. Comportement
  indéterminé, la nuit, sur un geste tactile. À réécrire avec le même principe qu'en B1 :
  le tick ne reconstruit rien, il met à jour deux noeuds de texte.
- **Anti burn-in partiel.** Le décalage de 1 px (`1674-1675`, amplitude de 3 px sur 60 s)
  n'est appliqué qu'à `.night-clock` (`1729`). `.night-wake-time` et `.night-hint` restent
  strictement immobiles pendant huit heures. Leur luminance est faible, donc le risque est
  faible, mais l'intention de la mesure n'est pas tenue. Appliquer la translation au
  conteneur, pas à l'horloge seule.

### 2.4 Cosmétique, à traiter par opportunité

- `.icon` est en `stroke-width: 1.75` fixe (`css/base.css:212`) : les icônes ne s'épaississent
  pas en mode lisible.
- `topbar()` (`js/ui.js:73-78`) rend « ← Retour » sans `aria-label` ; la flèche est
  prononcée. Le studio, lui, pose l'`aria-label` (`js/studio.js:667`). Incohérence.
- `wordmark__dot` respire en boucle infinie (`css/base.css:113`) ; sous
  `prefers-reduced-motion`, la règle globale force `animation-iteration-count: 1`
  (`base.css:254`), donc le point s'arrête à mi-course dans un état d'opacité arbitraire.
- `.btn` déclare `font-weight: 600` alors qu'Atkinson n'a que 400 et 700
  (`css/fonts.css:44-57`) : en mode lisible, tous les 600 basculent en 700 et tous les 500
  en 400. La hiérarchie typographique se réorganise sans qu'on l'ait décidé.
- Le bouton de suppression de départ du studio est rendu à `opacity: 0.7` sur `--text-dim`
  (`js/studio.js:645`), soit **2,83:1**. L'action la plus destructive du studio est la moins
  lisible de l'écran.

---

## 3. Le remplacement des quatre dialogues natifs

### 3.1 Un composant unique, `js/sheet.js`

Oui, un seul composant, et il doit vivre dans son propre module : les deux `prompt()` sont
un copier-coller exact entre `js/ui.js:539-546` et `js/studio.js:590-597`, et `studio.js`
ne peut pas importer depuis `ui.js` sans créer un cycle. `sheet.js` ne contient que du
rendu, aucune règle de calcul : la séparation stricte de `CLAUDE.md` §4 est respectée.

**Fondation technique : l'élément `<dialog>` natif.** Zéro octet de dépendance, et il
apporte gratuitement ce que nous devrions écrire à la main : piège de focus, fermeture par
Échap via l'évènement `cancel`, inertie de l'arrière-plan, sémantique modale implicite,
couche supérieure. Supporté par Safari iOS depuis 15.4, donc couvert par la cible.

```js
askSheet({
  title,                       // copy.js
  body,                        // copy.js, optionnel
  confirmLabel, cancelLabel,   // copy.js
  tone: 'neutral' | 'destructive' | 'night',
  confirmGesture: 'tap' | 'hold',   // 'hold' reutilise confirmControl
  onConfirm, onCancel,
}) -> { close() }

askText({
  title, placeholder, value, maxlength,
  validate,                    // (string) -> bool, appele a chaque frappe
  confirmLabel, cancelLabel,
  onConfirm,                   // (string) -> void, jamais appele si invalide
}) -> { close() }
```

Comportement commun, non négociable :

1. `showModal()`, jamais `show()`. `aria-labelledby` sur le titre, `aria-describedby` sur
   le corps.
2. **Le focus initial va sur l'action la moins destructive** (`autofocus` sur Annuler).
   Une pression réflexe sur Entrée ne détruit jamais rien.
3. `document.activeElement` est mémorisé à l'ouverture et restauré à la fermeture, quelle
   que soit la voie de sortie.
4. Échap et le clic sur le fond appellent `onCancel`, jamais `onConfirm`.
5. `::backdrop` stylé par les tokens de la scène courante. Pas de blanc système, jamais.
6. Aucune animation d'entrée sous `prefers-reduced-motion`, et aucune en `tone: 'night'`.
7. Pour `askText`, le bouton de confirmation est `aria-disabled` tant que `validate` est
   faux, avec un message d'erreur relié par `aria-describedby`, et le champ est en 16 px.

### 3.2 Les quatre cas

**Cas 1 · `prompt(UI.preview_destination_prompt)`, `js/ui.js:540` et `js/studio.js:591`**

Devient `askText`. Aujourd'hui le retour est simplement testé non vide (`541`, `592`) puis
tronqué à 40 caractères dans `addDestination` (`js/travel.js:14`) : la troncature est
silencieuse. Avec `askText` : `maxlength: 40` réel, `validate` sur le trim non vide,
message d'aide relié, et le `prompt()` natif, qui sort la personne de la scène et se
comporte de façon erratique en PWA standalone sur iOS, disparait. Confirmation par tap :
nommer une destination n'est pas un acte risqué.

**Cas 2 · `confirm(UI.settings_import_confirm)`, `js/ui.js:1410`**

L'acte le plus destructif du produit : `saveState(result.state)` écrase l'intégralité de
l'état, historique et mesures comprises, sans sauvegarde préalable. Il mérite le geste
tenu. Donc `askSheet({ tone: 'destructive', confirmGesture: 'hold' })`, ce qui rend au
passage cette confirmation accessible au clavier et sous VoiceOver via les chemins B et C
de `confirmControl`.

Deux corrections annexes, dans la même passe :
- **Bug fonctionnel.** `e.target.value` n'est jamais réinitialisé. Si la personne annule et
  resélectionne **le même fichier**, l'évènement `change` ne se déclenche pas : rien ne se
  passe, sans explication. Réinitialiser à la fermeture de la feuille, dans les deux
  branches.
- Proposer un export de secours dans le corps de la feuille, avant de remplacer. Une ligne
  de copy, `downloadExport` existe déjà (`js/backup.js`).

**Cas 3 · `confirm(UI.bedside_quit_confirm)`, `js/ui.js:1709`, en pleine nuit**

C'est le cas qui compte, et il ne se règle pas par une simple substitution de composant.

Contraintes : ne pas éblouir, ne pas réveiller, ne pas surgir par accident, et rester
sortable pour quelqu'un qui vient d'ouvrir les yeux.

- `askSheet({ tone: 'night' })`. La feuille hérite des tokens `[data-scene='night']`, sans
  ombre, sans animation, sans `::backdrop` clair, sans son, sans haptique.
- **Problème à résoudre : la couche supérieure.** `<dialog>` en `showModal()` monte
  au-dessus de tout, y compris de `.night-veil` (`css/components.css:1994-1999`,
  `z-index: 5`). La feuille apparaitrait donc **plus lumineuse que l'écran** au moment
  précis où il ne faut pas. Correctif d'architecture : sortir l'opacité du voile de
  l'attribut `style` en ligne (`js/ui.js:1719`, `1735`) et la porter dans une variable CSS
  `--veil-o` posée sur `:root`. Le voile la lit, et la feuille nuit applique
  `filter: brightness(calc(1 - var(--veil-o)))`. La feuille est alors **exactement aussi
  sombre que l'écran que la personne a réglé elle-même**. Bénéfice collatéral : le voile
  cesse d'être manipulé par `querySelector` à chaque `pointermove` (`1718`).
- Confirmation de sortie par **maintien** (`confirmGesture: 'hold'`), annulation par tap,
  focus initial sur l'annulation.
- Et surtout : **le geste caché disparait.** Voir la proposition 3 au §5. Un appui long sur
  tout l'écran, qui entre en conflit avec le réglage de luminosité et dont l'unique indice
  est affiché à 1,12:1, n'est pas une interaction, c'est un mot de passe.

**Cas 4 · `confirm(...)` de suppression d'un départ, `js/studio.js:647`**

`askSheet({ tone: 'destructive', confirmGesture: 'tap' })`. On est de jour, au calme, dans
un écran d'édition : le maintien serait de la friction gratuite. Deux améliorations de
fond : nommer le départ supprimé dans le titre (aujourd'hui le message est le générique
`${UI.studio_delete_profile} ?`, donc on ne sait pas lequel on supprime) et rappeler dans
le corps que les mesures apprises pour ce départ partent avec lui, ce que le code fait
(`648`) et que rien ne dit.

### 3.3 Ce que le composant fait gagner ailleurs

Une fois `sheet.js` écrit, la modale contact (`js/ui.js:1960-2002`), le tiroir de séquence
(`852-868`), la modale d'ajout d'étape et le picker d'icône du studio se replient dessus,
et G5 tombe d'un coup. Milo obtient un test simple et grep-able : `prompt(` et `confirm(`
ne doivent plus apparaitre nulle part dans `js/`.

---

## 4. Ergonomie du matin

La situation de référence : 6 h 50, une main, écran à 20 % dans une pièce noire, yeux
ouverts depuis quarante secondes, capacité de décision proche de zéro.

### 4.1 Ce qui va bien et qu'il faut protéger

- `.hold-btn` en pleine largeur, `min-height: 64px` (`css/components.css:1564-1568`) :
  atteignable des deux pouces, impossible à rater en visée. C'est le meilleur objet de
  l'app.
- `.time-input` en 52 px (`components.css:445`) : lisible d'un coup d'oeil.
- La tolérance à la dérive du doigt pendant l'appui (§1.1, lignes 149-166).
- Le `padding-bottom: max(var(--space-md), env(safe-area-inset-bottom))` (`base.css:75`).

### 4.2 Zones d'atteinte du pouce, écran live

Ordre actuel du bas de l'écran (`js/ui.js:941-953`) : bouton de confirmation, espacement,
instruction, espacement, puis **une rangée de deux boutons fantômes, « Ouvrir la séquence »
et « Quitter »**. Sur un iPhone de 6,1 pouces, ces deux boutons occupent la bande la plus
confortable du pouce, entre 0 et 90 px du bas.

**Le contrôle le plus destructif de l'app est donc placé dans la zone la plus facile à
atteindre, sur l'écran utilisé à moitié endormi.** `abortLive` (`js/ui.js:952`, `1131-1136`)
n'a **aucune confirmation** : un tap, `stopLiveSession()`, et `live.measurements` part avec
l'objet. Toutes les mesures du matin sont perdues, silencieusement, et R3 fait qu'elles ne
seront jamais rattrapées. Un toast dit « Ok. À demain. » (`js/copy.js:242`).

Pendant ce temps, supprimer un départ dans le studio, à 14 h, au calme, demande une
confirmation. **Le modèle de risque est inversé.**

Changements demandés :

1. **« Quitter » sort de l'écran live.** Il rejoint le tiroir de séquence, à côté de
   « Mettre en pause » (`js/ui.js:858`), où il est déjà logiquement à sa place. Le bas de
   l'écran ne porte plus qu'un seul bouton fantôme, « Ouvrir la séquence », en pleine
   largeur, donc plus facile à viser qu'un demi-bouton.
2. **Quitter demande un maintien.** `confirmControl` avec `confirmGesture: 'hold'` dans le
   tiroir. Le même geste protège l'avancement et protège la sortie : une seule chose à
   apprendre.
3. **Le bouton de confirmation descend.** Avec la rangée du bas allégée, son bord bas passe
   d'environ 124 px à environ 70 px du bord de l'écran. Toujours au-dessus de la zone
   d'appui accidentel de la paume, et dans l'arc naturel du pouce.
4. **L'instruction du geste passe au-dessus du bouton** plutôt qu'en dessous, ce qui remet
   l'ordre de lecture d'aplomb (G10) et libère la place sous le bouton pour la fenêtre
   d'annulation du chemin D.

### 4.3 Luminosité et scène

Le vrai risque d'éblouissement n'est pas la nuit, il est à 8 h 00 en hiver.
`sceneForHour` (`js/scene.js:9-13`) bascule sur `day` à 8 h exactement, **à l'horloge**,
et la scène Jour a un fond crème `#f5efe3`. Une personne qui lance sa session à 7 h 58
dans une chambre noire prend le fond sombre ; à 8 h 01, une page blanche en pleine figure.

Correctif à coût nul, qui n'invente aucun réglage : **respecter
`prefers-color-scheme: dark`**. Si le système est en thème sombre, `resolveScene` ne
choisit jamais `day` en mode `auto` et reste sur `dawn`. La personne a déjà exprimé sa
préférence au niveau de l'OS ; l'app cesse de la contredire. Le réglage explicite de scène
(`js/ui.js:1436-1441`) garde évidemment la priorité.

Deuxième correctif : la transition de scène est en `var(--dur-crawl)`, 1200 ms
(`css/base.css:14`, `30`). Un fondu de 1,2 s vers un fond crème reste un fondu vers un fond
crème. Ce n'est pas la durée qu'il faut allonger, c'est la bascule qu'il ne faut pas faire.

### 4.4 Mode chevet, ergonomie nocturne

Au-delà de §2.3 :

- **Le voile démarre à 0,55 et va jusqu'à 0,92** (`js/ui.js:1625`, `1717`). L'amplitude
  totale du swipe est de 368 px, soit environ la moitié de la hauteur d'écran, pour un
  geste vertical d'une main dans le noir. C'est jouable, mais le point de départ est trop
  sombre (voir §2.3). Passer à 0,25 et conserver l'amplitude.
- **Aucun retour pendant le maintien de réveil.** `renderWakeProposal` (`1748-1757`) arme
  un timer de 600 ms sans aucun remplissage, sans haptique de contact, sans changement
  visuel. La personne qui vient d'ouvrir les yeux appuie, ne voit rien bouger, relâche, et
  le réveil continue à sonner. Le remplacement par `confirmControl` règle ça
  automatiquement : le remplissage radial existe déjà et fonctionne.
- **Rien n'indique où appuyer.** L'écran entier est la cible, mais rien ne le dit sinon
  `UI.bedside_wake_hold`, en `t-meta` au ras du bas. Une zone visible, large, centrée, et
  légèrement plus claire que le fond, résout la découvrabilité sans éclairer la pièce.

---

## 5. Trois propositions

### P1 · Le live cesse de se reconstruire

**Problème.** `liveTicker` reconstruit tout l'écran toutes les 5 s (`js/ui.js:663`, `95-101`,
`873`). Focus perdu, curseur VoiceOver renvoyé en haut, exploration impossible. C'est ce qui
rend l'écran principal inutilisable au lecteur d'écran, même une fois `holdButton` corrigé.

**Comportement attendu.** Au changement d'étape, on reconstruit (l'écran change vraiment).
Sur le tick, on ne fait que muter : la classe `state-suggested` sur le mot et sur le bouton,
le texte du message, l'apparition ou le retrait de la carte de rattrapage. Le focus n'est
jamais touché. Le ticker passe de 5 s à 15 s, ce qui suffit largement puisqu'il ne pilote
plus que des seuils exprimés en minutes. Toute mutation significative passe par
`announce()`, y compris le nudge (`958-969`), la pause et la reprise.

**Fichiers.** `js/ui.js` (`95-101`, `104-111`, `663`, `873-970`).
**Coût : M.**
**On retire.** Le garde global `holdActive` (`123`, `875`), qui n'a plus d'objet. Le
`toast()` du nudge, redondant avec le mot d'étape qui pulse et avec l'annonce. Et deux tiers
des réveils CPU du live, ce qui intéresse Nour pour le mode économie d'énergie.

### P2 · Le geste de confirmation devient un composant, avec quatre chemins

**Problème.** V1, B4, et l'absence totale d'affordance programmatique. Détail en §1.

**Comportement attendu.** `confirmControl` tel que spécifié au §1.3 : pointeur tenu inchangé
pour ceux qui le peuvent, maintien clavier réel (avec `e.repeat` neutralisé), **activation
assistive en deux temps**, et fenêtre d'annulation en mode tap. Trois retours de progression
(visuel, haptique là où il existe, audio bref) et un diagnostic parlé de l'appui interrompu.
Le composant remplace `holdButton` partout : live (`941-946`), réveil (`1748-1757`), sortie
du live, import de données, sortie du chevet.

**Fichiers.** `js/ui.js:125-176` puis `js/confirm.js` extrait ;
`css/components.css:1562-1618` et `2012-2018` ; `js/haptics.js` (motif `crank` enfin
utilisé) ; `js/audio.js:71-76` (nouvelle signature `hold`) ; `js/copy.js` (trois chaînes
nouvelles, propriété de Camille).
**Coût : M à L.** Le composant est M ; la recette VoiceOver sur appareil réel est L, et
elle n'est pas compressible.
**On retire.** La question « Appui tenu ou tap simple ? » de l'écran 3 de l'onboarding
(`js/ui.js:216-231`, `js/copy.js:182-185`). Le composant s'adapte désormais tout seul à la
technologie d'assistance détectée, et la question demandait à quelqu'un qui n'a pas encore
vu l'app de choisir entre deux gestes qu'il n'a jamais essayés. Le réglage reste en
réglages, où il est un ajustement et non un examen d'entrée. Un écran d'onboarding
s'allège : cela sert aussi le J2 de Léa.

### P3 · Une seule feuille, quatre dialogues natifs supprimés, et le risque remis à l'endroit

**Problème.** Quatre dialogues système, dont un en pleine nuit et un sur la destruction de
toutes les données (§3). Et, symétriquement, la seule action réellement destructive du
matin, quitter le live, n'a aucune confirmation et occupe la meilleure zone du pouce
(§4.2).

**Comportement attendu.** `js/sheet.js` avec `askSheet` et `askText` sur `<dialog>`, API et
règles du §3.1. Substitution des quatre appels. `--veil-o` en variable CSS pour que la
feuille nuit soit exactement aussi sombre que l'écran réglé par la personne. « Quitter »
descend dans le tiroir et passe par un maintien. Le tiroir, la modale contact, la modale
d'ajout d'étape et le picker d'icône se replient sur `sheet.js`, ce qui règle G5 partout
d'un coup.

**Fichiers.** `js/sheet.js` (nouveau) ; `js/ui.js:539-546`, `852-868`, `941-953`,
`1131-1136`, `1402-1416`, `1702-1739`, `1960-2002` ; `js/studio.js:590-597`, `643-658`,
`169`, modale d'ajout d'étape ; `css/components.css` (styles de `<dialog>` et `::backdrop`,
`1994-1999` pour le voile) ; `js/copy.js`.
**Coût : M.**
**On retire.** Les quatre `prompt()`/`confirm()`, vérifiable par un test grep de Milo. Le
bouton « Quitter » du bas de l'écran live. Le style en ligne du voile
(`js/ui.js:1719`, `1735`) et le `querySelector` par `pointermove`. Et deux implémentations
de modale sur trois dans `studio.js`.

---

## 6. Mes désaccords

### D1 · L'ordre des jalons est faux, et c'est mon désaccord principal

La vision place J4 en dernier (`docs/00-vision.md:128-138`). Je demande que **P1 et P2
remontent dans J1**, avant la découpe de `ui.js`.

Trois raisons, dans l'ordre de force.

**a) « Perfectible » et « inopérant » ne se hiérarchisent pas de la même façon.** Le
diagnostic de la vision est excellent, mais il classe l'accessibilité comme une qualité à
ajouter à un produit qui fonctionne. Ce n'est pas la situation : sous VoiceOver, en
configuration par défaut, **on ne peut pas confirmer une étape**, et **on ne peut pas
sortir du mode chevet**. Le concurrent, dit la thèse, est l'abandon au jour 4
(`00-vision.md:63-65`). Pour cette personne-là, l'abandon est au jour 1, matin 1, étape 1,
et aucun travail de J2 sur la première semaine ni de J3 sur l'estimateur ne l'atteindra
jamais, puisqu'elle n'atteindra jamais la deuxième étape.

**b) J1 se rend impossible à lui-même.** J1 promet « des tests de non-régression au niveau
du DOM sur les deux règles qui font le produit » (`00-vision.md:99-102`). Milo écrirait donc
le harnais R2 contre `holdButton` dans sa forme actuelle. Or cette forme est condamnée :
elle n'applique pas R2 au clavier et elle la contourne par la répétition de touche. On
figerait dans des tests un comportement qu'on a déjà jugé défaillant, puis on paierait deux
fois pour le défaire. **Les tests R2 doivent naitre contre le composant corrigé.**

**c) La découpe doit transporter le bon composant.** Découper `ui.js` en six modules avec
`holdButton` et son `holdActive` global à l'intérieur, puis corriger, revient à faire deux
fois le travail de relecture sur le seul fichier où les régressions R1 et R2 peuvent naitre
(`00-vision.md:35-38`). L'ordre juste est : corriger le geste, écrire les tests DOM contre
lui, découper avec le filet.

Ce que je ne demande pas : le reste de J4 (dialogues, Dynamic Type, nuit réelle) reste
volontiers en fin de cycle. Je demande le déplacement de deux éléments, pas du chantier.

### D2 · « Aucun nouvel écran principal » est écrit d'une façon qui va empêcher une bonne décision

La règle (`00-vision.md:85-87`) vise juste : le produit a onze surfaces, le cycle se joue
en profondeur. Mais telle qu'elle est formulée, elle sera opposée à `sheet.js`, qui ajoute
bel et bien une surface visible. Ce serait absurde : la feuille **remplace** quatre
surfaces système déjà présentes, elle est éphémère, elle ne s'inscrit pas dans la
navigation, et elle en fait disparaitre trois autres dans `studio.js`. Je demande la
reformulation en **« aucune nouvelle destination de navigation »**, ce qui interdit toujours
un douzième écran tout en autorisant les surfaces éphémères qui, elles, réduisent le
compte.

### D3 · R1 doit dire explicitement que la progression d'un geste n'est pas un compte à rebours

R1 interdit toute durée restante, affichée ou prononcée, et `tests/copy.test.mjs` en fait
respecter la lettre. Je suis entièrement d'accord sur le fond, et je ne demande aucune
dérogation. Mais le code montre déjà l'effet de bord : le remplissage de l'appui tenu est en
`aria-hidden` (`js/ui.js:135`), il n'existe aucun retour de progression non visuel, et sous
`prefers-reduced-motion` le remplissage est écrasé à 150 ms (`css/components.css:2014-2018`)
alors que le geste dure 600 ms. Quelqu'un, à un moment, a traité une barre qui se remplit
comme un décompte.

Ce n'en est pas un. **R1 parle du temps qui reste avant le départ. La progression d'un geste
décrit ce que fait la main, ici, maintenant.** Un utilisateur aveugle a besoin de savoir que
son appui est en train d'aboutir, exactement comme un utilisateur voyant le lit dans le
remplissage. Je demande une note d'application dans `CLAUDE.md` §2, sous R1 : *« le retour
de progression d'un geste en cours, visuel, haptique ou sonore, est hors périmètre de R1 »*.
Sans cette phrase, la prochaine personne supprimera de bonne foi le seul retour dont
disposent les gens qui ne voient pas l'écran.

### D4 · Le « tap simple » n'a jamais été une réponse d'accessibilité, et c'est ce qui a permis le trou

`CLAUDE.md` §2 présente le tap simple comme « option d'accessibilité » de R2. C'est une
option de **motricité**, et une bonne. Elle ne répond en rien au besoin d'un utilisateur de
lecteur d'écran, dont le problème n'est pas la force ni la stabilité mais le fait que sa
technologie d'assistance n'émet **pas de pression, seulement des activations atomiques**.
Le mot « accessibilité » posé sur cette case a fait croire que le sujet était traité, et
c'est très exactement pourquoi V1 a pu traverser toute une v2 sans être vu. Je demande la
requalification du libellé dans `CLAUDE.md` : « tap simple en option de motricité », et
l'ajout du chemin assistif comme obligation distincte de R2.

---

## 7. Ce dont j'ai besoin des autres

- **Camille.** Sept à neuf chaînes nouvelles : appui relâché, bouton armé, indice
  d'activation en deux temps, annulation en mode tap, titres et corps des quatre feuilles,
  libellé de la luminosité nocturne. Toutes seront prononcées : elles passent par
  `copy.js`, sans exception.
- **Milo.** Trois tests DOM bloquants pour R2 après P2 : Espace maintenu n'avance que d'une
  étape ; un `click` synthétique isolé n'avance rien ; deux `click` synthétiques en moins
  de 8 s avancent d'exactement une étape. Plus un test grep : aucun `prompt(` ni `confirm(`
  dans `js/`. Plus la recette VoiceOver sur iPhone réel, et une nuit branchée réelle.
- **Nour.** Arbitrage sur `<dialog>` en PWA standalone iOS, et sur la sonde
  `font: -apple-system-body` pour le Dynamic Type (proposition 2 du §2.1 B6), qui suppose
  une lecture de `getComputedStyle` au démarrage.
- **Léa.** Vérifier avec moi que la fenêtre d'annulation de 6 s du mode tap n'ajoute pas de
  charge de décision le matin. Mon intuition dit que non, puisqu'elle n'exige rien ; c'est
  précisément le genre d'intuition sur laquelle je ne veux pas trancher seul.
- **Sacha.** Confirmation que le retrait de la dernière entrée de `live.measurements` lors
  d'une annulation est bien la seule écriture à défaire, et qu'aucun état intermédiaire du
  modèle n'a été touché avant `onFeedback`.

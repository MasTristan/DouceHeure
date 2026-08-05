# R2 · Arbitrage

Décisions rendues après lecture des six diagnostics de R1. Chaque décision dit ce qui a été
contesté, ce que je tranche, ce que ça coûte et qui en répond. Les décisions structurantes
deviennent des ADR dans `docs/decisions/`.

---

## 0. Ce que la salle a fait à ma vision

Cinq personnes sur cinq, depuis cinq angles indépendants, ont contesté **le même point** :
l'ordre de J1. Léa au nom de la donnée observable, Nour au nom de l'objet du risque, Milo au
nom du filet, Iris au nom des gens qui ne voient pas l'écran, Camille au nom de ce que l'app
doit taire. Aucun ne s'était concerté.

Quand une équipe converge à ce point contre son propre document d'ouverture, ce n'est pas de
la résistance au changement, c'est un résultat. **Je concède le séquencement en entier.**

Le raisonnement qui me fait céder est celui de Nour, parce qu'il corrige un fait et pas une
préférence. J'ai écrit que `ui.js` « est le seul fichier où les régressions R1 et R2 peuvent
naître ». C'est faux. Elles naissent dans `liveStatus()`, `confirmNext()` et `nightTick()`,
soit environ 25 lignes réellement décisionnelles sur 2 006. Découper les 2 006 sans avoir
extrait et testé les 25, c'est faire la partie risquée du travail avec le filet le plus
mince. Et Milo a démontré, en l'exécutant, que le `ui.js` actuel est pilotable sous node
avec 139 lignes de faux DOM : l'obstacle que j'invoquais pour justifier la découpe préalable
n'existe pas.

Trois autres corrections que j'accepte sans discussion, parce qu'elles portent sur des faits :

- **Ma phrase sur `copy.test.mjs` était fausse dans sa moitié rassurante** (Milo, §6.3). Le
  filet couvre 246 chaînes de `copy.js`. Il ne couvre ni les ~49 littéraux français qui
  vivent hors du fichier, ni R2, ni R3. Sur cinq règles, une et demie sont exécutables. Un
  document de vision fixe ce que l'équipe croit acquis, et on ne finance jamais la
  protection de ce qu'on croit déjà protégé. La phrase est corrigée.
- **Ma liste des six menaces ratait le défaut le plus coûteux** (Nour, §5.2) : la fuite de
  Wake Lock. Vérifiée dans le code, certaine dès le deuxième usage.
- **Pour un utilisateur de VoiceOver, l'abandon n'est pas au jour 4, il est au matin 1,
  étape 1** (Iris, D1a). Ma thèse entière est bâtie sur « le concurrent est l'abandon au
  jour 4 ». Elle est juste pour la majorité et aveugle pour une minorité qui, elle,
  n'atteint jamais la deuxième étape.

---

## 1. Décisions de séquencement

### DEC-01 · Un jalon J0 est créé : « Ce qui saigne »

**Contesté.** L'ordre J1 → J2 → J3 → J4.

**Décision.** J1 tel qu'écrit est dissous. Un jalon J0 le précède, composé exclusivement de
défauts vérifiés dans le code, dont aucun n'était dans mon diagnostic d'ouverture. Aucun ne
demande d'arbitrage de conception : ce sont des choses cassées.

| # | Défaut | Preuve | Règle violée | Propriétaire |
|---|---|---|---|---|
| B1 | Les mesures du matin sont perdues si l'app est fermée pendant le trajet | `ui.js:1088` + `copy.js:256` invite au geste destructeur | R3 (rien n'est appris) | Léa + moi |
| B2 | Le clavier confirme instantanément et remplit la mémoire de mesures à 1 min | `ui.js:167-173` | **R2 et R3** | Iris (forme), Milo (test) |
| B3 | Sous VoiceOver, aucune étape ne peut être confirmée, ni le chevet quitté | `ui.js:149-173`, aucun gestionnaire `click` en mode `hold` | R2 inatteignable | Iris |
| B4 | Fuite de Wake Lock : l'écran ne s'éteint plus jamais après une session | `wakelock.js:23-30` | le pacte de `copy.js:221` | Nour |
| B5 | `saveState()` sans `try/catch`, `history` sans FIFO | `store.js:213-215` | perte de matin en cours | Nour |
| B6 | Repli mort du service worker : écran blanc hors-ligne | `service-worker.js:83` | promesse hors-ligne | Nour |
| B7 | La destination choisie dans l'Aperçu n'est jamais persistée | `ui.js:529-543` n'écrit que dans `data` | F5 ne boucle jamais | Léa |
| B8 | La scène Nuit est atteignable par un import de sauvegarde | `scene.js:15-19` + `backup.js` sans énumération | piège §6 de `CLAUDE.md` | Milo |

**Coût cumulé estimé : moins de 150 lignes.** B1 et B2 sont les deux plus graves du projet
et aucun des deux n'était dans mon document de vision.

**Ce que ça change pour la thèse.** Ma thèse tient, mais elle était incomplète : l'app ne
perd pas seulement l'utilisateur au jour 4 par tiédeur, elle le perd au jour 2 en n'ayant
rien appris du jour 1 (B1), et elle perd certaines personnes au matin 1 (B3).

### DEC-02 · L'ordre de J1 devient : filet, puis extraction, puis découpe

**Décision.** J'adopte l'ordre commun de Nour et Milo.

1. **CI d'abord**, dans la première heure. Nour a raison de la classer première : 41 tests
   que personne n'exécute ont une valeur d'assurance nulle, et le projet a déjà été
   abandonné une fois.
2. **Le filet contre le `ui.js` actuel**, non modifié. Il fixe le comportement d'aujourd'hui
   comme référence, verrues comprises.
3. **Extraction des ~25 lignes décisionnelles** en machine à états pure, validée à chaque
   commit par le filet.
4. **Découpe par écran**, et seulement là.

**Et j'acte la clause d'arrêt de Nour** : si le temps manque, on livre jusqu'à l'étape 3 et
on s'arrête. Un `ui.js` de 2 006 lignes dont la décision d'avancement est pure, extraite et
testée vaut mieux qu'un `ui.js` en vingt fichiers dont personne ne teste l'avancement.

**Je remplace mon critère de sortie.** « On peut modifier `ui.js` sans peur » est un
sentiment : il ne se contrôle pas, donc il se déclare, donc il se déclare vrai. J'adopte les
quatre conditions vérifiables de Milo, dont celle que je trouve la meilleure : **le filet
doit être éprouvé en introduisant volontairement la régression sur une branche jetable et en
vérifiant qu'il vire au rouge.** Un filet non éprouvé n'est pas un filet.

### DEC-03 · Les dialogues natifs descendent en J1

**Contesté.** Je les avais mis en J4, comme sujet de marque.

**Décision.** Accordé, sur l'argument de Milo, qui est technique et pas esthétique :
`confirm()` et `prompt()` sont bloquants et non simulables. Chacun est un mur au milieu d'un
chemin de test, et ils se trouvent pile sur les deux chemins les plus destructeurs de l'app :
**perdre sa nuit** (`ui.js:1709`) et **perdre ses données** (`ui.js:1410`). Ce ne sont pas
des verrues, ce sont des zones que la qualité ne peut pas atteindre.

Composant minimal non bloquant en J1 par Milo, version définitive par Iris en J4.

---

## 2. Décisions de produit

### DEC-04 · L'incertitude ne se dit jamais pendant le live

**Contesté.** Camille attaque la pente naturelle de mon J2 : un « langage de l'incertitude »
rend l'app plus bavarde au moment où elle sait le moins et où l'utilisateur est le plus
fragile.

**Décision.** Accordé, et je vais plus loin qu'elle ne demande. **Pendant le guidage, jour 1
et jour 30 doivent être indiscernables.** C'est une règle, pas une préférence : l'écran live
est le seul moment où la personne agit, et l'agir n'a pas besoin de savoir ce que la machine
ignore. L'incertitude s'exprime dans l'Aperçu, dans le Bilan et dans « Tes matins ».
Nulle part ailleurs.

**Et je corrige mon propre critère de sortie de J2.** J'avais écrit que l'utilisateur devait
« savoir dire au septième matin ce que l'app a appris de lui ». Camille a raison : ça
fabrique de la gamification et ça contredit le §3 de ma propre vision. Nouveau critère : *un
testeur qui n'a jamais vu l'app arrive à l'heure au premier essai, et au septième matin son
heure de lever a bougé sans qu'il ait eu à régler quoi que ce soit.* Le progrès se constate,
il ne se raconte pas.

### DEC-05 · Épicène sans exception, et la voix redescend dans `copy.js`

**Décision.** Doctrine épicène accordée en entier. `'Clés, prêt·e'` (`store.js:26`) part à la
synthèse vocale via `ui.js:709` : le point médian est prononcé. Tous les `(e)` et points
médians disparaissent des chaînes affichées comme prononcées.

Je **refuse la séparation affiché / prononcé**, comme Camille le demande elle-même : deux
corpus dont un seul est relu, c'est la porte par laquelle R4 fuit. J'accorde en revanche sa
demande étroite : la composition vocale faite à la main dans `ui.js` (l.708, 1000, 1782)
redescend dans `copy.js`.

### DEC-06 · La cible de calibration est écrite : 90 % / 10 minutes

**Contesté par personne, et c'est le problème.** Aucun objectif de calibration n'existe nulle
part dans le projet. Or les simulations montrent que le moteur converge vers **24 minutes
d'avance quotidienne pour 118 minutes de lever anticipé**. Sans cible écrite, le moteur
optimise « ne jamais être en retard », dont la solution optimale est « lève-toi deux heures
avant ». C'est ce qu'il fait.

**Décision, et elle m'appartient.** Cible : **90 % d'arrivées à l'heure ou en avance, pour
une avance moyenne de 10 minutes ou moins.** Contre 97 % pour 24 minutes aujourd'hui. Oui,
j'échange délibérément trois points de ponctualité contre un quart d'heure de sommeil
quotidien. Une app qui vous fait arriver systématiquement une demi-heure trop tôt ne résout
pas le retard chronique, elle le remplace par une autre taxe, et celle-là se paie tous les
jours. Détail et justification : ADR-002.

### DEC-07 · La progression d'un geste n'est pas un compte à rebours

**Décision.** Accordé à Iris, et c'est important. R1 interdit d'afficher le temps qui reste
avant le départ. La progression d'un appui décrit ce que fait la main, ici, maintenant. Le
remplissage est aujourd'hui en `aria-hidden` (`ui.js:135`) et il n'existe aucun retour non
visuel : quelqu'un a traité une barre qui se remplit comme un décompte.

Note d'application ajoutée à `CLAUDE.md` §2 sous R1 : *le retour de progression d'un geste en
cours, visuel, haptique ou sonore, est hors périmètre de R1.* Sans cette phrase, la
prochaine personne supprimera de bonne foi le seul retour dont disposent les gens qui ne
voient pas l'écran.

### DEC-08 · « Tap simple » est requalifié en option de motricité

**Décision.** Accordé. `CLAUDE.md` §2 présente le tap simple comme « option d'accessibilité »
de R2. C'est une option de **motricité**, et une bonne. Elle ne répond en rien au besoin
d'un utilisateur de lecteur d'écran, dont la technologie n'émet pas de pression mais des
activations atomiques. Le mot « accessibilité » posé sur cette case a fait croire que le
sujet était traité, et c'est exactement pourquoi B3 a traversé toute une v2 sans être vu.

Le chemin assistif devient une **obligation distincte de R2**, pas une option de réglage.

### DEC-09 · « Aucun nouvel écran principal » devient « aucune nouvelle destination de navigation »

**Décision.** Accordé à Iris. La règle visait juste mais aurait été opposée à une feuille de
confirmation qui **remplace** quatre surfaces système et en fait disparaître trois autres.
La reformulation interdit toujours un douzième écran et autorise les surfaces éphémères qui
réduisent le compte.

---

## 3. Décisions techniques

### DEC-10 · Le veto de Nour sur les dépendances est confirmé, intégralement

**Décision.** Zéro dépendance runtime, **zéro dépendance de test**, zéro bundler, zéro
navigateur headless. Y compris jsdom. Ajouter un `node_modules` et un fichier de
verrouillage à un dépôt qui n'en a aucun, pour tester 164 Kio, est un mauvais échange.

Milo n'en a d'ailleurs pas besoin : son faux DOM de 139 lignes pilote le `ui.js` actuel en
0,24 s et **a trouvé un bug réel de production** (B2) avant même d'être adopté. C'est
l'argument le plus court possible en sa faveur. `tests/tiny-dom.mjs` est accepté comme code
de test du dépôt. Détail : ADR-001.

### DEC-11 · Ordre des travaux du moteur

**Décision.** J3 est ordonné par rapport valeur sur coût, pas par élégance :

1. Composition correcte des variances. **Deux lignes.** Le terme de variance est saturé
   99,8 % du temps en régime établi : la marge « adaptative » est en réalité la constante
   `3 + 10 + latenessScore * 8`. La correction est ce qui rend la marge adaptative pour la
   première fois depuis l'origine.
2. Variance a priori au démarrage à froid, dans `predict` uniquement, sans aucune écriture
   dans `step.real`. R3 intacte.
3. Estimateur robuste, contre les huit jours de contamination d'un matin aberrant.
4. Mémoire plus longue et pondérée par la récence. Le moins urgent des quatre.

### DEC-12 · Ce que chaque jalon retire

Ma règle « chaque jalon retire quelque chose » était trop faible : Léa fait remarquer qu'elle
compte des écrans alors qu'elle devrait compter **des décisions prises après le réveil**.
Accordé, la règle est reformulée ainsi. Et J1 retire du concret : quatre dialogues natifs, et
la confiance aveugle.

---

## 4. Feuille de route révisée

| Jalon | Objet | Critère de sortie |
|---|---|---|
| **J0 · Ce qui saigne** | Les huit défauts B1 à B8 | Les huit corrigés, chacun avec son test |
| **J1 · Socle de confiance** | CI, filet, extraction, découpe (arrêt possible après extraction), dialogues natifs | Les quatre conditions vérifiables de Milo, filet éprouvé au rouge |
| **J2 · La première semaine** | Estimation initiale, incertitude hors du live, premier plan sans données | Un testeur neuf arrive à l'heure au premier essai ; au septième matin son lever a bougé sans réglage |
| **J3 · Le moteur** | Composition, variance a priori, estimateur robuste, mémoire | Cible 90 % / 10 min tenue sur historiques simulés, en CI |
| **J4 · Le corps de l'app** | Accessibilité complète, Dynamic Type, feuille définitive, nuit réelle | Recette §19 en entier sur appareil réel, nuit comprise, VoiceOver compris |

**Ce qui a changé depuis ma vision d'ouverture :** un jalon est apparu devant tous les
autres, J1 a été retourné, et deux de ses éléments sont remontés de J4. Le cap n'a pas
bougé.

---

## 5. Ce que je dois aux autres

- **À Léa.** Elle avait raison sur le vice de l'estimation initiale, et les simulations le
  chiffrent plus durement qu'elle : à déclaration exacte, le jour 1 tombe de 50 % à 6 % de
  matins en retard. **La totalité de l'échec du premier jour vient du biais de déclaration.**
  Son P3 (calibrage par deux heures d'horloge, jamais une durée) devient la proposition
  centrale de J2.
- **À Milo.** Sa demande de correction de ma phrase sur `copy.test.mjs` n'était pas de la
  coquetterie de rédaction. Il a raison sur le fond et sur la raison.
- **À Iris.** J'ai classé l'accessibilité comme une qualité à ajouter à un produit qui
  fonctionne. Pour une partie des gens, le produit ne fonctionne pas du tout.
- **À Camille.** Son « jour 1 et jour 30 indiscernables pendant le live » est une meilleure
  règle que celle que j'avais écrite, et elle m'a fait corriger mon propre critère de sortie.
- **À Nour.** Sa clause d'arrêt après l'extraction est la meilleure idée de gestion du
  risque de toute la réunion.
- **À Sacha.** Sa session a été coupée avant qu'il ne rende. J'ai tenu son chantier moi-même
  et les chiffres sont dans `r1-moteur-temporel.md`. Le travail reste à reprendre par lui.

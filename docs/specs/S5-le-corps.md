# S5 · Le corps de l'app

**Jalon** : J4 · **Propriétaire** : Iris Tanaka · **Chaînes** : Camille Ndiaye
**Recette** : Milo Vasseur · **Perf** : Nour Belkacem

Dernier jalon du cycle. C'est celui où le produit cesse d'être bon en théorie.

Les trois jalons précédents ont travaillé sur ce qui se vérifie sans appareil : la fiabilité
(J1), la première semaine (J2), le moteur (J3). 210 tests tournent à chaque poussée. **Et
personne n'a jamais lancé cette app sur un iPhone dans le cadre de ce cycle.** Ni VoiceOver,
ni une nuit branchée, ni une mesure de temps de premier rendu. J4 est le jalon qui va
chercher ce que les tests ne peuvent pas atteindre, et il faut le dire dans cet ordre : le
travail d'accessibilité vient d'abord, la recette le valide, et la recette peut invalider le
travail.

---

## 1. Ce qui est arrivé ici depuis les autres jalons

| Origine | Sujet | Pourquoi c'est resté |
|---|---|---|
| S2 §7 | Les chaînes prononcées à l'armement du geste | J0 a livré la machine, pas la voix |
| S2 §3.1 | La forme définitive de la feuille de confirmation | J1 a livré le composant minimal et vérifiable de DEC-03 |
| S2 §6 | Le mode chevet pleinement actionnable | J1 a rendu la sortie atteignable, pas le reste |
| ADR-005 | La mesure réelle du temps de premier rendu | Aucune machine ne peut la faire (ADR-001) |
| Vision §4 | Dynamic Type, contrastes, ergonomie nocturne | Prévu ici depuis l'origine |

---

## 2. Article 1 · Dynamic Type

**C'est le plus gros morceau, et le plus mal parti.**

**Constat, vérifié.** `css/` compte **77 déclarations `font-size` en pixels** contre 4 en
unités relatives. Deux tailles seulement sont fluides (`--t-hero`, `--t-step`, en `clamp()`
sur la largeur de fenêtre, ce qui suit l'écran et non le réglage de l'utilisateur). Le corps
de texte est à 16 px fixes.

Conséquence : **le réglage « Taille du texte » d'iOS n'a aucun effet sur l'app.** Une personne
qui a agrandi son système parce qu'elle en a besoin ouvre Douce heure et retrouve du 16 px.

Le mode « lisible » (`.readable`, `--base-scale: 1.12`) existe et ne remplace pas Dynamic
Type : c'est un réglage manuel de plus, dans une app dont la règle est d'enlever des
décisions. Il fait le mauvais travail au mauvais endroit.

**À livrer.**

1. Toutes les tailles de texte dérivent d'une échelle en `rem`, et `html { font-size }` suit
   la préférence système. Sur iOS Safari, le levier est `font: -apple-system-body` sur un
   élément de référence, dont la taille calculée reflète le réglage Dynamic Type.
2. L'échelle typographique de `tokens.css` devient relative. Les 77 déclarations en pixels
   passent par les tokens ou disparaissent.
3. Les mises en page tiennent à 310 % de taille de texte sans perte de contenu ni de
   fonction. En particulier : l'écran live, le bouton de confirmation, et la feuille.
4. `.readable` est **conservé mais requalifié** : il ne change plus que la fonte (Atkinson
   Hyperlegible) et l'italique, plus la taille. La taille appartient au système.

**Ce que ça retire (DEC-12).** Un réglage de taille dans l'app, remplacé par celui que la
personne a déjà fait une fois pour tout son téléphone.

**Tests.** Un test de feuille de style qui échoue si une `font-size` en pixels réapparait
hors de `tokens.css`. Le reste se voit à l'œil, sur appareil, et entre dans la recette.

---

## 3. Article 2 · Contrastes

**Constat.** Les quatre scènes ont été dessinées à l'œil. Aucune mesure de contraste n'existe
dans le dépôt. La scène Nuit, en particulier, est délibérément très sombre (texte `#4a2f14`
sur fond `#000000`) parce qu'elle ne doit pas réveiller : c'est un choix produit assumé qui
**ne peut pas** viser AA.

**À livrer.**

1. Un test qui calcule le ratio de contraste de chaque couple texte/fond déclaré dans
   `tokens.css`, pour les scènes Aube, Plein jour et Soir. Cible : **AA (4,5:1) sur le corps
   de texte, AAA (7:1) sur le mot d'étape et le bouton de confirmation**, ce que la spec v2
   annonce déjà sans le vérifier.
2. La scène Nuit est **exemptée explicitement**, avec sa raison écrite dans le test lui-même.
   Une exemption tacite est un bug ; une exemption écrite est une décision.
3. Ce qui échoue est corrigé dans `tokens.css`, et nulle part ailleurs (`CLAUDE.md` §7).

**Tests.** `tests/contrast.test.mjs`, calcul WCAG en une trentaine de lignes, sans dépendance.

---

## 4. Article 3 · La feuille de confirmation, forme définitive

DEC-03 avait tranché : composant minimal et vérifiable par Milo en J1, forme définitive par
Iris en J4. Le minimal est livré (`js/ui/sheet.js`, 12 tests) et se comporte correctement :
dialogue nommé, piège de focus, Échap et voile valant renoncement, focus rendu à l'ouvrant,
focus initial sur le renoncement et jamais sur l'action destructrice.

**Ce qui reste, et c'est de l'ergonomie, pas de la mécanique.**

1. **Atteignable à une main.** Les actions sont en bas de la feuille, dans la zone du pouce.
   À vérifier sur un vrai téléphone, sur les deux tailles d'iPhone les plus courantes.
2. **L'animation d'entrée respecte `prefers-reduced-motion`** (déjà fait) et ne dépasse pas
   la durée où la feuille est déjà utilisable.
3. **La variante nocturne.** La feuille hérite de la scène Nuit par les tokens, ce qui est le
   bon mécanisme, mais personne ne l'a vue à 3 h du matin. La sortie du chevet est le chemin
   le plus sensible du produit : c'est là qu'on juge.
4. **Le geste de fermeture par glissement vers le bas**, si et seulement si la recette montre
   qu'il manque. Pas avant.

**Tests.** Les tests existants suffisent pour la mécanique. Cet article se juge en recette.

---

## 5. Article 4 · Le mode chevet pleinement actionnable (S2 §6)

**Constat, vérifié.** La sortie du chevet et la confirmation du réveil sont maintenant
focusables et nommées (J0/J1). **Le réglage de luminosité ne l'est pas** : il ne s'obtient
que par un glissement vertical du doigt (`night/view.js`, `onpointermove`), sans aucun
équivalent au clavier ni pour une technologie d'assistance.

Plus grave, et non traité : l'écran de nuit expose son `<main>` entier comme un bouton nommé
« Quitter le mode chevet ? ». **L'heure affichée et l'heure de réveil ne sont donc pas lues**
par un lecteur d'écran comme du contenu : une personne aveugle en mode chevet ne peut pas
savoir quelle heure il est, ni à quelle heure elle sera réveillée.

**À livrer.**

1. Le contenu (heure courante, heure de réveil) redevient du contenu lisible, et l'action de
   sortie devient un élément distinct plutôt que l'écran entier.
2. Un contrôle de luminosité focusable et actionnable au clavier, en plus du glissement.
   `role="slider"` avec `aria-valuenow` et un pas au clavier, ou deux boutons, au choix
   d'Iris. Contrainte : aucun contraste qui éblouisse, aucune animation qui réveille.
3. Les chaînes correspondantes dans `copy.js` (article 5).

**Tests.** Sous `tiny-dom` : l'heure de réveil est atteignable en texte, le contrôle de
luminosité a un nom accessible, et la modifier au clavier change bien `night.veil`.

---

## 6. Article 5 · Les chaînes du geste (S2 §7)

Sept à neuf chaînes, toutes prononcées, toutes dans `copy.js` sans exception. Propriété de
Camille.

| Chaîne | Moment |
|---|---|
| Appui relâché avant terme | Le maintien s'interrompt, rien n'avance, rien ne s'écrit |
| Bouton armé | Première activation du chemin assistif |
| Indice d'activation en deux temps | Ce que la personne doit faire ensuite |
| Annulation en mode tap | La fenêtre d'annulation du tap simple |
| Luminosité nocturne | Le contrôle de l'article 4 |
| Sortie du mode chevet | Existe déjà, à relire dans le nouveau contexte |

**Contrainte d'écriture, non négociable.** Ces chaînes sont dites au moment du geste, c'est-à-
dire au seul moment où la personne agit. ADR-003 s'applique intégralement : elles ne disent
**jamais** rien de l'état de la connaissance du modèle. Jour 1 et jour 30 restent
indiscernables pendant le guidage.

Rappel de la règle de Camille, qui a déjà attrapé des fautes : l'honnêteté porte sur l'état
de la connaissance, jamais sur la compensation. Aucune de ces chaînes ne dit que l'app a
prévu large, ni qu'elle préfère être prudente : cette famille de formulations fait fuiter R4
par le sens même sans lâcher un chiffre.

**Tests.** `tests/copy.test.mjs` couvre déjà R1, R4, R5 et le tiret cadratin sur toute chaîne
ajoutée. Un test supplémentaire : l'état armé produit bien une annonce `aria-live`, et cette
annonce vient de `copy.js`.

---

## 7. Article 6 · La recette sur appareil réel

**C'est le vrai livrable de J4.** Les cinq articles précédents sont ce qu'on peut préparer
avant ; celui-ci est ce qu'on ne peut pas simuler.

Trois recettes, dans cet ordre, parce que chacune peut invalider la précédente.

### 6.1 VoiceOver, iPhone réel

Une session complète du matin, écran verrouillé au doigt, VoiceOver actif du début à la fin.
Bloquants : atteindre le bouton de confirmation, l'armer, le valider, obtenir exactement une
avance d'étape. Puis ouvrir le tiroir, sauter une étape, revenir. Puis « Je pars ».

Ce chemin est resté impossible pendant toute la v2 (B3) et n'a jamais été validé par un
humain depuis le correctif.

### 6.2 Une nuit branchée réelle

Le mode chevet armé le soir, le téléphone branché, une vraie nuit. Bloquants : l'aube
logicielle démarre à l'heure, le son monte sur 90 secondes sans jamais escalader, « Pas
encore » re-propose en silence après 5 minutes, la sortie du chevet à 3 h du matin
n'éblouit pas, et l'app est toujours vivante au matin.

Le mode chevet n'a **jamais** été validé sur une nuit complète. C'est la fonctionnalité la
plus exposée du produit (Wake Lock toute la nuit, contexte audio suspendu, gel d'onglet) et
la moins vérifiée.

### 6.3 La mesure de performance (ADR-005)

Temps avant premier rendu sur un iPhone 12 ou équivalent, app installée sur l'écran d'accueil,
depuis le cache du service worker, en Low Power Mode. Cible : **sous une seconde.**

ADR-005 dit ce que personne ne doit oublier : les deux budgets en octets sont des proxys, et
**tant que cette mesure n'a pas été faite, personne ne sait si l'app tient sa cible de
performance.** Le résultat révise ADR-005 avec un vrai chiffre.

### 6.4 Ce qui est vérifié en même temps, sans coût supplémentaire

- Onglet réseau : aucune requête tierce, aucune requête de données personnelles.
- Le bug de la douche, l'appui interrompu, l'absence de compte à rebours (recette §19).
- Dynamic Type à 310 %, écrans live et feuille compris.

---

## 8. Ce que J4 retire (DEC-12)

Le réglage de taille de texte dans l'app, remplacé par le réglage système que la personne a
déjà fait une fois pour tout son téléphone. C'est la meilleure sorte de suppression : elle
retire une décision **et** rend le résultat meilleur pour ceux qui en ont le plus besoin.

---

## 9. Critère de sortie de J4

> La recette de la spec v2 §19 passe **en entier, sur appareil réel**, VoiceOver compris et
> nuit branchée comprise, et le temps de premier rendu est mesuré et écrit.

Ce critère ne se déclare pas, il se constate, et il se constate sur un téléphone. Aucune
partie ne peut être remplacée par un test automatique : c'est précisément pour ça qu'elle
est restée jusqu'ici.

**Si une recette échoue, le jalon n'est pas atteint.** Elle produit alors un défaut nommé,
avec son test quand c'est possible, et le jalon se rouvre. C'est la règle appliquée depuis
J0 et il n'y a aucune raison de la relâcher sur le dernier.

---

## 10. Ce qui n'est pas dans J4, et qui reste ouvert

Ces points sont réels, chiffrés, et volontairement hors périmètre. Ils sont écrits ici pour
que personne n'ait à les redécouvrir.

**L'article 4 de S4 : segmentation et mémoire.** La segmentation par `r.day === ctx.day ||
r.type === ctx.type` ne segmente rien du tout sur les jours ouvrés, puisque `type` y est
constant. Le OU est trop permissif. S4 lie ce chantier à celui du stockage (allonger la
mémoire fait grossir la clé `localStorage`), et le stockage n'est pas dans ce cycle.

**Le parcours sans destination coûte 1,7 minute par matin.** Sans destination nommée, le
trajet n'est jamais mesuré : l'app reste ignorante à vie sur ce terme et le paie en marge,
tous les matins (`S4-statut.md`). C'est le parcours par défaut, puisque rien n'oblige à
nommer un lieu. Le remède n'est pas un écran de plus (la vision l'interdit), c'est une
question de conception dans l'Aperçu, et elle demande de la recherche utilisateur avant du
code. Chantier de Léa, cycle suivant.

**Le protocole de validation de S3 §6 n'a pas démarré.** Six à huit testeurs, quatorze jours,
exports à J1, J3, J7 et J14. C'est le seul moyen de savoir si la seconde moitié du critère de
sortie de J2 est vraie chez de vraies personnes : *au septième matin, son heure de lever a
bougé sans qu'il ait eu à régler quoi que ce soit.* Le simulateur le montre ; un simulateur
ne montre jamais qu'une personne l'a vécu ainsi.

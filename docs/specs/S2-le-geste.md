# S2 · Le geste de confirmation

**Jalons** : minimum vital en J0 (B2, B3), forme définitive en J4
**Propriétaire** : Iris Tanaka · **Tests** : Milo Vasseur · **Chaînes** : Camille Ndiaye

Le geste de confirmation est le seul mécanisme par lequel l'app avance. C'est donc le seul
endroit où R2 se gagne ou se perd, et c'est aujourd'hui le composant le plus défaillant du
produit : simultanément trop laxiste et trop strict.

---

## 1. Le diagnostic, en une phrase

`holdButton` (`js/ui.js:125-176`) laisse **le clavier confirmer instantanément** (B2, R2 et
R3 violées) et **empêche VoiceOver de confirmer du tout** (B3, R2 inatteignable). Le même
composant, les mêmes quarante lignes.

Cause commune : le composant modélise la confirmation comme *un maintien de pointeur*, et
traite tout le reste par des rustines. Or une technologie d'assistance n'émet pas de
pression, elle émet **des activations atomiques**. Il n'y a pas de maintien à intercepter.

C'est aussi pourquoi DEC-08 requalifie le « tap simple » : ce n'est pas une réponse
d'accessibilité, c'est une option de motricité, et le mot posé sur cette case a fait croire
pendant toute une v2 que le sujet était traité.

---

## 2. Ce que R2 exige réellement

R2 dit : *ne jamais présumer qu'une étape est finie ; l'étape courante ne change que sur
confirmation explicite.* Le mot important est **explicite**, pas *tenue*. Le maintien de
600 ms est un **moyen** d'obtenir l'explicite au doigt, en évitant le faux tap. Ce n'est pas
la règle.

Reformulation opérationnelle, qui doit remonter dans `CLAUDE.md` §2 :

> Une confirmation est valide si elle est **intentionnelle et non ambiguë**. Chaque modalité
> d'entrée obtient cette garantie par le moyen qui lui convient. Aucune modalité n'en est
> dispensée, aucune ne peut être privée de chemin.

---

## 3. Les quatre chemins

Un composant, `confirmControl`, quatre chemins vers la même garantie.

| Chemin | Modalité | Garantie d'intention | Notes |
|---|---|---|---|
| **Maintien** | doigt, souris | 600 ms de pression continue | Comportement actuel, conservé tel quel |
| **Clavier** | Entrée, Espace | `keydown` arme, `keyup` valide, **`e.repeat` ignoré** | Corrige B2. Un maintien réel, pas une frappe |
| **Assistif** | VoiceOver, Switch Control | activation atomique + **confirmation en deux temps** | Corrige B3. Premier `click` arme et annonce, second `click` sous 8 s valide |
| **Tap** | réglage de motricité | tap unique + fenêtre d'annulation | Existant, requalifié par DEC-08 |

**Le chemin assistif en détail.** Le premier `click` ne fait pas avancer : il arme le bouton
et l'annonce via `aria-live`. Le second `click`, dans une fenêtre de 8 secondes, confirme.
Hors fenêtre, le bouton se désarme silencieusement. Deux `click` synthétiques rapprochés
donnent donc **exactement une** avance d'étape, jamais deux.

C'est l'équivalent fonctionnel du maintien : deux actes valent mieux qu'un pour établir
l'intention, exactement comme 600 ms valent mieux que 0.

**Détection.** Le chemin assistif ne se détecte pas, il se **déduit** : un `click` qui n'a
pas été précédé d'une paire `pointerdown` / `pointerup` de plus de 600 ms est une activation
atomique. Pas de reniflage de technologie d'assistance, pas de réglage à deviner.

---

## 4. Le retour de progression (DEC-07)

Le remplissage est aujourd'hui en `aria-hidden` (`js/ui.js:135`) et il n'existe **aucun
retour non visuel**. Quelqu'un a traité une barre qui se remplit comme un compte à rebours.

DEC-07 tranche : *le retour de progression d'un geste en cours, visuel, haptique ou sonore,
est hors périmètre de R1.* R1 parle du temps qui reste avant le départ ; la progression d'un
appui décrit ce que fait la main, ici, maintenant.

**Conséquences à livrer.** Un retour haptique de progression pendant le maintien. Une
annonce `aria-live` à l'armement et à la validation. Et la correction de
`css/components.css:2014-2018`, où `prefers-reduced-motion` écrase le remplissage à 150 ms
alors que le geste dure 600 ms : le mouvement est réduit, la durée du geste ne l'est pas.

---

## 5. Le live cesse de se reconstruire

**Prérequis à tout le reste**, signalé par Iris comme cause racine.

`liveTicker` (`js/ui.js:663`) appelle `renderLive` toutes les 5 secondes, qui appelle
`render`, qui fait `root.replaceChildren(node)` (`js/ui.js:100`). Le focus clavier est donc
perdu toutes les 5 secondes, et le curseur VoiceOver renvoyé en haut de page toutes les 5
secondes. Même B3 corrigé, atteindre le bouton resterait une course contre le ticker.

**Comportement attendu.** Le live met à jour les nœuds qui changent, il ne se reconstruit
pas. Le bouton de confirmation, en particulier, n'est **jamais** remplacé pendant une
session.

**Effet de bord bienvenu.** Cela règle aussi le défaut relevé par Camille : `pick('suggested')`
est retiré au sort à chaque rendu (`js/ui.js:888`) et le pool compte deux entrées, donc les
deux phrases alternent strictement toutes les 5 secondes sous les yeux de l'utilisateur. Le
message d'une étape est tiré une fois et ne change plus.

---

## 6. Le mode chevet devient actionnable

`renderNight` (`js/ui.js:1693`) et `renderWakeProposal` (`js/ui.js:1743`) posent leurs
gestionnaires sur le `<main>`. Pas un `<button>`, pas de `role`, pas de `tabindex`, pas de
nom accessible.

**À livrer.** Un élément actionnable, focusable et nommé pour : régler la luminosité, quitter
le mode chevet, et confirmer le réveil. Ce dernier est le plus grave : une personne aveugle
peut armer le chevet le soir et ne peut pas l'éteindre le matin.

**Contrainte.** Tout élément ajouté hérite de la scène Nuit : aucun contraste qui éblouisse,
aucune animation qui réveille. L'ergonomie nocturne prime sur la convention visuelle.

---

## 7. Chaînes demandées à Camille

Sept à neuf chaînes, toutes prononcées, toutes dans `copy.js` sans exception : appui relâché,
bouton armé, indice d'activation en deux temps, annulation en mode tap, libellé de la
luminosité nocturne, sortie du mode chevet.

Contrainte d'écriture : ces chaînes sont dites au moment du geste. Elles ne disent donc
jamais rien de l'état de la connaissance du modèle (ADR-003).

---

## 8. Tests bloquants

- Espace maintenu n'avance que d'une étape.
- Une rafale de `keydown` avec `repeat: true` n'avance rien au-delà de la première.
- Un `click` synthétique isolé n'avance rien.
- Deux `click` synthétiques en moins de 8 s avancent d'exactement une étape.
- Après tout scénario clavier ou assistif, aucune valeur `v = 1` parasite dans `step.real`.
- Aucun `prompt(` ni `confirm(` dans `js/`.
- Le bouton de confirmation n'est pas remplacé dans le DOM pendant une session de 60 s
  simulées.

**Recette manuelle.** VoiceOver sur iPhone réel, et une nuit branchée réelle. Non
automatisable, donc consigné.

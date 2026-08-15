# ADR-005 · Ce que le budget de performance mesure vraiment

**Statut** : acceptée · **Date** : J3 · **Décideur** : direction du projet
**Instruit par** : le blocage de J3 sur `tests/budget.test.mjs`

## Contexte

`CLAUDE.md` §3 fixe depuis l'origine : *JS total < 220 Ko non minifié*, à côté de la vraie
cible, *First Paint < 1 s sur iPhone 12*.

**Rien ne vérifiait ce budget.** Il a dérivé en silence pendant deux ans de développement,
puis a été dépassé pendant J2 sans que quoi que ce soit ne le signale. `tests/budget.test.mjs`,
ajouté en J2, l'a rendu mécanique, et J3 est venu buter dessus : 225 936 octets pour 225 280
autorisés, après retrait de tout le code mort identifiable et deux passes de resserrement des
commentaires.

Le blocage a forcé une question qui n'avait jamais été posée : **220 Ko de quoi, et pourquoi
220 ?** Le chiffre n'est instruit nulle part. C'est un proxy, choisi à l'intuition, pour une
cible qui, elle, est bonne : le temps avant le premier rendu.

Mesure du dépôt au moment de la décision :

| | octets |
|---|---|
| transféré (tous les `js/**/*.js`) | 225 936 |
| code hors commentaires | 173 524 (77 %) |
| commentaires | 52 412 (23 %) |

## Décision

**Le budget unique en octets transférés est remplacé par deux budgets, parce qu'il y a deux
coûts distincts et qu'un seul chiffre les confondait.**

| Budget | Valeur | Ce qu'il gouverne |
|---|---|---|
| **Poids transféré** | **260 Ko** | Le remplissage du cache, payé une seule fois, à la première visite. Le service worker sert tout depuis le cache ensuite. |
| **Code hors commentaires** | **185 Ko** | Le coût d'analyse, payé à CHAQUE démarrage à froid. C'est celui qui touche réellement le premier rendu. |

Le second est le budget contraignant. Il laisse aujourd'hui 11,5 Ko de marge, contre 656
octets de dépassement sur l'ancien.

Les deux sont vérifiés par `tests/budget.test.mjs`, bloquants en intégration continue.

## Justification

**1. Les commentaires ne sont pas du coût de démarrage.** Un analyseur JavaScript les saute ;
ils comptent dans le transfert, pas dans l'exécution. Ce dépôt en contient 23 %, et ce n'est
pas de la graisse : c'est la propriété qui a permis de le reprendre après abandon. Un budget
qui taxe l'explication au même tarif que le code pousse à supprimer la première, ce qui est
exactement le mauvais arbitrage pour un projet dont le risque numéro un est d'être repris par
quelqu'un d'autre dans six mois.

**2. Le transfert est payé une fois.** Le produit est une web app installée sur l'écran
d'accueil, avec un service worker qui met tout en cache (contrainte d'architecture, `CLAUDE.md`
§3). Le poids transféré est donc un coût d'installation, pas un coût quotidien. Il mérite un
plafond, pas le plafond le plus serré.

**3. On ne relève pas le plafond pour se donner de l'air, on le relève pour arrêter de mesurer
la mauvaise chose.** Le budget serré reste : 185 Ko de code, contre 173,5 aujourd'hui. J4 et
la suite devront toujours retirer avant d'ajouter. Ce qui change, c'est que retirer un
commentaire ne comptera plus comme un progrès.

## Ce qu'on abandonne en prenant cette décision

**La simplicité d'un chiffre unique.** Deux budgets, c'est deux façons de se tromper, et le
risque réel est qu'on ne regarde plus que le plus lâche des deux. Le test affiche les deux à
chaque exécution pour que ça ne se produise pas.

**Et surtout : on n'a toujours pas mesuré le premier rendu.** Cette ADR remplace un proxy par
un meilleur proxy, elle ne le remplace pas par la vraie cible. Mesurer *First Paint < 1 s sur
iPhone 12* demande un iPhone 12, et ADR-001 interdit un navigateur headless en intégration
continue. Le chiffre reste donc à vérifier à la main, sur appareil réel, dans la recette de
J4 (spec v2 §19), au même titre que VoiceOver et la nuit branchée. **Tant que cette recette
n'a pas été exécutée, personne ne sait si l'app tient sa cible de performance.** Le budget en
octets est ce qu'on a en attendant, et il ne doit pas faire croire qu'on sait.

## Conséquences

- `CLAUDE.md` §3 est mis à jour : c'est une décision d'architecture verrouillée qui change,
  la seule de ce cycle.
- `tests/budget.test.mjs` vérifie les deux budgets et affiche les deux marges.
- La recette d'appareil réel de J4 doit inclure une mesure de temps de premier rendu, et
  cette ADR est révisée à ce moment-là avec un vrai chiffre.

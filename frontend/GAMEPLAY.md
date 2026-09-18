# Gameplay — arcadepipe

Liste de ce qui est implémenté dans le jeu, système par système, écrite pour être comprise sans avoir travaillé sur ce projet. Deux objectifs :

1. Garder une trace de ce qui a été construit — la "todo list" de départ, cochée au fil du développement plutôt que jetée une fois faite.
2. Servir de checklist de référence pour démarrer un nouveau petit jeu d'arcade en JavaScript/Canvas : copie cette liste, décoche tout, coche au fur et à mesure.

Détail technique (stack, déploiement, sécurité) : voir le [README à la racine](../README.md). Ce fichier-ci ne couvre que le *gameplay* et l'aspect visuel.

## Charte graphique

Comment les couleurs et les formes sont décidées et générées.

- [x] **Aucun fichier image.** Chaque vaisseau/ennemi est une petite grille de texte où chaque lettre représente une couleur (par exemple `a` = une teinte de bleu, `.` = transparent). Le code convertit cette grille en image une seule fois au démarrage, puis réutilise cette image toute la partie — voir `js/assets.js`.
- [x] **Une seule liste de couleurs pour tout le jeu** (`PALETTE` dans `js/config.js`), plutôt que chaque écran/élément qui choisit sa couleur indépendamment. Ça évite qu'une même teinte soit réutilisée par erreur pour deux choses différentes à l'écran.
- [x] **Chaque couleur est vérifiée contre les autres avant d'être ajoutée**, pour qu'aucune ne se confonde avec une autre à l'œil.
- [x] **Code couleur par rôle, pas par esthétique seule** : le vaisseau du joueur et ses tirs ont leur propre famille de couleurs (cyan/jaune), chaque bonus a sa propre couleur distincte (avec sa légende dans l'écran Aide — icône + couleur réelles, pas juste du texte).
- [x] **Chaque type d'ennemi a sa propre couleur reconnaissable**, et l'or/jaune reste exclusif au boss — aucun autre ennemi ne s'en approche, pour ne jamais laisser croire qu'un ennemi normal "vaut" le boss. Un ennemi "moyen" réutilise la même silhouette que le "facile" avec juste une palette de couleurs différente plutôt qu'un nouveau sprite à dessiner. Techniquement, ce n'est donc pas une teinte par "type" au sens strict, mais par silhouette + palette. Les quatre types (hors boss, qui a sa propre section) ont aussi leur légende dans l'écran Aide — sprite réel + description courte de leur pattern (tire ou non, poursuit ou non).
- [x] **La couleur d'un tir suit son comportement, pas sa provenance** : tous les ennemis "normaux" (y compris la variante qui tire) partagent la même couleur de tir, puisque leurs tirs se dodgent tous de la même façon — distinguer leur couleur n'aidait pas le joueur, ça ajoutait juste du bruit visuel. À l'inverse, le boss a deux couleurs de tir bien différentes selon le *style* du pattern (visé/direct vs circulaire), parce que ces deux styles s'esquivent différemment (un vecteur à éviter vs un mur à traverser par les trous) — c'est ça que la couleur doit signaler en priorité, pas "qui a tiré".
- [x] **Les points faibles du boss changent de couleur selon les dégâts encaissés** (jaune → orange → rouge avant destruction) — la couleur porte une information de jeu réelle, ce n'est pas juste décoratif.
- [x] **Le décor (étoiles, planètes, arrière-plan du boss) est systématiquement désaturé** (couleurs ternes/grisées) plutôt que de lui réserver une teinte précise — puisque toutes les couleurs de gameplay de ce jeu sont pleinement saturées, un décor terne reste reconnaissable comme "arrière-plan" quelle que soit la teinte qu'il tire au hasard, sans jamais risquer d'entrer en collision avec une couleur de gameplay existante ou future. Règle plus robuste qu'une simple liste de teintes "interdites" à mettre à jour à chaque nouvel ajout.
- [x] **Les particules (explosions, étincelles) sont désaturées à la volée** au moment où elles naissent, en gardant la couleur du type d'ennemi détruit mais en la rendant plus terne — même règle que le décor ci-dessus, appliquée cette fois pour qu'un gros nuage de débris colorés ne rivalise jamais avec la lisibilité des tirs ennemis à esquiver (qui restent, eux, pleinement saturés). Un seul point du code applique cette règle (la fonction qui fait naître une particule), donc rien à retoucher ailleurs si une nouvelle couleur d'explosion est ajoutée un jour.
- [x] **Les formes ont un sens directionnel** : le vaisseau du joueur pointe vers la droite (le sens de son tir), le vaisseau du boss est en forme de coin (large à l'arrière, effilé à l'avant face au joueur) pour évoquer un vaisseau de guerre massif sans copier une œuvre existante.
- [x] **La forme des tirs suit leur comportement** : les tirs du joueur (toujours horizontaux) sont dessinés comme un petit trait fixe ; les tirs ennemis (qui partent dans toutes les directions) sont dessinés comme un trait qui s'oriente selon sa trajectoire ; les petits projectiles multiples (bonus fusil à pompe) sont de simples points, plus simples visuellement quand il y en a beaucoup à l'écran en même temps.
- [x] **Une lueur ("glow") autour des éléments importants**, obtenue en redessinant la même image en transparence légèrement agrandie en dessous — un effet visuel simple à calculer, sans vrai flou coûteux.
- [x] **Légère variation aléatoire sur les éléments répétés** (teinte, taille) pour qu'un combat de boss ou qu'une planète en arrière-plan n'ait jamais l'air exactement identique d'une fois à l'autre, sans avoir à dessiner plusieurs versions à la main.

## Boucle de jeu & rendu

- [x] Le jeu se met à jour et se redessine à chaque image (60 fois par seconde en théorie), avec une protection qui évite les gros sauts si l'onglet du navigateur était en arrière-plan.
- [x] Résolution interne du jeu volontairement petite et fixe, agrandie ensuite à la taille de l'écran sans flou (look "pixel art" net, pas granuleux).
- [x] Le jeu est organisé en "écrans" clairement séparés (menu, en partie, pause, game over...) — le code sait toujours dans quel écran il se trouve et n'affiche/n'écoute que ce qui est pertinent pour cet écran. Chaque écran vit dans son propre fichier sous `js/states/`, `js/game.js` ne fait que relier (détail technique et diagramme : voir *Architecture* dans [`README.md`](README.md)).

## Vaisseau joueur & contrôles

- [x] Le vaisseau suit la souris ou le doigt progressivement (pas de téléportation instantanée), pour un mouvement fluide même si la souris bouge très vite.
- [x] Au tactile, la position visée est légèrement décalée vers l'avant du vaisseau pour que le doigt ne cache pas la zone où arrivent les tirs ennemis.
- [x] Tir en maintenant le clic/le doigt appuyé, avec une option "tir automatique" pour qui préfère ne pas avoir à maintenir — ce choix est mémorisé d'une visite à l'autre.
- [x] Courte invulnérabilité (avec clignotement du vaisseau) juste après avoir été touché, pour ne pas perdre plusieurs vies d'un coup sur des tirs groupés.
- [x] Nombre de vies limité ; la partie se termine à la dernière vie perdue.

## Armes & bonus

- [x] Tir de base par défaut.
- [x] Les bonus ramassés ont une durée limitée, et un seul est actif à la fois (en ramasser un nouveau remplace l'ancien plutôt que de les cumuler) — plus simple à suivre pour le joueur, et plus simple à équilibrer.
- [x] Le décompte d'un bonus actif se met en pause pendant la transition animée entre deux vagues (on ne peut de toute façon pas tirer pendant ce court passage) — la durée du bonus n'est jamais grignotée par un temps mort.
- [x] Plusieurs armes bonus avec un vrai compromis, pas juste "plus fort que le tir normal" : une qui frappe plus fort mais tire plus lentement, une qui tire très vite mais fait moins de dégâts par tir, et un fusil à pompe qui tire plusieurs projectiles en éventail dont la puissance diminue avec la distance parcourue (fort à bout portant, faible loin).
- [x] Un bouclier qui absorbe un nombre fixe de coups (pas une durée limitée) et qui peut être actif en même temps qu'une arme bonus, puisque ce sont deux systèmes indépendants.
- [x] **Frôler** un tir ennemi OU le corps d'un ennemi (passer tout près sans le toucher) rapporte des points, proportionnellement à la taille de la chaîne de frôlements enchaînés sans coupure — récompense l'esquive serrée plutôt que large, sans rien retirer au joueur qui préfère esquiver large. Le corps grazé a son propre délai avant de pouvoir regrazer (contrairement à un tir, qui ne graze qu'une fois). Le boss fait exception : seuls ses tirs grazent, jamais sa coque (bien trop proche en permanence pendant le combat pour que ça reste un défi). Suspendu pendant l'invulnérabilité qui suit un coup, la transition entre deux vagues et le ralenti de mort (sinon trivial à faire grimper sans risque).
- [x] Le frôlement charge une jauge **NOVA** (une charge de base, deux à partir du 2e combat de boss), affichée en haut à gauche sous forme "NOVA x/max" (ex. "NOVA 1/2") + une fine barre de progression vers la prochaine charge — le max lui-même affiché en toutes lettres, pas juste le nombre de charges dispo, pour que le joueur sache d'emblée jusqu'où il peut monter. Jaune pâle à 0 charge, jaune vif (avec lueur) dès qu'au moins une est prête. Une fois pleine, un effet instantané qui détruit tous les ennemis normaux à l'écran (jamais le boss) se déclenche à la demande — touche dédiée au clavier, bouton tactile visible seulement quand une charge est disponible (pas de bouton mort en permanence). Vide au début d'une partie : la première charge doit être gagnée, pas offerte. Fonctionnement expliqué en détail dans l'écran Aide (comment la charger, ce qu'elle fait, jusqu'à combien de charges).
- [x] Les projectiles sont gérés par un stock d'objets réutilisables créé une fois au démarrage plutôt que créés/détruits en continu — un détail de performance qui évite les ralentissements quand l'écran est plein de tirs.

## Ennemis

- [x] Plusieurs types d'ennemis avec des statistiques différentes (résistance, vitesse, valeur en points, capacité à tirer ou non).
- [x] Un type d'ennemi plus rare et plus résistant, qui devient de plus en plus fréquent à mesure que la partie avance.
- [x] À partir d'un certain stade de la partie, une partie des ennemis "normaux" se met aussi à tirer (avant ce stade, seul le type rare tirait) — cette variante encaisse aussi un coup de plus que le normal, pour justifier qu'elle tire, sans être aussi résistante que le type rare. Pas d'indicateur de PV au-dessus du sprite (pastilles retirées, jugées superflues en plein jeu) : les PV de chaque type sont listés dans l'écran Aide à la place (voir Interface & menus), plus lisible qu'un indicateur minuscule à surveiller pendant l'action. Retour visuel diégétique à la place : dès qu'il a encaissé un coup, le sprite passe à une variante aux couleurs ternies (même silhouette, palette désaturée) — se voit encaisser des dégâts sans jauge de PV à l'écran.
- [x] Un type d'ennemi qui ne tire jamais mais fonce directement sur le joueur (poursuite avec vitesse de rotation plafonnée — insistant mais esquivable en bougeant), plutôt distinctif visuellement (couleur/silhouette/orientation selon sa trajectoire réelle) pour bien signaler que c'est une menace différente des autres. Plafonné en nombre simultané à l'écran — plusieurs à la fois dans une vague déjà chargée devenait vraiment dur à esquiver, vu que c'est le seul type qui poursuit activement plutôt que suivre une trajectoire fixe.
- [x] Les ennemis n'apparaissent que dans une zone définie de l'écran (pas n'importe où), ce qui garde l'écran lisible même sur un petit écran de téléphone — une fois apparus, ils peuvent ensuite se déplacer librement, sauf pour le tir : un gunner/élite qui a dérivé dans le tiers gauche de l'écran arrête de tirer (reprend s'il revient à droite), pour que le joueur reste concentré sur les 2/3 droits sans surveiller son dos.
- [x] Même système de stock d'objets réutilisables que pour les projectiles.

## Boss

- [x] Le combat de boss se joue sur plusieurs "points faibles" à détruire un par un (pas une simple jauge à vider) — une barre de vie globale (rouge, distincte du jaune/or de sa coque) reste affichée en plus, pleine largeur et fixe tout en bas de l'écran (convention classique de combat de boss), pour suivre la progression globale du regard sans avoir à la chercher près du boss.
- [x] Les tirs du boss deviennent plus nombreux et plus rapides à mesure que ses points faibles sont détruits — le combat monte en intensité progressivement.
- [x] Le tout premier combat de boss rencontré est volontairement plus facile (moins de vie, tirs plus lents) que les suivants, le temps que le joueur en comprenne le fonctionnement.
- [x] Vaincre un boss donne une vie supplémentaire et un gros bonus de score.
- [x] Chaque combat de boss a une légère variation visuelle (teinte, taille) générée aléatoirement, sans qu'il faille dessiner plusieurs versions du sprite à la main.

## Vagues & difficulté

- [x] Le nombre d'ennemis à tuer pour terminer une vague augmente à chaque vague.
- [x] Les ennemis apparaissent de plus en plus vite au fil des vagues (avec un plancher, pour que ça reste jouable).
- [x] Les tirs ennemis deviennent progressivement plus rapides (avec un plafond, pour qu'ils restent esquivables même en fin de partie).
- [x] Un combat de boss revient à intervalle régulier (une vague sur un certain nombre).
- [x] Transition animée entre deux vagues (effet de "saut" visuel) plutôt qu'un changement brutal.
- [x] Bonus de score si une vague entière se termine sans avoir perdu de vie.
- [x] **Niveau bonus** offert tous les N vagues (avant chaque multiple, ex. vague 10, 20, 30) si le score atteint un seuil qui grimpe à chaque cycle (le premier reste volontairement facile à atteindre, une "vitrine" plutôt qu'un défi réservé aux runs déjà excellentes) : traverser une série d'anneaux (vaisseau piloté normalement, x verrouillé) plutôt que combattre, aucune vie ne peut être perdue. Récompense proportionnelle au nombre d'anneaux réussis, jamais tout-ou-rien — remplit la jauge NOVA. Entrée en douceur (même glissée que le tout début d'une partie) accompagnée d'un court message expliquant pourquoi ce niveau apparaît et quoi faire, avant le premier anneau. Étoiles lointaines qui scintillent en arrière-plan, propres à ce niveau (distinctes du champ d'étoiles qui défile normalement) — renforce l'impression de profondeur pendant la traversée des anneaux.

## Effets ("game feel" — ce qui rend les impacts satisfaisants)

- [x] Petites particules (étincelles, débris) à chaque explosion/impact, gérées par le même système de stock réutilisable.
- [x] Tremblement léger de l'écran, dont l'intensité dépend de la gravité de l'événement (pas systématique à chaque tir, sinon l'écran tremblerait en permanence).
- [x] Bref ralenti du jeu (quelques centièmes de seconde) sur les coups marquants, pour appuyer l'impact sans vraiment mettre en pause.
- [x] Ralenti plus long et plus prononcé au moment de la mort du joueur, avant l'écran de fin de partie.
- [x] Flash blanc bref à l'écran sur les moments forts (victoire de boss, etc.).
- [x] Vibration du téléphone sur les impacts (sur les appareils qui le supportent — ignoré silencieusement sinon).
- [x] Le tremblement d'écran est désactivé si le système d'exploitation du joueur indique une préférence pour moins de mouvement à l'écran (réglage d'accessibilité standard des navigateurs).

## Décor

- [x] Fond étoilé sur plusieurs couches qui défilent à des vitesses différentes (effet de profondeur) — le même fond anime tous les écrans-menus (titre, aide, classement, crédits, saisie du pseudo), pas seulement l'écran titre.
- [x] Éléments de décor occasionnels et discrets (planètes, galaxies, trous noirs lointains — silhouette générée au canvas : vide sombre + anneau lumineux, pas d'image) qui apparaissent de temps en temps sans jamais gêner la lisibilité. Jamais de trou noir sur l'écran titre spécifiquement (silhouette la plus chargée visuellement des trois, jugée trop présente derrière le texte du menu) — remplacé par quelques étoiles discrètes qui scintillent, même principe que le niveau bonus (voir Vagues & difficulté).
- [x] Décor spécifique qui apparaît pendant les combats de boss et disparaît proprement (avec une petite animation) une fois le boss vaincu.

## Audio

- [x] Tous les bruitages (tirs, explosions, etc.) sont générés directement par du code audio, sans aucun fichier son à charger.
- [x] La musique, elle, est une vraie playlist de morceaux (fichiers de musique "tracker"), jouée dans un ordre aléatoire qui évite de rejouer deux fois de suite le même morceau.
- [x] Musique et bruitages partagent le même circuit audio interne plutôt que d'en avoir chacun un séparé (nécessaire pour que le son fonctionne correctement sur certains navigateurs mobiles).
- [x] Réglages de volume séparés pour la musique et les bruitages, plus une coupure du son complète — tout est mémorisé d'une visite à l'autre.
- [x] Changement de musique en fondu (le son baisse puis remonte) plutôt qu'une coupure nette, pour éviter un clic audible désagréable.
- [x] L'intensité d'un bruitage suit celle de son effet visuel — le NOVA (écran qui tremble fort, tout l'écran nettoyé d'un coup) a son propre son "large" (bruit filtré + sub grave), pas le même son qu'une explosion d'ennemi normal, sinon l'impact paraît muet malgré l'écran qui vibre.
- [x] Un easter egg (aucun effet de jeu) caché derrière une séquence de touches connue des joueurs de jeux vidéo — jamais indiqué en jeu, à découvrir. Jingle audio accompagné d'un petit tilt du canvas, synchronisés.
- [x] Le contexte audio est explicitement repris quand l'onglet redevient visible, et vérifié en continu (pas seulement au premier geste) — certains navigateurs le suspendent d'eux-mêmes après un moment sans jamais le reprendre, y compris parfois onglet actif, ce qui coupait la musique en permanence.
- [x] Le chargement d'une piste vérifie le code de statut de la réponse réseau avant de la traiter comme valide (`fetch()` ne rejette jamais sur une erreur HTTP à lui seul) ; en cas d'échec, une nouvelle tentative différée et plafonnée — jamais immédiate, pour ne pas aggraver une limite de requêtes temporaire (voir *Retour d'expérience*, troisième round, plus bas).

## Interface & menus

- [x] Tous les écrans nécessaires : titre, pause, confirmation avant de quitter une partie, aide, crédits, fin de partie, saisie du pseudo, classement.
- [x] Navigation possible au clavier (flèches + Entrée) et à la souris, avec un petit son quand la sélection change.
- [x] L'écran d'aide s'affiche automatiquement lors de la toute première partie jouée, puis reste accessible à la demande ensuite via un bouton. Réparti sur 4 pages (bouton précédent/suivant + indicateur "1/4"), chacune en une seule colonne centrée (texte plus grand, plus lisible qu'un découpage en deux colonnes) : contrôles/NOVA, boss/musique, légende bonus, légende ennemis.
- [x] La saisie du pseudo de fin de partie fonctionne même sur les téléphones où le clavier virtuel ne s'ouvre pas automatiquement (bouton de validation tactile en secours).
- [x] Légende visuelle des bonus et des ennemis (hors boss) dans l'écran Aide, côte à côte — icône/sprite réel + couleur réelle plutôt qu'une liste de noms, et pour les ennemis leurs points de vie et une courte description de leur comportement (tire ou non, poursuit ou non). Le joueur associe l'apparence à l'effet/à la résistance sans avoir à tout vérifier en jeu. La position de la légende est calculée après le texte des sections au-dessus plutôt que fixée en dur, pour ne pas se faire déborder dessus si une section s'allonge un jour.
- [x] Réglage de la vitesse du jeu (x1/x1.5/x2, bouton "VITESSE DU JEU" dans le panneau en bas à gauche, préférence mémorisée) — accélère tout ce qui dépend du temps de façon uniforme (donc la difficulté relative ne change pas), sans jamais affecter la musique ni les bruitages (qui tournent sur leur propre horloge audio).
- [x] Panneau bas gauche organisé en items clairs plutôt qu'un groupe "options" fourre-tout : Musique, Bruitages, Vitesse du jeu, Tir automatique, Aide, puis le numéro de version — chacun sa propre ligne, dans l'ordre où un joueur les cherche.
- [x] Lien vers le code source (GitHub) dans les crédits.
- [x] Numéro de version affiché dans le jeu (détail plus bas).
- [x] **Partage de run en un clic** : juste après la fin d'une partie (game over/saisie du pseudo), un bouton génère une image carrée (score, vague atteinte, ennemis abattus, meilleure chaîne de frôlements, distance parcourue) dans le même style visuel que le jeu, plus un QR code pointant directement vers le jeu (noir sur blanc, contraste volontairement non stylisé pour rester scannable) — copiée dans le presse-papier quand le navigateur le permet, toujours aussi proposée en téléchargement (le support du presse-papier image varie trop d'un navigateur à l'autre pour s'y fier seul). Pas de lien raccourci/backend dédié : le QR code encode l'URL statique du jeu directement, généré 100% côté client.

## Classement (leaderboard)

- [x] Les scores sont envoyés à un vrai serveur et lus depuis ce serveur (pas seulement stockés sur l'appareil du joueur), donc partagés entre tous les joueurs.
- [x] Un compteur du nombre total de parties jouées, toutes personnes confondues.
- [x] Si le serveur est injoignable, l'écran de classement l'affiche proprement (liste vide) plutôt que de planter ou de bloquer le jeu.
- [x] Distance parcourue durant la run (années-lumière, accumulée proportionnellement au warp — voir `DISTANCE` dans `config.js`), affichée à l'écran de fin de partie et sur la carte de partage — **phase 1** faite. **Phase 2**, non faite : l'ajouter aussi au classement (demande un changement de schéma serveur, voir [ROADMAP.md](../ROADMAP.md)).

## Accessibilité & mobile

- [x] Respect du réglage système "réduire les animations" (coupe le tremblement d'écran).
- [x] Contrôle tactile pensé spécifiquement (pas juste traité comme un clic de souris) : décalage de visée, empêche le navigateur de scroller/zoomer pendant qu'on joue.
- [x] L'affichage s'adapte à la taille de l'écran/de la fenêtre en gardant les proportions du jeu.
- [x] Le jeu se met en pause automatiquement si on change d'application ou d'onglet en pleine partie (évite de perdre des vies pendant l'absence).

## Sauvegardé sur l'appareil du joueur

- [x] Préférences personnelles (volumes, coupure du son, dernière musique jouée, filtre visuel activé ou non, tir automatique, panneau replié, dernier pseudo utilisé) — si le stockage local est indisponible (navigation privée, par exemple), le jeu continue de fonctionner normalement, juste sans mémoriser ces préférences.

## Suivi de version

- [x] Numéro de version affiché dans le jeu (menu principal + crédits), qui augmente automatiquement à chaque mise à jour du code plutôt que d'être choisi à la main.
- [x] Journal des changements notables ([`CHANGELOG.md`](../CHANGELOG.md) à la racine du repo), une entrée par version qui le mérite — pas les simples ajustements numériques.

## Tests

- [x] Tests automatiques sur la logique du jeu qui ne dépend pas de l'affichage (calculs, règles), rapides à exécuter.
- [x] Tests automatiques qui pilotent un vrai navigateur pour vérifier les scénarios plus longs à atteindre normalement (obtenir un bonus, rencontrer un boss), en accélérant temporairement certains réglages le temps du test seulement.

## Retour d'expérience : un vrai bug rencontré

Un exemple concret de problème rencontré pendant le développement, pour illustrer une vraie démarche de résolution plutôt qu'une liste de fonctionnalités.

**Le symptôme.** La musique devait piocher une piste au hasard à chaque nouvelle partie, sans jamais rejouer deux fois de suite le même morceau. En pratique, c'était aléatoire au sens "parfois ça marche, parfois non" : de temps en temps, la même musique restait bloquée d'une partie à l'autre, sans erreur ni message nulle part.

**Première fausse piste.** Le tirage aléatoire lui-même semblait correct en le relisant (une boucle qui retire un nouvel index tant qu'il retombe sur celui déjà en cours). Le bug n'était donc pas dans "quelle piste choisir", mais ailleurs dans la chaîne.

**La vraie cause.** Deux bouts de code différents, déclenchés par le *même* geste du joueur (le tout premier clic sur "Jouer"), lançaient chacun leur propre chargement de musique en parallèle : l'un démarre l'audio en général (au tout premier clic/touche, obligatoire dans un navigateur), l'autre lance une piste aléatoire spécifiquement au début d'une partie. Chacun déclenche une requête réseau pour charger un fichier différent. Comme ce sont deux requêtes séparées, rien ne garantit laquelle répond en dernier — et c'est toujours la dernière réponse arrivée qui "gagne" et devient la musique réellement jouée, peu importe laquelle des deux était censée être la bonne. Résultat : parfois la piste "par défaut" gagnait la course et écrasait le tirage aléatoire, silencieusement.

**La correction.** Un simple compteur ("jeton de version"), incrémenté à chaque nouvelle demande de chargement. Quand une réponse réseau arrive, le code vérifie que son jeton correspond toujours à la demande la plus récente avant de l'appliquer — sinon il l'ignore, en considérant qu'une demande plus récente l'a déjà remplacée.

**La leçon générale**, au-delà de ce bug précis : dès que deux opérations asynchrones (réseau, minuteur, animation...) peuvent être déclenchées par le même événement et modifient le même état, il faut un moyen de savoir laquelle est "la plus récente" avant d'appliquer son résultat — sinon c'est l'ordre d'arrivée, imprévisible, qui décide à la place du code plutôt que la logique voulue. Ce même correctif a d'ailleurs été réappliqué presque à l'identique ailleurs dans ce projet (l'écran de classement) dès qu'un cas similaire a été repéré, une fois le schéma reconnu.

### Deuxième round : le même symptôme, une toute autre cause

Un correctif qui semble complet peut ne l'être qu'à moitié — même symptôme signalé ("la musique finit par se taire"), cause totalement différente la deuxième fois.

**Le symptôme, à nouveau.** Après le correctif du jeton de version ci-dessus, le silence revenait quand même, mais seulement après une session de jeu assez longue (beaucoup de changements de piste). Le correctif précédent n'était donc pas faux, juste incomplet : il couvrait une cause, pas toutes.

**La vraie cause, cette fois.** La lecture des fichiers musicaux passe par une bibliothèque tierce (lecteur de format tracker, exécutée dans un thread audio séparé) qui gère elle-même sa mémoire "à la main" (allocation/libération explicites, comme en C). À chaque changement de piste, le code de cette bibliothèque libérait deux mauvaises variables (jamais définies nulle part, donc rien à libérer en pratique) au lieu de celles réellement utilisées — et le fichier audio chargé en mémoire n'était, lui, jamais libéré du tout. Résultat : une petite fuite de mémoire à *chaque* changement de piste, invisible au début, jusqu'à épuiser l'espace disponible après assez de changements cumulés sur une session longue — à ce moment-là, le chargement d'une nouvelle piste échouait silencieusement, sans qu'aucun code du projet n'écoute cet échec pour réagir.

**La correction.** Libérer les bonnes variables (celles réellement allouées), libérer aussi le fichier chargé une fois qu'il n'est plus utile, et — en filet de sécurité — écouter l'événement d'échec de la bibliothèque pour passer à une autre piste plutôt que de rester silencieux indéfiniment si ça se reproduit un jour pour une autre raison.

**La leçon générale** : un bug corrigé une fois peut avoir plusieurs causes indépendantes derrière le même symptôme observable. "Le bug est reproduit, donc le correctif précédent était faux" est une conclusion trop rapide — vérifier d'abord si le correctif précédent couvrait vraiment *tous* les chemins qui mènent au même symptôme, pas juste celui identifié en premier.

### Troisième round : la preuve concrète, et un correctif qui a empiré les choses

Les deux rounds précédents reposaient sur des hypothèses raisonnées mais jamais confirmées par une vraie observation du problème en train de se produire. Le troisième round a été résolu seulement après avoir enfin obtenu une preuve concrète — un rappel que deviner, même intelligemment, reste deviner.

**Le symptôme, une troisième fois.** Toujours le même silence après un moment, malgré les deux correctifs précédents (jeton de version + fuite mémoire corrigée). Cette fois, la personne qui teste a eu le réflexe d'ouvrir l'onglet Réseau du navigateur au moment du problème, plutôt que de simplement re-signaler "ça recommence".

**La preuve.** Une rafale de requêtes vers les fichiers de musique, toutes rejetées avec un code **429 ("trop de requêtes")** — plusieurs par seconde, en boucle, ne s'arrêtant jamais. La vraie cause n'était donc ni le jeton de version ni la fuite mémoire (déjà corrigés) : une limite de requêtes quelque part devant le site se déclenchait, pour une raison propre à l'infrastructure de déploiement.

**Le vrai problème de code, découvert grâce à cette preuve.** `fetch()`, l'outil standard pour charger un fichier depuis le navigateur, ne considère **jamais** un code d'erreur HTTP (404, 429, 500...) comme un échec en soi — seule une vraie panne réseau (pas de connexion, requête annulée) compte comme un échec à ses yeux. Sans vérification explicite du code de statut, une réponse 429 était donc traitée comme "le fichier audio a bien été reçu", et ces quelques octets d'erreur (pas de la musique) étaient transmis tels quels au lecteur — qui plantait sur des données invalides. Pire : un correctif du round précédent relançait *automatiquement* une autre piste dès qu'un tel plantage survenait. Cette nouvelle tentative se heurtait aussitôt au même 429 (la limite de requêtes était toujours active), qui relançait une nouvelle tentative, qui... Un correctif pensé pour *éviter* un silence permanent avait, dans ce cas précis, créé une boucle de requêtes en rafale contre son propre serveur.

**La correction.** Vérifier explicitement le code de statut de la réponse avant de la traiter comme valide (un 429 devient alors un échec normal, plus une "réussite" trompeuse). Et surtout : remplacer la nouvelle tentative *immédiate* par une tentative *différée* (quelques secondes d'attente, en augmentant l'attente à chaque échec) et *plafonnée* (abandon après un petit nombre d'essais) — pour qu'une nouvelle tentative laisse le temps à une limite temporaire de se lever, au lieu de la maintenir active indéfiniment.

**La leçon générale**, deux cette fois. D'abord, un outil standard peut avoir un comportement contre-intuitif qui n'apparaît qu'à l'usage (`fetch()` qui ne rejette pas sur une erreur HTTP est un piège classique, documenté mais facile à oublier). Ensuite, et plus important : un correctif de "récupération automatique" doit toujours se demander "que se passe-t-il si l'échec se reproduit immédiatement après ma tentative de récupération ?" — sans cette question, une bonne intention (ne jamais rester silencieux) peut se retourner en attaque involontaire contre son propre serveur. Après trois rounds sur le même symptôme, la leçon la plus large reste la plus simple : face à un bug qui résiste à plusieurs correctifs raisonnés, obtenir une preuve concrète (ici, l'onglet Réseau du navigateur) vaut mieux qu'une quatrième hypothèse, aussi bien construite soit-elle.

### Quatrième round : le correctif précédent avait lui-même un angle mort

**Le symptôme, une quatrième fois.** Toujours signalé malgré les trois correctifs précédents (jeton de version, fuite mémoire, 429 + retry différé/plafonné) — cette fois sans preuve concrète disponible (pas de trace réseau au moment du signalement).

**La vraie cause.** Le compteur de tentatives ratées (`_loadRetries`, plafonné à 3 depuis le round précédent) n'était remis à zéro que dans `start()` et `next()` — pas dans `playRandom()`, appelée à **chaque nouvelle partie**. Conséquence : un unique accroc réseau isolé qui épuisait les 3 tentatives, une seule fois n'importe quand dans la session, laissait ce compteur bloqué au-dessus de 3 pour tout le reste de la session. Chaque partie suivante appelait bien `playRandom()`, mais au moindre nouvel échec — même isolé, même des heures plus tard — la condition `_loadRetries <= 3` était déjà fausse : plus aucune tentative différée ne se déclenchait, silence permanent à partir de ce point.

**La correction.** `playRandom()` remet maintenant `_loadRetries` à 0 avant de charger, exactement comme `start()`/`next()` le faisaient déjà.

**La leçon générale** : le round précédent avait correctement plafonné les tentatives pour éviter une rafale de requêtes, mais avait oublié de réinitialiser ce plafond à chaque nouveau point d'entrée logique (ici, une nouvelle partie) — un état partagé (`_loadRetries`) qui survit plus longtemps que prévu peut rendre un correctif efficace *une fois* mais silencieusement inopérant ensuite. Quand un compteur/verrou est remis à zéro à certains endroits, vérifier systématiquement s'il devrait l'être à TOUS les points d'entrée équivalents, pas seulement ceux où le bug initial a été observé.

### Cinquième round : le plafond lui-même était le problème, cette fois en cours de partie

**Le symptôme, une cinquième fois.** Signalé sous deux formulations qui semblaient différentes : "en fin de chanson, la suivante ne démarre pas" et "après un long moment sur l'écran pause, plus de musique du tout". Accompagné cette fois d'une capture d'écran de l'onglet Réseau montrant une rafale de 404 sur *tous* les fichiers `.xm` d'affilée.

**Fausse piste écartée.** Les fichiers musique étaient bien servis normalement au moment de l'investigation (200 OK) et bien présents/suivis dans le dépôt — la capture correspondait très probablement à une fenêtre de redéploiement du site (le fichier vérifié affichait un `Last-Modified` de quelques minutes avant le test), pas à un problème permanent côté serveur.

**La vraie cause.** Les deux formulations décrivaient en fait le même mécanisme. `playRandom()` (appelée aussi bien au début d'une partie qu'à **chaque fin de piste naturelle**, via `onEnded`) réinitialise bien `_loadRetries` avant de charger (round précédent) — mais si les 3 tentatives différées (2s/4s/6s, 12s au total) échouaient encore, `_loadCurrent()` abandonnait alors *définitivement*, sans aucun mécanisme pour réessayer plus tard. Aucun signal ne pouvait plus jamais relancer une tentative : `onEnded` ne se redéclenche que quand une piste *finit de jouer*, ce qui n'arrivera plus jamais puisque rien ne joue. Un accroc transitoire un peu plus long que 12 secondes (redéploiement du site, coupure réseau passagère) suffisait donc à couper la musique pour le reste de la partie, sans aucune récupération automatique une fois l'accroc terminé — qu'on soit en train de jouer ou immobile sur l'écran pause (la musique continue de tourner pendant la pause, donc une fin de piste peut très bien survenir pendant une pause prolongée).

**La correction.** Retrait du plafond sur le *nombre* de tentatives — seul le délai entre deux tentatives reste plafonné (10s maximum). Coût négligeable (une requête toutes les 10s dans le pire cas) contre un vrai gain : n'importe quelle panne transitoire, même plus longue que prévu, finit par se résorber toute seule.

**La leçon générale** : plafonner un compteur de tentatives protège contre une rafale de requêtes, mais plafonner le *nombre total* d'essais (plutôt que seulement le *délai* entre eux) transforme une panne transitoire en panne permanente dès qu'elle dure un peu plus longtemps que prévu. Les deux protections ne sont pas équivalentes — ici, plafonner le délai suffisait déjà à éviter la rafale du round 3 ; plafonner aussi le nombre d'essais était une protection en trop, qui a fini par causer son propre bug distinct.

**Effet de bord découvert au passage : une deuxième rafale, jamais corrigée.** En creusant ce round, un signalement de RAM qui grimpe fortement ("plusieurs Go"), décrit par le joueur comme concomitant avec le bug de son, a mené à un deuxième bug apparenté mais distinct : `onError` du lecteur (déclenché quand le buffer reçu n'est pas un fichier `.xm` valide, PAS une erreur réseau) relançait `playRandom()` **immédiatement, sans aucun délai** — exactement le défaut corrigé pour la branche réseau au round 3 (retry immédiat -> rafale), mais jamais appliqué à cette branche-ci puisqu'aucune preuve ne l'avait jusqu'ici désignée. Un fichier qui échoue systématiquement à se décoder pouvait donc déclencher une boucle fetch/décodage en rafale sans la moindre pause, consommant CPU/mémoire bien plus vite qu'un simple changement de piste en fin de chanson. Corrigé avec le même mécanisme de délai que `_loadCurrent`. Reste non confirmé si c'est bien la cause exacte de la RAM observée (pas de profil mémoire disponible au moment du correctif) — mais c'est la seule boucle sans délai trouvée dans toute la chaîne audio, et la coïncidence temporelle rapportée par le joueur pointait précisément vers "un problème de son qui s'aggrave avec le temps".

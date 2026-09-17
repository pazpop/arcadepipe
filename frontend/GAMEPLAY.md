# Gameplay — arcadepipe

Liste de ce qui est implémenté dans le jeu, système par système, écrite pour être comprise sans avoir travaillé sur ce projet. Deux objectifs :

1. Garder une trace de ce qui a été construit — la "todo list" de départ, cochée au fil du développement plutôt que jetée une fois faite.
2. Servir de checklist de référence pour démarrer un nouveau petit jeu d'arcade en JavaScript/Canvas : copie cette liste, décoche tout, coche au fur et à mesure.

Détail technique (stack, déploiement, sécurité) : voir le [README à la racine](../README.md). Ce fichier-ci ne couvre que le *gameplay* et l'aspect visuel.

## Charte graphique

Comment les couleurs et les formes sont décidées et générées.

- [x] **Aucun fichier image.** Chaque vaisseau/ennemi est une petite grille de texte où chaque lettre représente une couleur (par exemple `a` = une teinte de bleu, `.` = transparent). Le code convertit cette grille en image une seule fois au démarrage, puis réutilise cette image toute la partie — voir `js/assets.js`.
- [x] **Une seule liste de couleurs pour tout le jeu** (`PALETTE` dans `js/config.js`), plutôt que chaque écran/élément qui choisit sa couleur indépendamment. Ça évite qu'une même teinte soit réutilisée par erreur pour deux choses différentes à l'écran.
- [x] **Chaque couleur est vérifiée contre les autres avant d'être ajoutée**, pour qu'aucune ne se confonde avec une autre à l'œil. Exemple concret : la couleur des tirs d'un type d'ennemi particulier ("gunner") a été choisie bleu-indigo précisément parce que le orange envisagé au départ ressemblait trop à la couleur des tirs du joueur — ça aurait rendu difficile de distinguer "qui tire quoi" en plein combat.
- [x] **Code couleur par rôle, pas par esthétique seule** : le vaisseau du joueur et ses tirs ont leur propre famille de couleurs (cyan/jaune), chaque bonus a sa propre couleur distincte (avec sa légende dans l'écran Aide — icône + couleur réelles, pas juste du texte).
- [x] **Les ennemis suivent un code couleur par palier de menace, façon jeu de rôle** : vert = facile, jaune = moyen, violet = difficile, or = boss (du plus faible au plus fort). Un joueur peut donc évaluer le danger d'un coup d'œil, avant même de savoir ce que fait chaque type. Techniquement, ce n'est pas une teinte par "type" d'ennemi mais par silhouette + palette : un ennemi "moyen" réutilise la même forme que le "facile" avec juste une palette de couleurs différente (pas de nouveau sprite à dessiner).
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
- [x] Le jeu est organisé en "écrans" clairement séparés (menu, en partie, pause, game over...) — le code sait toujours dans quel écran il se trouve et n'affiche/n'écoute que ce qui est pertinent pour cet écran.

## Vaisseau joueur & contrôles

- [x] Le vaisseau suit la souris ou le doigt progressivement (pas de téléportation instantanée), pour un mouvement fluide même si la souris bouge très vite.
- [x] Au tactile, la position visée est légèrement décalée vers l'avant du vaisseau pour que le doigt ne cache pas la zone où arrivent les tirs ennemis.
- [x] Tir en maintenant le clic/le doigt appuyé, avec une option "tir automatique" pour qui préfère ne pas avoir à maintenir — ce choix est mémorisé d'une visite à l'autre.
- [x] Courte invulnérabilité (avec clignotement du vaisseau) juste après avoir été touché, pour ne pas perdre plusieurs vies d'un coup sur des tirs groupés.
- [x] Nombre de vies limité ; la partie se termine à la dernière vie perdue.

## Armes & bonus

- [x] Tir de base par défaut.
- [x] Les bonus ramassés ont une durée limitée, et un seul est actif à la fois (en ramasser un nouveau remplace l'ancien plutôt que de les cumuler) — plus simple à suivre pour le joueur, et plus simple à équilibrer.
- [x] Plusieurs armes bonus avec un vrai compromis, pas juste "plus fort que le tir normal" : une qui frappe plus fort mais tire plus lentement, une qui tire très vite mais fait moins de dégâts par tir, et un fusil à pompe qui tire plusieurs projectiles en éventail dont la puissance diminue avec la distance parcourue (fort à bout portant, faible loin).
- [x] Un bouclier qui absorbe un nombre fixe de coups (pas une durée limitée) et qui peut être actif en même temps qu'une arme bonus, puisque ce sont deux systèmes indépendants.
- [x] Un bonus à effet instantané qui détruit tous les ennemis normaux à l'écran (le boss n'est jamais concerné) — volontairement plus rare que les autres bonus.
- [x] Les projectiles sont gérés par un stock d'objets réutilisables créé une fois au démarrage plutôt que créés/détruits en continu — un détail de performance qui évite les ralentissements quand l'écran est plein de tirs.

## Ennemis

- [x] Plusieurs types d'ennemis avec des statistiques différentes (résistance, vitesse, valeur en points, capacité à tirer ou non).
- [x] Un type d'ennemi plus rare et plus résistant, qui devient de plus en plus fréquent à mesure que la partie avance.
- [x] À partir d'un certain stade de la partie, une partie des ennemis "normaux" se met aussi à tirer (avant ce stade, seul le type rare tirait).
- [x] Les ennemis n'apparaissent que dans une zone définie de l'écran (pas n'importe où), ce qui garde l'écran lisible même sur un petit écran de téléphone — une fois apparus, ils peuvent ensuite se déplacer librement.
- [x] Même système de stock d'objets réutilisables que pour les projectiles.

## Boss

- [x] Le combat de boss se joue sur plusieurs "points faibles" à détruire un par un, plutôt qu'une seule barre de vie globale.
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

## Effets ("game feel" — ce qui rend les impacts satisfaisants)

- [x] Petites particules (étincelles, débris) à chaque explosion/impact, gérées par le même système de stock réutilisable.
- [x] Tremblement léger de l'écran, dont l'intensité dépend de la gravité de l'événement (pas systématique à chaque tir, sinon l'écran tremblerait en permanence).
- [x] Bref ralenti du jeu (quelques centièmes de seconde) sur les coups marquants, pour appuyer l'impact sans vraiment mettre en pause.
- [x] Ralenti plus long et plus prononcé au moment de la mort du joueur, avant l'écran de fin de partie.
- [x] Flash blanc bref à l'écran sur les moments forts (victoire de boss, etc.).
- [x] Vibration du téléphone sur les impacts (sur les appareils qui le supportent — ignoré silencieusement sinon).
- [x] Le tremblement d'écran est désactivé si le système d'exploitation du joueur indique une préférence pour moins de mouvement à l'écran (réglage d'accessibilité standard des navigateurs).

## Décor

- [x] Fond étoilé sur plusieurs couches qui défilent à des vitesses différentes (effet de profondeur).
- [x] Éléments de décor occasionnels et discrets (planètes, galaxies lointaines) qui apparaissent de temps en temps sans jamais gêner la lisibilité.
- [x] Décor spécifique qui apparaît pendant les combats de boss et disparaît proprement (avec une petite animation) une fois le boss vaincu.

## Audio

- [x] Tous les bruitages (tirs, explosions, etc.) sont générés directement par du code audio, sans aucun fichier son à charger.
- [x] La musique, elle, est une vraie playlist de morceaux (fichiers de musique "tracker"), jouée dans un ordre aléatoire qui évite de rejouer deux fois de suite le même morceau.
- [x] Musique et bruitages partagent le même circuit audio interne plutôt que d'en avoir chacun un séparé (nécessaire pour que le son fonctionne correctement sur certains navigateurs mobiles).
- [x] Réglages de volume séparés pour la musique et les bruitages, plus une coupure du son complète — tout est mémorisé d'une visite à l'autre.
- [x] Changement de musique en fondu (le son baisse puis remonte) plutôt qu'une coupure nette, pour éviter un clic audible désagréable.

## Interface & menus

- [x] Tous les écrans nécessaires : titre, pause, confirmation avant de quitter une partie, aide, crédits, fin de partie, saisie du pseudo, classement.
- [x] Navigation possible au clavier (flèches + Entrée) et à la souris, avec un petit son quand la sélection change.
- [x] L'écran d'aide s'affiche automatiquement lors de la toute première partie jouée, puis reste accessible à la demande ensuite via un bouton.
- [x] La saisie du pseudo de fin de partie fonctionne même sur les téléphones où le clavier virtuel ne s'ouvre pas automatiquement (bouton de validation tactile en secours).
- [x] Légende visuelle des bonus dans l'écran Aide (icône + couleur réelles de chaque bonus, pas juste une liste de noms) — le joueur associe l'apparence à l'effet sans avoir à tout ramasser pour vérifier.
- [x] Réglage de la vitesse du jeu (x1/x1.5/x2, bouton dans le panneau en bas à gauche, préférence mémorisée) — accélère tout ce qui dépend du temps de façon uniforme (donc la difficulté relative ne change pas), sans jamais affecter la musique ni les bruitages (qui tournent sur leur propre horloge audio).
- [x] Lien vers le code source (GitHub) dans les crédits.
- [x] Numéro de version affiché dans le jeu (détail plus bas).

## Classement (leaderboard)

- [x] Les scores sont envoyés à un vrai serveur et lus depuis ce serveur (pas seulement stockés sur l'appareil du joueur), donc partagés entre tous les joueurs.
- [x] Un compteur du nombre total de parties jouées, toutes personnes confondues.
- [x] Si le serveur est injoignable, l'écran de classement l'affiche proprement (liste vide) plutôt que de planter ou de bloquer le jeu.

## Accessibilité & mobile

- [x] Respect du réglage système "réduire les animations" (coupe le tremblement d'écran).
- [x] Contrôle tactile pensé spécifiquement (pas juste traité comme un clic de souris) : décalage de visée, empêche le navigateur de scroller/zoomer pendant qu'on joue.
- [x] L'affichage s'adapte à la taille de l'écran/de la fenêtre en gardant les proportions du jeu.
- [x] Le jeu se met en pause automatiquement si on change d'application ou d'onglet en pleine partie (évite de perdre des vies pendant l'absence).

## Sauvegardé sur l'appareil du joueur

- [x] Préférences personnelles (volumes, coupure du son, dernière musique jouée, filtre visuel activé ou non, tir automatique, panneau replié, dernier pseudo utilisé) — si le stockage local est indisponible (navigation privée, par exemple), le jeu continue de fonctionner normalement, juste sans mémoriser ces préférences.

## Suivi de version

- [x] Numéro de version affiché dans le jeu (menu principal + crédits), qui augmente automatiquement à chaque mise à jour du code plutôt que d'être choisi à la main.
- [ ] Journal détaillé des changements (changelog) — pas encore fait.

## Tests

- [x] Tests automatiques sur la logique du jeu qui ne dépend pas de l'affichage (calculs, règles), rapides à exécuter.
- [x] Tests automatiques qui pilotent un vrai navigateur pour vérifier les scénarios plus longs à atteindre normalement (obtenir un bonus, rencontrer un boss), en accélérant temporairement certains réglages le temps du test seulement.

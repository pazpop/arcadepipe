# Règles du jeu

Ce que fait le jeu, côté joueur. Les valeurs chiffrées vivent dans [`js/config.js`](js/config.js), sauf celles des ennemis ([`js/enemies.js`](js/enemies.js)) ; l'organisation du code est décrite dans le [README du frontend](README.md).

## Le vaisseau

- Il suit la souris ou le doigt. Au tactile, il vole un peu en avant du doigt, pour ne pas être caché dessous.
- Tir automatique par défaut ; en décochant la case « Tir automatique », on tire en maintenant le clic ou le doigt.
- 3 vies. Après un coup, le vaisseau clignote et reste invulnérable un court instant.
- La zone qui encaisse les coups est minuscule (le cockpit), bien plus petite que le sprite.

## Les ennemis

| Type | PV | Comportement | À partir de |
| --- | --- | --- | --- |
| Normal (vert) | 1 | vole en ligne droite, ne tire pas | vague 1 |
| Élite (violet) | 3 | ondule, tir visé | vague 3 |
| Kamikaze (rouge) | 1 | poursuit le joueur, ne tire pas ; 2 à la fois au maximum | vague 4 |
| Gunner (bleu) | 2 | un ennemi normal qui tire, plus lentement qu'une élite | vague 5 |

- Ils apparaissent dans le tiers droit de l'écran, puis se déplacent librement.
- Un ennemi ne tire que si le joueur est devant lui, et jamais depuis le tiers gauche de l'écran.
- Un ennemi touché mais pas détruit passe à une version ternie de son sprite : il n'y a pas de jauge de PV.

## Les vagues

- Une vague se termine après un nombre d'ennemis abattus, qui augmente à chaque vague. Les ennemis apparaissent de plus en plus vite et leurs tirs accélèrent, jusqu'à un plafond.
- Entre deux vagues, un saut spatial : ni tirs ni collisions.
- **Bonus « INTACT »** : +500 points si la vague se termine sans vie perdue. Le HUD l'affiche sous les vies tant qu'il est encore possible.
- Une vague sur 5 est un combat de boss.

## Le boss

- Sa coque est indestructible : il faut détruire ses points faibles (4 à 6 selon la vague), qui passent du jaune à l'orange puis au rouge. Une barre de vie en bas de l'écran résume l'ensemble.
- Il est invulnérable pendant son entrée, puis tire aussitôt. Ses tirs s'intensifient à chaque point faible détruit.
- Deux couleurs de tirs, selon la façon de les esquiver : bleu pour les éventails visés, blanc pour les spirales et les anneaux.
- Foncer dans sa coque coûte une vie.
- Derrière lui, en décor, la silhouette du vaisseau-mère de la flotte ennemie.
- Le premier boss est adouci (moins de vie, tirs plus lents et moins nombreux).
- Le vaincre rapporte un gros bonus de score et une vie (5 au maximum).

## Les bonus

Un ennemi détruit lâche parfois un bonus. Une arme et un bouclier peuvent être actifs ensemble, mais aucune arme n'apparaît tant qu'une arme bonus est active, ni aucun bouclier tant qu'il en reste un. Un seul bonus au sol à la fois.

| Bonus | Effet |
| --- | --- |
| Puissance | tirs plus forts, cadence plus lente |
| Rafale | cadence très rapide, tirs plus faibles |
| Chevrotine | cône de plombs, dont les dégâts diminuent avec la distance |
| Bouclier | absorbe 3 coups, sans limite de temps |

Les trois armes durent 20 secondes ; le décompte est en pause pendant un saut spatial.

## Frôlement et NOVA

- **Frôler** un tir ennemi ou le corps d'un ennemi (sans se faire toucher) rapporte des points, multipliés par la longueur de la chaîne de frôlements de la vague. Un son marque les chaînes de 5, 10 et 15.
- Un tir ne compte qu'une fois ; un ennemi peut être frôlé de nouveau après un délai. La coque du boss ne compte pas.
- Chaque frôlement charge la jauge **NOVA** (en haut à gauche) : 12 frôlements pour une charge. Une charge en réserve au maximum, deux à partir du deuxième boss.
- NOVA (Espace, ou le bouton tactile) détruit tous les ennemis à l'écran et leurs tirs. Le boss y est insensible, mais ses tirs disparaissent.

## Le niveau bonus

- Proposé avant les vagues 10, 20, 30... si le score atteint un seuil, qui monte à chaque fois.
- Dix anneaux à traverser : le vaisseau ne se déplace que de haut en bas, aucune vie ne peut être perdue.
- Récompense : la jauge NOVA se remplit en proportion des anneaux réussis.

## Fin de partie et classement

- À la dernière vie perdue, l'écran GAME OVER propose **REJOUER** (une nouvelle partie aussitôt) ou **CLASSEMENT**.
- Un score qui entre dans le top 10 est enregistré dans les deux cas. Par CLASSEMENT, le joueur choisit son pseudo (8 caractères) ; par REJOUER, c'est le dernier pseudo saisi, ou « AAA ».
- Le bouton Partager crée une image du résultat (score, vague, ennemis abattus, meilleure chaîne, distance) avec un QR code vers le jeu.

## Réglages et accessibilité

- En bas à gauche : le bouton Pause et le panneau de réglages, repliable (musique, bruitages, vitesse du jeu x1, x1.5 ou x2, tir automatique, filtre rétro, aide, plein écran, langue française ou anglaise, cookies si la mesure d'audience est activée).
- Le jeu est toujours en 16:9. Sur un écran plus large (téléphone en paysage), ces commandes et le bouton NOVA tiennent dans les bandes noires.
- Clavier : Échap ou P pour la pause, Espace pour NOVA, M pour couper le son. Les menus se parcourent aux flèches et à Entrée.
- Le jeu se met en pause quand l'onglet passe en arrière-plan.
- Le tremblement d'écran est coupé si le système demande moins d'animations.
- Les préférences sont gardées sur l'appareil ; sans stockage local, le jeu fonctionne sans les mémoriser.

## Partis pris visuels et sonores

- Aucun fichier image : chaque sprite est une grille de caractères convertie en image au démarrage ([`js/assets.js`](js/assets.js)).
- La couleur porte une information. Aucun autre ennemi que le boss n'est jaune or ; la couleur d'un tir dit comment l'esquiver, pas qui l'a tiré.
- Les couleurs de jeu sont saturées ; le décor et les particules sont ternis pour ne jamais se confondre avec un tir.
- Tous les bruitages sont synthétisés par le code ([`js/audio/sfx.js`](js/audio/sfx.js)). La musique est une playlist de morceaux de mall-e, tirés au hasard sans répétition immédiate.

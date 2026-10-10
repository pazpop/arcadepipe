# Changelog

Changements notables (gameplay, visuel, audio, infra), plus récent en premier. Le numéro de version est `2.<nombre de commits git>` : la CI le calcule et l'écrit dans le jeu en construisant l'image (`frontend/Dockerfile`). Une entrée porte donc le numéro du commit qui l'ajoute : `git fetch`, puis le résultat de `git rev-list --count origin/main`, plus le rang du commit parmi ceux qui ne sont pas encore poussés. Avant 2.43, ou pour le détail d'une entrée condensée : `git log`.

## [2.169] - 2026-10-09
- Kit presse et descriptions itch.io et YouTube : phrases sur le frôlement et sur NOVA mises en accord avec les règles (plafond, boss épargné) ; français retouché.

## [2.167] - 2026-10-09
- **Boss** : sa façon de tirer change aussi avec le temps (toutes les 30 secondes), plus seulement à chaque point faible détruit : l'esquiver sans l'attaquer n'est plus sans danger. Sa spirale ne repasse plus par les mêmes rayons.

## [2.166] - 2026-10-09
- **Classement** : la cadence de tir du vaisseau et le rythme d'apparition des ennemis ne dépendent plus de la fréquence de l'écran (jusqu'à 9 % d'écart entre 60 et 240 Hz). À 60 Hz, le tir normal passe de 8,6 à 9,1 tirs par seconde.

## [2.165] - 2026-10-09
- Saisie du pseudo : la touche Tab ne quitte plus le champ (les lettres n'étaient plus prises, et Entrée actionnait aussi un bouton du panneau).

## [2.163] - 2026-10-09
- Kit presse : captures d'écran refaites avec le jeu actuel (anneaux du niveau bonus aux nuances variées, éventail du premier boss).

## [2.162] - 2026-10-09
- **Classement** : seuls les 40 premiers tirs frôlés de chaque vague rapportent des points (les suivants chargent encore NOVA) : rester devant un boss en frôlant ses tirs ne rapporte plus rien.
- **Boss** : ses anneaux balaient l'écran au fil des salves, sans laisser de couloir sûr ; le premier boss retrouve des éventails plus légers (3 tirs, puis 5).
- « INTACT » ne reste plus figé sur GAME OVER ; l'Entrée du pavé numérique fonctionne ; l'aide ouverte au clavier se referme avec Entrée ; les flèches sur un curseur de volume ne déplacent plus la sélection du menu.
- Changer de langue garde les autres paramètres de l'adresse.
- API : un en-tête `X-Forwarded-For` vide ne désactive plus la limite d'envois.
- Numéros corrigés dans ce fichier : 2.159 et 2.160 (notés 2.157 et 2.158), et l'entrée 2.156 séparée de la 2.154.

## [2.160] - 2026-10-09
- Dépendances Python : `pydantic_core` n'est plus épinglé à part (pydantic impose déjà sa version exacte), ce qui faisait échouer les mises à jour proposées par Dependabot.

## [2.159] - 2026-10-09
- Kit presse : la page des descriptions n'annonce plus une sélection au clic, que la politique de sécurité du site bloquait.

## [2.156] - 2026-10-09
- **Textes** relus dans les deux langues : l'aide situe la case « Tir automatique » dans le panneau de réglages ; « ENNEMIS {n} » et « KILLS {n} » en fin de partie (plus de « 1 ENNEMIS ») ; « mall-e » en minuscules, « par » au lieu de « by » en français ; colonne « ABATTUS » au classement ; en anglais, « fire rate » pour les bonus et le texte de la carte de partage.
- Kit presse : page des descriptions itch.io et YouTube, à copier (`press/descriptions.html`).

## [2.154] - 2026-10-09
- **Classement** : frôler un vaisseau ennemi charge NOVA et allonge la chaîne, mais ne rapporte plus de points (seuls les tirs frôlés en donnent) : on ne peut plus marquer sans fin en longeant des ennemis qui ne tirent pas.
- **Boss** : son éventail a toujours un tir au milieu, qui vise le vaisseau ; sa cadence monte aussi avec le temps (toutes les 30 s) ; chaque anneau passe là où le précédent laissait un couloir.
- **Kamikaze** : poursuite de 8 secondes au lieu de 6, assez pour atteindre un joueur resté tout à gauche.
- La formation en flèche n'apparaît plus par-dessus un autre ennemi.
- **Clavier** : Entrée ou Espace sur un réglage du panneau n'agit plus aussi dans le jeu ; après une pause au clavier, Entrée choisit bien REPRENDRE ; un clic droit ne choisit plus une option de menu.
- **Langue** : le bouton fonctionne aussi quand le stockage du navigateur est bloqué (la langue passe dans l'adresse, `?lang=en`).
- La bannière d'une vague ne reste plus figée sous GAME OVER ; le panneau de réglages ne clignote plus au chargement ; « … » à côté de VALIDER pendant l'envoi du score.
- Tests e2e : ils lisent maintenant les textes affichés par le jeu, et couvrent le record personnel, le classement injoignable ou lent, la chaîne cassée par un coup et la récompense du niveau bonus.
- Python 3.12 au minimum pour le backend ; une seule proposition Dependabot pour toutes les dépendances Python.
- Numéros corrigés dans ce fichier : 2.125 (noté 2.124) et 2.142 (noté 2.144) ; dates des 2.127, 2.128 et 2.131.

## [2.153] - 2026-10-09
- Images de base téléchargées depuis le miroir de Docker Hub tenu par Google : une panne de Docker Hub ne bloque plus la construction.

## [2.152] - 2026-10-09
- Aide : cinq pages, la musique y retrouve sa section (avec les raccourcis clavier).

## [2.151] - 2026-10-09
- **Record personnel** : le meilleur score est gardé sur l'appareil, affiché au menu, et l'écran de fin annonce un nouveau record.
- **Formation ennemie** : à partir de la vague 2, une vague sur deux environ voit passer trois ennemis normaux en flèche (une formation par vague au plus).
- **Un coup encaissé casse la chaîne de frôlements** (elle ne retombait qu'au changement de vague).
- **Fin de partie** : l'écran dit quand le classement est injoignable, et affiche « … » pendant qu'il attend le serveur ; le classement affiche « Chargement… » au lieu d'un tableau vide.
- **Aide** : deux règles en plus (couleurs des tirs du boss, foncer dans un ennemi), à la place de la section Musique.
- Cadence du boss : un seul réglage (`BOSS.fireInterval`, `fireIntervalFactor`) au lieu de deux mécanismes cumulés ; le rythme reste le même à 5 % près.

## [2.150] - 2026-10-09
- **Niveau bonus** : chaque anneau a sa propre nuance, tirée au hasard entre le vert d'eau et le bleu.
- Charge NOVA comptée en frôlements entiers : elle arrive exactement au nombre prévu, quel que soit le réglage.

## [2.148] - 2026-10-09
- **Classement protégé d'un score sans effort** : les anneaux du boss partent d'un angle différent à chaque salve (leurs couloirs sûrs ne sont plus fixes), et le multiplicateur de frôlement est plafonné à 20.
- **Niveau bonus toujours offert** avant les vagues 10, 20, 30... : le seuil de score, toujours atteint en pratique, est retiré. Son dernier anneau reste visible jusqu'à sa sortie de l'écran.
- **Kamikaze** : il cesse sa poursuite après 6 secondes au lieu de tourner sans fin autour d'un joueur immobile.
- **Bouton Pause** : il répond de nouveau au clavier et aux lecteurs d'écran ; le clic droit ne l'actionne plus.
- Maintenir M ne fait plus clignoter le son ; le flash d'un NOVA ne reste plus figé derrière GAME OVER.
- **API** : un score non fini (`1e400`, `NaN`) est refusé proprement au lieu de provoquer une erreur du serveur.
- Toutes les dépendances Python de l'image sont épinglées, donc vérifiées par l'audit ; logs plafonnés dans le déploiement autonome.
- Musique : accord écrit de mall-e pour la diffusion dans le jeu, sur le site et les plateformes.
- Outils : `tools/check_unused.py` (code resté après une suppression, lancé par la CI) et `npm run smoke` (vérifie le jeu en ligne après un déploiement).

## [2.147] - 2026-10-09
- Audit des dépendances relancé chaque lundi par un workflow dédié ; Caddy peut écrire dans ses dossiers temporaires (plus d'erreurs au démarrage).

## [2.146] - 2026-10-09
- Image du frontend allégée de 48 Mo (les fichiers n'y sont plus copiés deux fois).

## [2.145] - 2026-10-09
- **Boss** : ses tirs en éventail ne tournent plus en rond sans jamais quitter l'écran (ils s'accumulaient au fil du combat et ralentissaient le jeu). La courbe dure une seconde, puis le tir file droit.
- **Téléphone** : NOVA et Pause répondent pendant qu'un doigt pilote le vaisseau ; un pouce posé hors du jeu ne détourne plus le vaisseau ; la saisie du pseudo tient dans la moitié haute de l'écran, au-dessus du clavier ; le son revient après un appel.
- **Stockage bloqué** (navigation privée, cookies tiers refusés sur itch.io) : les réglages et le pseudo sont gardés le temps de la visite, et l'aide de bienvenue ne se rouvre plus à chaque partie.
- **Niveau bonus** : sa récompense peut remplir la seconde charge NOVA, même avec une charge déjà en stock.
- **Ennemis** : les tireurs arrivent en vague 6 (la 5 est un boss) ; un ennemi normal ou un kamikaze touché sans être détruit est terni, comme les autres.
- Un score nul n'entre plus au classement.
- Accessibilité : noms lisibles par un lecteur d'écran sur les boutons à icône ; lien de confidentialité plus grand.
- Bandeau de cookies, page de confidentialité (sauvegardes, date non publiée) et docs de sécurité reformulés pour dire exactement ce qui est fait.
- Backend : `uvicorn` sans ses extras inutilisés, outils de test épinglés.

## [2.142] - 2026-10-09
- **Classement mieux protégé** : 50 envois de scores par jour et par adresse IP, en plus de 5 par minute.
- **Fin de partie** : REJOUER et la seconde option ne se figent plus quand le serveur du classement est lent.
- **Panneau replié** : ses réglages ne se parcourent plus au clavier, et il ne décale plus les boutons ⏸ et ⚙ sur le jeu.
- **Clavier** : sur une page qui embarque le jeu (itch.io), il répond sans clic préalable, et Espace ou les flèches ne font pas défiler la page.
- **Téléphone** : la musique démarre dès le premier toucher, toucher l'écran rouvre le clavier à la saisie du pseudo, et le classement fonctionne sur les iPhone d'avant 2022.
- Image de partage : marge blanche du QR code portée à la taille demandée par la norme. Le bouton Partager confirme toujours le téléchargement.
- L'API ne renvoie plus l'identifiant ni la date des scores, dont le jeu ne se sert pas.
- Kit presse et page de confidentialité : le jeu ne se pilote pas au clavier ; anglais corrigé.

## [2.140] - 2026-10-09
- **Panneau de réglages replié par défaut**, derrière un bouton ⚙ : ouvert, il cachait le bord gauche du jeu, dont les noms du classement.

## [2.138] - 2026-10-09
- **Fin de partie** : quand le score entre dans le top 10, l'écran GAME OVER l'annonce et la seconde option devient « ENTRER MON PSEUDO » (elle reste « CLASSEMENT » sinon).
- Si le serveur du classement ne répond pas, le jeu ne propose plus de saisir un pseudo pour un score qu'il ne pourrait pas envoyer.

## [2.137] - 2026-10-09
- **Tir automatique activé par défaut** ; en le décochant, on tire en maintenant le clic ou le doigt.
- **Décor en couches** : les étoiles, puis la planète de passage, puis le vaisseau-mère des boss, désormais opaque, qui cache ce qui passe derrière lui.

## [2.136] - 2026-10-09
- **Nouveau décor des combats de boss** : le vaisseau-mère ennemi, une très grande silhouette sombre, à la place de la sphère précédente.
- Fix : la teinte de la coque du boss débordait en rectangle sur le décor derrière elle.
- Kit presse : capture d'un combat de boss, image de couverture pour itch.io.

## [2.134] - 2026-10-09
- Bouton de langue : drapeaux seuls (États-Unis et Royaume-Uni pour l'anglais, France et Québec pour le français).
- **Page de confidentialité** (`privacy.html`), en français et en anglais, accessible depuis le panneau de réglages et le bandeau de cookies.
- **Kit presse** (`/press/`) : présentation dans les deux langues, fiche technique, quatre captures et une vidéo de jeu, refaites par `npm run presskit`.
- **itch.io** : l'adresse de l'API du classement devient réglable (`apiBase`, `site-config.json`) et `tools/build_itch.py` construit l'archive à déposer.
- CI : les tests bout-en-bout (Playwright) tournent avant la construction des images.

## [2.131] - 2026-10-08
- **Image d'aperçu des liens partagés** (`og-image.png`) : le titre du jeu sur une capture de partie, affichée par Discord, X, Facebook...
- **Filtre rétro** : une case dans le panneau de réglages, donc réglable sur téléphone. Le raccourci C est retiré.
- **Bouton de langue** : il propose l'autre langue, écrite dans cette langue et avec son drapeau (« Change » et le drapeau américain quand le jeu est en français).
- **Fluidité** : le halo des tirs n'utilise plus de flou par tir, qui coûtait cher quand l'écran en était plein (combats de boss).
- Numéro de version calculé par la CI ; test e2e du classement avec le vrai backend, lancé en local.

## [2.128] - 2026-10-08
- **Téléphone en paysage** : le jeu garde son format 16:9 et les commandes se rangent dans les bandes noires. Le bouton Pause et l'onglet du panneau sont toujours visibles à gauche (le panneau est replié par défaut sur un écran bas), NOVA et Partager à droite, en tenant compte de l'encoche.
- Scores de départ (`seed.py`) écrits au format du jeu.

## [2.127] - 2026-10-08
Corrections issues d'une seconde relecture complète.
- **Bonus : un bouclier et une arme peuvent être actifs ensemble.** Aucune arme n'apparaît tant qu'une arme bonus est active, aucun bouclier tant qu'il en reste un.
- **Mesure d'audience désactivée par défaut** : l'identifiant Google Analytics n'est plus dans le dépôt, il est donné à la construction de l'image (variable `GA_MEASUREMENT_ID` du dépôt GitHub, voir [docs/deploiement.md](docs/deploiement.md)). Sans lui : ni script, ni bandeau, ni bouton Cookies.
- Fix : un bouton cliqué gardait le focus clavier (Espace décochait « Tir automatique », ou remettait en pause) ; le vaisseau pouvait rester invisible pendant le niveau bonus ; en vitesse x2 des tirs traversaient les ennemis ; la souris posée sur une option bloquait les flèches ; un caractère refusé bloquait la saisie du pseudo ; la partie continuait pendant le ralenti de mort ; relâcher le tir à l'apparition de GAME OVER pouvait choisir une option ; Konami code après un Haut en trop.
- Musique : elle s'interrompt quand l'onglet passe en arrière-plan, et ne reste plus muette après un arrêt pendant un rechargement de piste.
- Aide : NOVA détruit tous les ennemis et leurs tirs (pas seulement les « normaux »), deux charges dès le 2e boss.
- Panneau de réglages : il défile s'il est plus haut que l'écran (téléphone en paysage).
- Backend : 10 000 scores gardés en base (100 lisibles), pour que de faux scores ne puissent pas effacer les vrais.

## [2.125] - 2026-10-08
- Anglais : une douzaine de formulations retouchées (aide, bandeau de cookies, fin de partie).

## [2.123] - 2026-10-08
- Ménage sans changement de comportement : code mort retiré (champs, paramètres et garde-fous jamais utilisés), doublons supprimés (textes français du HTML, clés de traduction en double, règles CSS répétées), commentaires faux ou historiques corrigés.
- Tests e2e : les tests de tir, de fin de vague et de musique vérifient l'état du jeu au lieu d'attendre un délai ; nouveaux tests « Tab puis Entrée » et « scène figée en pause ».

## [2.122] - 2026-10-08
Corrections issues d'une relecture complète du dépôt.
- **Fix : Tab puis Entrée envoyait un score au classement depuis n'importe quel écran** (le champ caché du pseudo prenait le focus au clavier).
- Fix : M (son) et le Konami code sur un clavier AZERTY ; la musique arrêtée par le joueur le reste d'une partie à l'autre ; l'écran ne tremble plus pendant la pause ; le bonus « INTACT » est versé aussi avant un niveau bonus ; « NOUVEAU MEILLEUR SCORE » ne s'affiche qu'une fois le top vérifié ; le décor du boss ne reste plus dans les menus ; le flottement du boss suit le temps de jeu ; NOVA donne toujours son retour visuel et sonore ; la seconde note du son de bonus n'est plus tronquée.
- Classement : « indisponible » si le backend ne répond pas, au lieu de « aucun score ». Bouton Partager en bas à droite (il recouvrait du texte sur téléphone).
- Backend : pseudo limité aux caractères que le jeu saisit (8 lettres majuscules, chiffres ou espaces) ; seuls les 100 meilleurs scores sont gardés ; ex æquo départagés par ordre d'arrivée ; taille des requêtes API plafonnée dans le Caddyfile ; documentation interactive de l'API désactivée ; `seed.py` ne crée plus de doublons.

## [2.121] - 2026-10-08
- **Jeu en français et en anglais.** La langue suit celle du navigateur au premier lancement (anglais si elle n'est pas traduite), puis le choix fait avec le bouton de langue du panneau de gauche est mémorisé. Un fichier par langue dans `frontend/js/i18n/` (`fr.js` est la référence) ; `i18n.test.js` vérifie que chaque langue a les mêmes clés. Changer de langue recharge la page.

## [2.120] - 2026-10-08
- **Bouton « Cookies »** dans le panneau de gauche : rouvre le bandeau de consentement pour changer son choix à tout moment. Refuser après avoir accepté coupe Google Analytics sur-le-champ et efface ses cookies. Le bandeau renvoie vers la page des données collectées.

## [2.119] - 2026-10-08
- Rappel « INTACT +500 » sous les vies tant que la vague est sans dégât ; clignote en rouge 1 s au premier coup encaissé, puis disparaît jusqu'à la vague suivante.
- Micro-gel à l'impact réservé aux événements rares : plus rien sur un kill normal, 0,08 s sur un élite, 0,13 s sur un point faible, 0,14 s à la victoire sur le boss (`HIT_STOP`, à ajuster au ressenti).
- Graze : son de palier (double tic aigu) quand la chaîne atteint 5, 10 et 15 (`GRAZE.milestones`).

## [2.118] - 2026-10-08
- Cache du classement : les lectures (top 10, compteur de parties) sont gardées 60 s dans `js/api.js` et vidées dès qu'un score est soumis ou qu'une partie est comptée. Rouvrir le classement ne refait plus de requête (`api.test.js`).

## [2.117] - 2026-10-08
- Pseudo par défaut : « AAA », comme sur les bornes d'arcade, à la place de « PILOTE » suivi de deux chiffres (REJOUER et pré-remplissage de la saisie).

## [2.116] - 2026-10-08
- **Rejouer en 1 clic.** L'écran GAME OVER propose REJOUER (par défaut) et CLASSEMENT à la place de « OK ». REJOUER relance aussitôt : avant, il fallait 3 ou 4 clics (OK, valider le pseudo, classement, JOUER). Le score n'est pas perdu : s'il entre dans le top 10, il est envoyé en arrière-plan sous le pseudo mémorisé, ou un nom de pilote aléatoire.

## [2.115] - 2026-10-08
- **Fix : textes illisibles.** Le jeu était dessiné en 480×270 puis agrandi : un texte de 7 px n'avait que 7 pixels de haut. Le canvas est maintenant rendu à la résolution de l'écran (densité plafonnée à 2), le jeu dessine toujours en coordonnées 480×270 (`renderer.js`). Sprites inchangés.

## [2.114] - 2026-10-08
- **Fix : les ennemis pouvaient tirer vers l'arrière.** Un élite ou un gunner ne tire plus que si le joueur est devant lui (`enemies.test.js`).
- Fix : le bandeau de consentement recouvrait le bas du panneau de gauche ; il est maintenant en haut de l'écran.
- Panneau de gauche : barres de volume musique et bruitages alignées, libellé « MUSIQUE (by Mall-E) ».

## [2.113] - 2026-10-07
- **Quatrième morceau** de [mall-e](https://mall-e.bandcamp.com/) dans la playlist (`fourth.mp3`, en ligne depuis le 2026-10-07).
- Backend : Python 3.13 (image Docker, CI et cible de ruff) et FastAPI 0.142.2.

## [2.107] - 2026-09-30
- Boss plus résistant : 5 PV par point faible au lieu de 3, 4 pour le premier boss.

## [2.106] - 2026-09-30
- **Fix : le boss pouvait être détruit avant son premier tir.** Ses points faibles encaissaient des dégâts pendant son entrée (~3,3 s). Il est maintenant invulnérable pendant une entrée plus rapide, et tire presque aussitôt arrivé.
- Tests backend : `httpx2` à la place de `httpx`, déprécié par starlette 1.7.
- Docs : références au lecteur tracker retiré mises à jour, nouvelle capture d'écran dans le README.

## [2.100] - 2026-09-30
- **Nouvelle musique** : 3 morceaux originaux de [mall-e](https://mall-e.bandcamp.com/), en MP3, crédité et remercié dans le jeu et le README.
- Lecteur tracker (`.xm`, libopenmpt, chiptune3) retiré : les pistes sont lues par un simple élément `<audio>` branché sur l'AudioContext des bruitages. Plus de WebAssembly, donc plus besoin de `'unsafe-eval'` dans la CSP.

## [2.93] - 2026-09-30
- Zoom du navigateur autorisé (accessibilité) ; le canvas bloque toujours les gestes pendant le jeu (`touch-action: none`).
- Nettoyage : CSS sans `!important`, meta `keywords` retirée, tests backend sans état global partagé, ROADMAP raccourcie (sujets d'infra suivis côté terraform).

## [2.92] - 2026-09-30
- Fix : téléchargement de la carte de partage (URL libérée après un délai ; révoquée aussitôt, certains navigateurs annulaient le téléchargement).

## [2.91] - 2026-09-30
- Fix : l'Aide ouverte depuis le menu principal reprend à la page 1.
- Tests e2e bonus et bouclier : vérifient le ramassage réel et la règle « un seul bonus à la fois » au lieu de simples attentes fixes.

## [2.90] - 2026-09-30
- Nettoyage sans changement de comportement : client HTTP du classement déplacé de `js/audio/leaderboard.js` vers `js/api.js`, références périmées corrigées dans les commentaires et les docs, commentaires historiques retirés. Docs raccourcies (GAMEPLAY.md, tableau de la Session 5 de la ROADMAP). CI : `npm ci`.

## [2.88] - 2026-09-30
- **Fix : musique parfois muette pendant toute la première partie.** Une piste envoyée au lecteur avant qu'il soit prêt (nœud audio pas encore créé, ou WASM de libopenmpt pas encore chargé) était perdue sans erreur. Les messages attendent maintenant que le lecteur soit prêt (correctif n° 4 du lecteur tracker, retiré depuis).
- Tests e2e : attente de l'état réel du jeu (`waitForMode`, `gameState`) au lieu de délais fixes ; `music-end` stable, et le test du boss atteint enfin un combat de boss.

## [2.87] - 2026-09-30
- Fix : taper M ou C dans le pseudo coupait le son / basculait le filtre CRT. Raccourcis clavier ajoutés à l'écran Aide.
- CI : les tests backend (`pytest`) et frontend (`node --test`) bloquent désormais le build.
- Nettoyage sans changement de comportement : code mort (`watchAudioContext`, gardes audio inutiles, migration `kills`), commentaires faux ou historiques.

## [2.82] - 2026-09-18
- Nettoyage sans changement de comportement : stockage local factorisé (`js/storage.js`), exports inutiles retirés, commentaires raccourcis, `frontend/.dockerignore` (tests et docs ne sont plus servis en production).
- Docs en 3 couches : README racine réduit, détail dans `docs/` (déploiement, sécurité, données collectées), CHANGELOG et ROADMAP condensés.

## [2.76] - 2026-09-18
- **Fix : musique qui ne redémarre jamais en fin de piste, boucle de GET sur les `.xm`, RAM qui grimpe.** Le worklet reposta `end` à chaque quantum audio ; chaque `end` relançait un `fetch`. Reproduit par `music-end.spec.js` (2031 requêtes en 6 s à 150 ms de latence).
- Fix (infra) : `favicon.svg` absent de l'image Docker (404).

## [2.75] - 2026-09-18
- Fix : QR code de la carte de partage teinté (l'ombre du texte précédent restait active). Test e2e qui décode le QR après recompression JPEG.

## [2.74] - 2026-09-18
- Bandeau de consentement RGPD : Google Analytics n'est chargé qu'après « Accepter » (`js/consent.js`).
- Bouton Plein écran dans le panneau de gauche (masqué si l'API est absente, ex. iPhone).

## [2.73] - 2026-09-18
- Google Analytics ajouté sur l'instance publique (CSP ajustée côté infra).

## Versions antérieures (condensé)

- **2.71** — Ennemis : plus de tir depuis le tiers gauche. Fix musique (abandon définitif après 3 essais) et boucle de requêtes sur `onError`. Tactile : vaisseau plus éloigné du doigt.
- **2.64** — Écran Aide en une colonne, 4 pages.
- **2.63** — Distance parcourue (années-lumière) à l'écran de fin et sur la carte de partage ; QR code sur la carte (`lib/qrcode.js`).
- **2.62** — Refactor : `states/waves.js` extrait de `playing.js`. Fix : le graze pouvait charger la jauge NOVA pendant le niveau bonus.
- **2.61** — Konami code : tilt du canvas synchronisé avec le jingle.
- **2.60** — Fix : anneau des planètes dessiné en deux moitiés (avant/arrière).
- **2.59** — Favicon (SVG repris du sprite du vaisseau).
- **2.58 / 2.57** — Nettoyage : `playEnemyShot()` jamais appelée supprimée ; initialisation audio simplifiée.
- **2.56** — Fix musique (compteur d'essais jamais remis à zéro dans `playRandom()`). Aide sur 2 pages, bouton Partager recentré, trou noir du décor moins fréquent.
- **2.55** — Partage de run en un clic (image score/vague/kills/chaîne). Fix : spam console `AudioContext suspendu`, double soumission de score. Jauge « NOVA x/max », sprite terni des ennemis touchés, nouveau jingle Konami, étoiles scintillantes (menu et niveau bonus). Limite de 10 Ko sur `POST /api/*` (infra).
- **2.54** — Refactor : `game.js` (~1000 lignes) découpé en un module par écran sous `states/`.
- **2.53** — Cause des coupures de musique confirmée par l'onglet Réseau : des 429 traités comme des fichiers audio. Vérification du statut HTTP, retry différé.
- **2.52** — Musique : reprise périodique de l'`AudioContext` et logs de diagnostic.
- **2.51** — Nettoyage : doublons de code éliminés (`game.js`, `sfx.js`, `hud.js`, `boss.js`).
- **2.50** — Gunner à 2 PV ; pastilles de PV retirées au profit de la légende de l'écran Aide.
- **2.49** — ESLint en CI ; test isolé du rate limiting ; ce fichier créé.
- **2.48** — Fix fuite mémoire du lecteur tracker et reprise de l'`AudioContext` au retour d'onglet. Niveau bonus : entrée en douceur et message explicatif.
- **2.46** — Niveau bonus (série d'anneaux, récompense NOVA), Konami code, kamikazes plafonnés à 2, son NOVA dédié.
- **2.43** — Graze (frôler un tir ou un ennemi rapporte des points et charge la jauge) ; NOVA devient une ressource stockable, déclenchable à la demande.

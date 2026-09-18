# Changelog

Journal des changements notables (gameplay, visuel, audio, infra) — pas les simples ajustements numériques. Adapté au versionnement automatique de ce projet plutôt qu'à SemVer classique : `VERSION` (`frontend/js/config.js`) vaut `2.<nombre de commits>`, jamais choisi à la main (voir `frontend/GAMEPLAY.md`, section *Suivi de version*). Une entrée par version qui mérite d'être racontée, la plus récente en premier.

**Historique non rétro-rempli avant 2.43** — ce fichier démarre à sa création plutôt que de reconstituer tout l'historique Git. `git log` reste la source exhaustive pour ce qui précède.

## [2.58] - 2026-09-18
- Nettoyage : `playEnemyShot()` (audio/sfx.js) supprimée — définie mais jamais appelée nulle part dans le projet.

## [2.57] - 2026-09-18
- Nettoyage : simplification de l'initialisation audio dans main.js — fusion des écouteurs "premier geste" et "reprise permanente" en un seul (aucun changement de comportement, juste moins de code dupliqué).

## [2.56] - 2026-09-18
- **Fix (4e round) : le vrai fond du bug de musique silencieuse récurrent.** `playRandom()` (appelée à chaque nouvelle partie) ne remettait jamais à zéro le compteur de tentatives ratées, contrairement à `start()`/`next()`. Un simple accroc réseau isolé qui épuisait les 3 tentatives UNE fois dans la session bloquait ce compteur au-dessus de 3 pour le reste de la session — chaque partie suivante abandonnait alors au moindre nouvel échec, même isolé, sans plus jamais réessayer. Voir GAMEPLAY.md, Retour d'expérience, 4e round.
- Fix : le vide du trou noir (décor) n'était pas totalement opaque pendant son entrée/sortie d'écran (fondu appliqué au vide lui-même, pas seulement à son disque d'accrétion) — le fond transparaissait légèrement tant qu'il n'était pas visible en entier.
- Taux d'apparition du trou noir réduit (20% → 12% des astres tirés).
- Écran Aide réparti sur 2 pages (précédent/suivant + indicateur "1/2") — devenu trop chargé sur un seul écran depuis l'ajout de la section NOVA et de la légende bonus/ennemis.
- Menu principal : retrait du texte clignotant "APPUIE SUR ENTRÉE..." (jugé superflu) et du numéro de version en bas à droite (reste affiché dans le panneau rétractable).
- Bouton "Partager" déplacé du coin haut-droit (peu visible) vers le centre, juste au-dessus du bouton "OK"/"VALIDER".
- Nettoyage : export superflu retiré sur 4 fonctions internes (hud.js ×3, shareCard.js) — jamais utilisées hors de leur propre fichier.

## [2.55] - 2026-09-18
- Fix : spam de la console navigateur en prod (`[audio] AudioContext suspendu...` répété à chaque frame) — le garde-fou "une fois par reprise" décrit en commentaire n'était jamais réellement codé. Ajout d'une reprise permanente sur tout clic/touche (pas seulement le tout premier de la session) : en "Tir automatique", le joueur ne clique jamais sur le canvas en jouant, donc rien ne relançait l'audio si le navigateur le suspendait en cours de partie.
- Fond des écrans-menus unifié : Aide/Classement/Crédits/Saisie du pseudo affichent désormais le même champ d'étoiles défilant que le menu principal (fond opaque retiré de l'écran Aide).
- Jauge NOVA : affichage "NOVA x/max" (au lieu de pastilles) + section dédiée dans l'écran Aide qui explique clairement le fonctionnement.
- Ennemis gunner/élite (2-3 PV) : sprite qui passe à une variante aux couleurs ternies dès qu'ils ont encaissé un coup — retour visuel de dégâts sans jauge de PV à l'écran.
- Trou noir (décor) : taux d'apparition relevé (8% → 20% des astres tirés) — pouvait rester invisible plusieurs sessions d'affilée. Jamais tiré sur l'écran titre spécifiquement (trop chargé visuellement derrière le texte du menu), remplacé par quelques étoiles scintillantes.
- Niveau bonus : silhouette de baleine (easter egg) retirée (peu reconnaissable en pratique), remplacée par des étoiles lointaines qui scintillent — même mécanisme réutilisé pour le menu principal.
- Konami code : nouveau jingle "trouvaille" (fanfare montante originale), corrige au passage un bug d'enveloppe audio qui coupait les dernières notes de l'ancien arpège.
- Crédit Lumo (Proton) ajouté à l'écran crédits en jeu (déjà présent dans le README).
- **Nouveau : partage de run en un clic** — à la fin d'une partie, une image carrée (score, vague, kills, meilleure chaîne de frôlements) prête pour Twitter/Discord, copiée dans le presse-papier et téléchargée.
- Limite de taille des requêtes `POST /api/*` ajoutée côté reverse-proxy (10 Ko, infra séparée) — scopée à l'API uniquement, jamais aux fichiers statiques/musique.
- Relecture complète du repo (revue demandée explicitement, deux agents dédiés frontend/backend) : une vraie race condition corrigée (double-soumission de score possible), un export mort retiré, 13 commentaires obsolètes remis à jour après le refactor states/. Backend : rien à corriger, déjà propre.

## [2.54] - 2026-09-17
- Refactor interne (aucun changement de comportement) : `game.js` (~1000 lignes) découpé en un module par écran sous `frontend/js/states/` (menu, playing, paused, help, endOfRun, leaderboardScreen, credits) — `game.js` ne fait plus que relier (état partagé `g`, bundle `engine`) et tient maintenant en ~220 lignes. Fait par étapes, un module extrait à la fois avec tests relancés entre chaque. Architecture + diagramme documentés dans `frontend/README.md`.

## [2.53] - 2026-09-17
- **Fix (cause enfin confirmée) : la vraie cause du bug de musique silencieuse.** Preuve obtenue via l'onglet Réseau du navigateur : des 429 ("trop de requêtes") sur les fichiers `.xm`. `fetch()` ne rejetant jamais sur un code d'erreur HTTP, ces réponses étaient traitées comme des fichiers audio valides, plantaient le lecteur, et déclenchaient l'ancien retry automatique (v2.48) qui se reprenait aussitôt un 429 — une rafale de requêtes en boucle contre le serveur. Corrigé : vérification explicite du code de statut + nouvelle tentative différée (2s/4s/6s) et plafonnée (3 essais) au lieu d'immédiate. Nouveau test e2e permanent (`music-retry.spec.js`) qui simule des 429 et vérifie l'absence de rafale.

## [2.52] - 2026-09-17
- Audio : filet de sécurité supplémentaire contre le bug de musique silencieuse (toujours signalé en v2.50 malgré deux correctifs précédents) — reprise périodique de l'AudioContext (pas seulement au retour d'onglet, certains navigateurs le suspendent même onglet actif) + logs de diagnostic sur les deux chemins d'échec restants, pour savoir enfin lequel se déclenche si ça se reproduit plutôt que deviner à l'aveugle.

## [2.51] - 2026-09-17
- Nettoyage : relecture complète du repo (revue demandée explicitement) — élimination de vrais doublons de code (glissée d'entrée dupliquée dans game.js, création de bruit filtré dupliquée 3x dans sfx.js, génération/rendu de listes de menu dupliqués 3x dans hud.js, vérification "1er boss" dupliquée dans boss.js), un `let`→`const`, simplification d'une ternaire imbriquée peu lisible (Konami code). Aucun changement de comportement (vérifié par tests + captures d'écran avant/après).

## [2.50] - 2026-09-17
- Ajustement : gunner (bleu) ramené à 2 PV (au lieu de 3) — écart avec l'élite (3 PV) plus net.
- Retrait : pastilles de PV au-dessus des sprites (gunner/élite), jugées superflues en plein jeu.
- Ajout : PV de chaque type d'ennemi (hors boss) listés dans l'écran Aide, à la place des pastilles.

## [2.49] - 2026-09-17
- Infra : ESLint (config minimale) ajouté côté frontend, vérifié en CI aux côtés de ruff ; test de rate limiting isolé côté backend (le garde-fou 5/minute n'était jamais réellement exercé automatiquement) ; ce fichier créé.
- Nettoyage : paramètre `particlePool` mort dans `updateBoss` (jamais utilisé), trois initialisations de variable inutiles dans `game.js` (trouvés par ESLint).

## [2.48] - 2026-09-17
- Fix : fuite mémoire dans le lecteur de musique tracker (`chiptune3.worklet.js`) provoquant l'arrêt silencieux et définitif de la musique sur une session longue — deuxième cause distincte du même symptôme déjà partiellement corrigé (voir *Retour d'expérience* dans `GAMEPLAY.md`).
- Fix : l'`AudioContext` est repris explicitement au retour sur l'onglet — certains navigateurs le suspendent en arrière-plan sans jamais le reprendre eux-mêmes.
- Niveau bonus : entrée en douceur du vaisseau + message explicatif avant le premier anneau ; silhouette d'arrière-plan (easter egg) bien plus visible tôt dans le niveau.

## [2.46] - 2026-09-17
- Ajout : niveau bonus (traverser une série d'anneaux, récompense proportionnelle qui remplit la jauge NOVA), offert tous les 10 vagues si le score atteint un seuil par cycle.
- Ajout : Konami code (easter egg sonore, aucun effet de jeu).
- Ajustement : le gunner (bleu) encaisse autant qu'une élite (+2 PV) ; kamikazes plafonnés à 2 actifs simultanément ; le NOVA a son propre son "large" au lieu de réutiliser l'explosion normale.

## [2.43] - 2026-09-17
- Ajout : graze (frôler un tir ou le corps d'un ennemi sans le toucher rapporte des points et charge une jauge) + NOVA devient une ressource stockable déclenchable à la demande (clavier/bouton tactile) au lieu d'un drop aléatoire à effet immédiat.

---

*Comment ajouter une entrée : une ligne par changement notable, sous le numéro de `VERSION` du commit qui le porte. Pas nécessaire pour un ajustement purement numérique (équilibrage, couleur, timing) sans nouveau système.*

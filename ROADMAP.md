# Roadmap

Organisée par session de travail suggérée (issue d'une discussion Lumo/Claude/arbitrage humain le 2026-09-18) plutôt qu'en vrac — chaque session est indépendante, à reprendre quand il y a du temps dédié.

Sessions 1 (stabilisation de `states/playing.js`) et 2 (distance parcourue, QR code) : **terminées**, détail dans le [CHANGELOG](CHANGELOG.md) (2.62, 2.63).

## Session 3 — optimisations optionnelles (pas pressé)

- [ ] **Rang dynamique** (monte par tranche de X grazes sans dégât, redescend au coup encaissé, module vitesse des tirs/taux de spawn) — le code est simple (un `g.rank` + compteur, un multiplicateur lu par `bulletSpeedFactor`/le spawn d'ennemis/les intervalles de tir du boss), **le vrai coût est le tuning** : X grazes par palier, combien on perd par coup, ajuster jusqu'à ce que la pression soit juste — ça ne se devine pas, ça se joue et se réajuste. À lancer seulement quand le jeu est stable et qu'il y a du temps dédié au réglage, pas avant.
- [ ] **Cache session du classement** (`states/leaderboardScreen.js`) : chaque ouverture de l'écran classement refait `fetchTopScores(10)` **et** `fetchGamesPlayedCount()`, sans mémorisation — 5 ouvertures/fermetures = 10 requêtes. Payloads minuscules et rate-limiting déjà en place côté backend, donc gain estimé <10ms par session ; pas prioritaire, à faire seulement si un joueur signale une vraie lenteur (data-driven, pas préemptif). Si implémenté : un cache avec TTL court, **contrainte explicite — doit s'invalider après une soumission de score** (`confirmNameEntry` rouvre le classement juste après avoir soumis, `g.scores` doit rester frais à ce moment précis, jamais servir une version en cache à cet instant-là).
- [ ] **Événement mi-run** (un mini-événement imprévu qui casse la courbe monotone vagues/boss/bonus une fois par run — ex: formation ennemie spéciale en anneau) — en réserve, pas pressé. Avant tout un design challenge (déclenché par quoi : vague fixe, score, temps écoulé ? les runs varient trop en durée pour un simple "milieu de partie") plutôt qu'un chantier de code : le niveau bonus fournit déjà l'échafaudage réutilisable (seuil de déclenchement, glissée d'entrée, message explicatif, garde anti-doublon), donc moins cher que ça en a l'air une fois la décision de design prise.

## Session 4 — mode paysage mobile (pas pressé)

Signalé le 2026-09-18 : sur téléphone en paysage, de grosses bandes noires apparaissent à gauche/droite de l'aire de jeu. Cause : la résolution interne est fixée en 16:9 (480×270, `RES_W`/`RES_H` dans `config.js`), alors que la plupart des écrans de téléphone en paysage sont plus larges (proche de 20:9/21:9) — `resizeCanvas()` (`main.js`) contraint donc la largeur affichée au ratio 16:9 plutôt que de remplir tout l'écran.

- Note : le bouton **Plein écran** (2.74) retire la barre d'adresse mais **pas** ces bandes noires — le ratio 16:9 reste imposé par `resizeCanvas()`.
- [ ] **Élargir la résolution interne** (ou une autre approche à définir) pour réduire les bandes — changement d'architecture, pas un simple ajustement : touche le placement du HUD, les zones d'apparition/tir des ennemis (`LEFT_BOUND`/`FIRE_MIN_X` dans `enemies.js`, tout juste ajoutées), et nécessite une vraie vérification visuelle avant/après (pas juste les tests automatisés). À traiter dans une session dédiée avec le temps de bien tester, pas en aparté d'un autre correctif.

## Session 5 — polish (liste fermée, sans nouveau système de jeu)

Contexte : ArcadePipe est stable et fonctionnel (Sessions 1-2 terminées, 2.76 déployée). Objectif : peaufiner l'existant (game feel, UX, boucle de rejouabilité) — **rien de nouveau côté systèmes de jeu**. Deux consignes : **liste fermée** (aucun ajout en cours de route ; une fois cochée, on déploie et on passe à la promotion) et **une valeur par défaut proposée pour chaque constante à tuner, notée « à ajuster au ressenti »**. Chaque item doit être vérifiable en jouant, avec une mesure objective.

État des lieux vérifié dans le code (2026-09-18) — plusieurs items partaient d'une hypothèse « à créer » alors que la base existe déjà :

| # | Item | Sévérité | Effort | Ce qui existe déjà / mesure | Valeur par défaut (à ajuster au ressenti) |
|---|---|---|---|---|---|
| 1 | **Rejouer en 1 clic** : bouton « REJOUER » dès la mort, la saisie du pseudo devient optionnelle après | Urgent | Moyen | Aujourd'hui : mort → `NAME_ENTRY` (si le score qualifie) → classement → menu → JOUER (`triggerGameOver`, `endOfRun.js`). **À chronométrer d'abord** (secondes et clics, mort → nouvelle partie). Objectif : < 2 s, 1 clic. | — |
| 2 | **Bonus « sans dégâts » plus visible** | Urgent | Faible | Le bonus **existe déjà** : +500 (`DIFFICULTY.noDamageWaveBonus`) et une bannière « VAGUE N TERMINÉE — SANS DÉGÂTS ! +500 » (`waves.js`). Reste à le rendre *ressenti pendant* la vague (rappel discret « INTACT » au HUD tant qu'aucun dégât, disparaît au premier coup) plutôt que seulement à la fin. Mesure : un testeur nouveau sait dire de quoi il s'agit sans lire l'Aide. | Rappel HUD ~7 px, couleur or, clignote 1 s à la perte |
| 3 | **Mode attract au menu titre** (le jeu se joue tout seul) | Optionnel | **Haut** | N'existe pas. Moins trivial qu'annoncé : il faut faire tourner une partie sous le menu (sans score ni classement, sans son) et un bot qui esquive un minimum — pas juste un drapeau sur le joueur. À reprendre seulement si la Session 5 se passe bien. | Bot : trajectoire pseudo-aléatoire + esquive du tir le plus proche |
| 4 | **Hit-stop calibré** (ponctuation, pas interruption) | Important | Faible | **Existe déjà** (`triggerHitStop`, `playing.js`) : kill normal 0,03 s, élite 0,05 s, point faible de boss 0,06 s, boss détruit 0,14 s, joueur touché 0,08 s. Écart avec l'intention : les kills *normaux* déclenchent déjà un hit-stop (à réserver aux événements rares). Mesure : ressenti sur une vague de 10 kills normaux vs 1 élite. | normal 0 ; élite 0,08 s (~5 images) ; point faible 0,13 s (~8) ; boss détruit 0,14 s inchangé |
| 5 | **Chaîne de graze : paliers sonores distincts** | Important | Faible | Le son monte déjà en continu avec le palier (`playGraze(tier)`, 900 Hz + 90 Hz/palier, plafonné à 8). Manque : une signature distincte et plus brillante aux seuils 5 / 10 / 15. | Seuils 5/10/15 ; note plus haute + double tic |
| 6 | **Télégraphe des tirs circulaires du boss** (anneau qui « gonfle » avant d'être mortel) | Important | Moyen | Aucun signal d'anticipation trouvé dans `boss.js`/`patterns.js` (à confirmer en jouant). Objectif : chaque tir esquivable en théorie. Mesure : plus aucune mort « injuste » sur 5 combats de boss. | ~0,2 s (~12 images) |
| 7 | **Première minute** : lancement instantané, premier kill satisfaisant, premier bonus dans les 30 s | Important | Faible | Vérification, pas de code a priori. Mesures : délai clic → 1re image jouable ; délai avant 1er drop (sur ~10 parties). | Si > 30 s : hausser le taux de drop en vague 1 seulement |
| 8 | **Indications contextuelles** : NOVA prête clignote, son distinct à l'apparition d'un kamikaze | Important | Faible | La jauge NOVA passe déjà au jaune vif quand elle est prête et le bouton tactile pulse ; le kamikaze existe (vague 4+) mais aucun son dédié trouvé dans `sfx.js`. | Son kamikaze : sifflement descendant ~0,15 s |
| 9 | **Messages de fin de partie variables** (« Presque le boss ! », « Chaîne de 42, bravo ») | Optionnel | Faible | Pas de variation aujourd'hui. Réutilise `getRunSummary()` (score, vague, chaîne max). | 3-4 messages, choisis par règle simple |
| 10 | **Partage réel** : poster une carte sur Twitter/Discord (compte de test) | Important | Faible | Le QR est lu à ≥ 400 px en simulation locale (recompression JPEG) ; il reste à vérifier en vrai. Manuel, pas de code. | — |

**Plan d'action suggéré, première session (4 items max)** : **1, 2, 4, 5** — les deux premiers ferment la boucle de rejouabilité, les deux suivants ne sont que des constantes à ajuster. Le mode attract (3) est écarté de cette première passe : c'est l'item le plus cher et il ne corrige rien d'existant. Ordre : chronométrer l'item 1 avant de toucher au code (mesure de départ), puis tout tester en jouant avant d'enchaîner sur 6-8.

- [ ] 1 — Rejouer en 1 clic
- [ ] 2 — Bonus « sans dégâts » visible pendant la vague
- [ ] 3 — Mode attract (optionnel, reporté)
- [ ] 4 — Hit-stop calibré
- [ ] 5 — Paliers sonores du graze
- [ ] 6 — Télégraphe des tirs circulaires du boss
- [ ] 7 — Première minute vérifiée
- [ ] 8 — Indications contextuelles (NOVA, kamikaze)
- [ ] 9 — Messages de fin de partie variables
- [ ] 10 — Partage réel testé

## À faire à la prochaine session (reporté faute de tokens)

La passe de nettoyage (docs en 3 couches, `docs/`, `storage.js`, exports fantômes, commentaires raccourcis, `frontend/.dockerignore`) a été faite **sans toucher au comportement du jeu** et sans relancer les batteries de tests complètes (seuls un lint et un test de fumée ont été lancés). Tout ce qui suit est explicitement repoussé, avec le contexte pour reprendre sans rien redemander.

- [ ] **Valider la passe de nettoyage** : `cd e2e && npx playwright test` (23 e2e), `cd frontend/js && node --test` (18 tests), `cd frontend && npm run lint`, sur l'ensemble des changements. Vérifier aussi en production que `/js/graze.test.js`, `/js/package.json` et `/lib/PATCHES.md` répondent 404 (ils répondaient 200 avant le `.dockerignore`).
- [ ] **Précharger les 5 pistes (156 Ko) et simplifier `music.js`.** La cause des 429 (rate-limit Traefik sur le statique) a été retirée le 17/09, et la boucle de fin de piste est corrigée (6e round). Les retries (`_loadRetries`, backoff, `onError`, jeton `_loadToken`, `_loading`, ~60 lignes) ont été écrits pour ces pannes. Idée : charger les 5 `.xm` en mémoire au premier geste et appeler `player.play(buffer)` sans réseau. Garde-fous à adapter : `e2e/tests/music-retry.spec.js` et `music-end.spec.js`. Récit : [docs/audio-saga.md](docs/audio-saga.md).
- [ ] **Helper unique pour les conditions « combat suspendu ».** Prédicats dupliqués : `graze.js:49` (`!player.alive || invuln > 0 || waveBreak > 0 || dying || shipIntro || clearingScreen`) contre `states/playing.js:135, 425, 455` (`clearingScreen`, `bonusLevel`, `waveBreak`). Cette duplication est à l'origine du bug de la Session 1 (graze pendant le niveau bonus). Proposer `isCombatSuspended(g, player)` après avoir listé les différences volontaires entre sites ; les tests de `graze.test.js` couvrent déjà le cas.
- [ ] **Vérifier avant de supprimer `watchAudioContext`** (`main.js`, ~30 lignes dont 15 de commentaire). Elle ne fait que logger une fois « AudioContext suspendu » ; la reprise réelle passe par les écouteurs `pointerdown`/`keydown` et `visibilitychange`. Avant de la retirer, confirmer qu'elle n'est pas le filet documenté de la reprise : onglet en arrière-plan 5 minutes, retour, la musique doit continuer.
- [ ] **Refonte du câblage DOM de `main.js`** (~416 lignes, une quinzaine de sections sans lien entre elles) : sortir le panneau du bas gauche (musique, volumes, tir auto, vitesse, aide, plein écran, CRT) dans un module. Objectif : lisibilité pour un débutant, comportement inchangé. Tests à relancer : `menu-pause`, `gameplay`, `consent`.
- [ ] **Features d'inspiration** (idées à évaluer, hors de la Session 5 qui reste une liste fermée) : manette via la Gamepad API (détection de connexion, analogique et croix, remappage — [SpeedLazer](https://github.com/speedlazer/speedlazer), [INNBC-STARFIGHTER](https://github.com/InnovativeBioresearch/INNBC-STARFIGHTER)) · interrupteurs de debug hitbox/FPS ([bullethell](https://github.com/selenebun/bullethell)) · démarrage à la vague N par paramètre d'URL ([galaga](https://github.com/civilian7/galaga), utile aux tests) · jeton de session serveur pour le score (le hachage côté client se contourne) · PWA installable hors ligne · leaderboard hebdomadaire · ralenti passif d'esquive (à étudier, inspiré du « slowdown » de bullethell).
- [ ] **Décision Traefik ou Caddy**, à reposer quand un 2e jeu se précise. Aujourd'hui : Traefik + docker-socket-proxy + portail pour un seul jeu. Un Caddy en frontal (~15 lignes, TLS automatique, `request_body max_size` natif) remplacerait Traefik et le conteneur frontal ; on perdrait le rate-limit (plugin tiers), le portail auto-généré et le routage par labels. Conclusion de la revue : garder tant qu'un 2e jeu est prévu. Fichiers concernés : repo `terraform-infra-pazpop-hetzner`.

## Autres (non séquencées)

- [ ] **Distance parcourue, phase 2** : l'ajouter au classement (changement de schéma serveur, non urgent).
- [ ] Test e2e comparant deux captures d'écran prises en pause (doivent être identiques bit à bit), si l'invariant de `drawScene()` (`states/playing.js`) doit être renforcé au-delà d'un commentaire.

- [ ] **Bandeau de consentement qui recouvre le bas du panneau de gauche** sur desktop (boutons Plein écran/version masqués tant que le visiteur n'a pas choisi) — le décaler ou le rétrécir. Cosmétique, rien d'urgent.
- [ ] **Permettre de changer son choix de consentement** (RGPD : retirer son accord aussi facilement qu'on l'a donné) : ajouter un bouton **« Cookies »** dans le panneau de gauche qui rouvre le bandeau (`js/consent.js` n'affiche aujourd'hui le bandeau que tant qu'aucun choix n'est mémorisé). Prévoir aussi un lien depuis le bandeau vers la section *Données collectées* du README. À faire plus tard, pas urgent.
- [ ] **Tests e2e sur Firefox et WebKit** (Safari/iOS), pas seulement Chromium — ajouter deux projets dans `e2e/playwright.config.js`, voir quels tests passent (audio/AudioWorklet, plein écran absent sur iPhone). Le jeu vise le mobile, donc Safari compte. Pas urgent.
- [ ] Autres améliorations **côté infra** (durcissement de la CSP avec `'wasm-unsafe-eval'`, copie distante et alertes des backups) : suivies dans la *Roadmap* du README de [`terraform-infra-pazpop-hetzner`](https://github.com/pazpop/terraform-infra-pazpop-hetzner), car ce sont ses fichiers qui sont concernés.

- [ ] Précharger les 5 pistes musicales en mémoire au premier geste (~156 Ko au total) au lieu d'un `fetch` à chaque changement de piste — envisagé pendant la saga audio, **plus justifié** depuis le 6e round (la cause de la boucle de requêtes n'était pas le réseau). Choix d'architecture optionnel, à ne reconsidérer que si de nouveaux incidents réseau réapparaissent.
- [ ] Score authentifié (jeton signé émis au début de la partie, exigé à la soumission) — pas urgent, le score non authentifié est un risque assumé (voir la section *Sécurité* du [README](README.md))
- [ ] Scan de vulnérabilités des **images construites** ([Trivy](https://trivy.dev/), en CI juste après le build) — `pip-audit` couvre les dépendances Python déclarées, mais pas les paquets système de l'image finale (ex: libs Debian de `python:3.11-slim`)

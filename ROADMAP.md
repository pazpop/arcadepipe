# Roadmap

Organisée par session de travail, chacune indépendante, à reprendre quand il y a du temps dédié. Ce qui est fait est dans le [CHANGELOG](CHANGELOG.md).

## Bugs signalés

- [ ] **Bug** : les vaisseaux ne devraient pas pouvoir tirer derrière eux.
- [ ] **Bug** : les boss mettent plusieurs secondes avant de commencer à tirer.
- [ ] **Bug** : les textes sont illisibles.

## Session 3 — optimisations optionnelles (pas pressé)

- [ ] **Rang dynamique** (monte par tranche de X grazes sans dégât, redescend au coup encaissé, module vitesse des tirs/taux de spawn) — le code est simple (un `g.rank` + compteur, un multiplicateur lu par `bulletSpeedFactor`/le spawn d'ennemis/les intervalles de tir du boss), **le vrai coût est le tuning** : X grazes par palier, combien on perd par coup, ajuster jusqu'à ce que la pression soit juste — ça ne se devine pas, ça se joue et se réajuste. À lancer seulement quand le jeu est stable et qu'il y a du temps dédié au réglage, pas avant.
- [ ] **Cache session du classement** (`states/leaderboardScreen.js`) : chaque ouverture de l'écran classement refait `fetchTopScores(10)` **et** `fetchGamesPlayedCount()`, sans mémorisation — 5 ouvertures/fermetures = 10 requêtes. Payloads minuscules et rate-limiting déjà en place côté backend, donc gain estimé <10ms par session ; pas prioritaire, à faire seulement si un joueur signale une vraie lenteur (data-driven, pas préemptif). Si implémenté : un cache avec TTL court, **contrainte explicite — doit s'invalider après une soumission de score** (`confirmNameEntry` rouvre le classement juste après avoir soumis, `g.scores` doit rester frais à ce moment précis, jamais servir une version en cache à cet instant-là).
- [ ] **Événement mi-run** (un mini-événement imprévu qui casse la courbe monotone vagues/boss/bonus une fois par run — ex: formation ennemie spéciale en anneau) — en réserve, pas pressé. Avant tout un design challenge (déclenché par quoi : vague fixe, score, temps écoulé ? les runs varient trop en durée pour un simple "milieu de partie") plutôt qu'un chantier de code : le niveau bonus fournit déjà l'échafaudage réutilisable (seuil de déclenchement, glissée d'entrée, message explicatif, garde anti-doublon), donc moins cher que ça en a l'air une fois la décision de design prise.

## Session 4 — mode paysage mobile (pas pressé)

Sur téléphone en paysage, de grosses bandes noires apparaissent à gauche/droite de l'aire de jeu. Cause : la résolution interne est fixée en 16:9 (480×270, `RES_W`/`RES_H` dans `config.js`), alors que la plupart des écrans de téléphone en paysage sont plus larges (proche de 20:9/21:9) — `resizeCanvas()` (`main.js`) contraint donc la largeur affichée au ratio 16:9 plutôt que de remplir tout l'écran.

- Note : le bouton **Plein écran** (2.74) retire la barre d'adresse mais **pas** ces bandes noires — le ratio 16:9 reste imposé par `resizeCanvas()`.
- [ ] **Élargir la résolution interne** (ou une autre approche à définir) pour réduire les bandes — changement d'architecture, pas un simple ajustement : touche le placement du HUD, les zones d'apparition/tir des ennemis (`LEFT_BOUND`/`FIRE_MIN_X` dans `enemies.js`), et nécessite une vraie vérification visuelle avant/après (pas juste les tests automatisés). À traiter dans une session dédiée avec le temps de bien tester, pas en aparté d'un autre correctif.

## Session 5 — polish (liste fermée, sans nouveau système de jeu)

Objectif : peaufiner l'existant (game feel, UX, boucle de rejouabilité) — **rien de nouveau côté systèmes de jeu**. Deux consignes : **liste fermée** (aucun ajout en cours de route ; une fois cochée, on déploie et on passe à la promotion) et **une valeur par défaut proposée pour chaque constante à tuner, notée « à ajuster au ressenti »**. Chaque item doit être vérifiable en jouant, avec une mesure objective.

| # | Item | Sévérité | Effort | Existant / mesure | Défaut (à ajuster au ressenti) |
|---|---|---|---|---|---|
| 1 | **Rejouer en 1 clic** : bouton « REJOUER » dès la mort, pseudo optionnel | Urgent | Moyen | Aujourd'hui : mort → pseudo → classement → menu → JOUER. Chronométrer d'abord ; objectif < 2 s, 1 clic | — |
| 2 | **Bonus « sans dégâts » visible pendant la vague** | Urgent | Faible | Existe en fin de vague (+500, bannière, `waves.js`). Ajouter un rappel HUD « INTACT » qui disparaît au premier coup. Mesure : compris sans lire l'Aide | ~7 px, or, clignote 1 s à la perte |
| 3 | **Mode attract** au menu (le jeu se joue seul) | Optionnel | Haut | N'existe pas : partie sans score ni son, bot qui esquive | Trajectoire pseudo-aléatoire + esquive du tir le plus proche |
| 4 | **Hit-stop calibré** (réservé aux événements rares) | Important | Faible | Existe (`triggerHitStop`), mais aussi sur les kills normaux. Mesure : 10 kills normaux contre 1 élite | Normal 0 ; élite 0,08 s ; point faible 0,13 s ; boss 0,14 s |
| 5 | **Paliers sonores du graze** | Important | Faible | Le son monte déjà avec la chaîne (`playGraze`) ; manque une signature aux seuils | Seuils 5/10/15, note plus haute + double tic |
| 6 | **Télégraphe des tirs circulaires du boss** | Important | Moyen | Aucun signal d'anticipation. Mesure : aucune mort « injuste » sur 5 boss | ~0,2 s |
| 7 | **Première minute** : lancement instantané, 1er bonus en 30 s | Important | Faible | Vérification. Mesures : clic → 1re image ; délai avant le 1er drop (10 parties) | Si > 30 s : plus de drops en vague 1 |
| 8 | **Indications contextuelles** : NOVA prête, son à l'apparition d'un kamikaze | Important | Faible | NOVA déjà signalée ; aucun son de kamikaze | Sifflement descendant ~0,15 s |
| 9 | **Messages de fin variables** (« Presque le boss ! ») | Optionnel | Faible | Réutilise `getRunSummary()` | 3-4 messages, règle simple |
| 10 | **Partage réel** testé (Twitter/Discord) | Important | Faible | QR lu à ≥ 400 px en local ; test manuel | — |

**Première session (4 items max)** : 1, 2, 4, 5. Les deux premiers ferment la boucle de rejouabilité, les deux suivants sont des constantes. Chronométrer l'item 1 avant de toucher au code, tout tester en jouant avant d'enchaîner sur 6-8.

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

## À faire

- [ ] Vérifier en production que `/js/graze.test.js`, `/js/package.json` et `/lib/PATCHES.md` répondent 404 (exclus de l'image par `frontend/.dockerignore`).
- [ ] **Prouver que `'unsafe-eval'` est requis** (côté CSP de l'infra, voir la Roadmap de `terraform-infra-pazpop-hetzner`) : c'est supposé, jamais testé. Tester la musique avec la CSP **sans** `'unsafe-eval'`, puis avec `'wasm-unsafe-eval'` seul, sur Chromium et Firefox, avant de conclure dans un sens ou dans l'autre.
- [ ] **Précharger les 5 pistes (156 Ko) et simplifier `music.js`.** La cause des 429 (rate-limit Traefik sur le statique) est retirée et la boucle de fin de piste est corrigée (6e round). Les retries (`_loadRetries`, backoff, `onError`, jeton `_loadToken`, `_loading`, ~60 lignes) ont été écrits pour ces pannes. Idée : charger les 5 `.xm` en mémoire au premier geste et appeler `player.play(buffer)` sans réseau. Garde-fous à adapter : `e2e/tests/music-retry.spec.js` et `music-end.spec.js`. Récit : [docs/audio-saga.md](docs/audio-saga.md).
- [ ] **Helper unique pour les conditions « combat suspendu ».** Prédicats dupliqués : `graze.js:49` (`!player.alive || invuln > 0 || waveBreak > 0 || dying || shipIntro || clearingScreen`) contre `states/playing.js:135, 425, 455` (`clearingScreen`, `bonusLevel`, `waveBreak`). Cette duplication est à l'origine du bug de la Session 1 (graze pendant le niveau bonus). Proposer `isCombatSuspended(g, player)` après avoir listé les différences volontaires entre sites ; les tests de `graze.test.js` couvrent déjà le cas.
- [ ] **Refonte du câblage DOM de `main.js`** (~350 lignes, une quinzaine de sections sans lien entre elles) : sortir le panneau du bas gauche (musique, volumes, tir auto, vitesse, aide, plein écran, CRT) dans un module. Objectif : lisibilité pour un débutant, comportement inchangé. Tests à relancer : `menu-pause`, `gameplay`, `consent`.
- [ ] **Features d'inspiration** (idées à évaluer, hors de la Session 5 qui reste une liste fermée) : manette via la Gamepad API (détection de connexion, analogique et croix, remappage — [SpeedLazer](https://github.com/speedlazer/speedlazer), [INNBC-STARFIGHTER](https://github.com/InnovativeBioresearch/INNBC-STARFIGHTER)) · interrupteurs de debug hitbox/FPS ([bullethell](https://github.com/selenebun/bullethell)) · démarrage à la vague N par paramètre d'URL ([galaga](https://github.com/civilian7/galaga), utile aux tests) · jeton de session serveur pour le score (le hachage côté client se contourne) · PWA installable hors ligne · leaderboard hebdomadaire · ralenti passif d'esquive (à étudier, inspiré du « slowdown » de bullethell).
- [ ] **Décision Traefik ou Caddy**, à reposer quand un 2e jeu se précise. Aujourd'hui : Traefik + docker-socket-proxy + portail pour un seul jeu. Un Caddy en frontal (~15 lignes, TLS automatique, `request_body max_size` natif) remplacerait Traefik et le conteneur frontal ; on perdrait le rate-limit (plugin tiers), le portail auto-généré et le routage par labels. Conclusion de la revue : garder tant qu'un 2e jeu est prévu. Fichiers concernés : repo `terraform-infra-pazpop-hetzner`.

## Autres (non séquencées)

- [ ] **Distance parcourue, phase 2** : l'ajouter au classement (changement de schéma serveur, non urgent).
- [ ] Test e2e comparant deux captures d'écran prises en pause (doivent être identiques bit à bit), si l'invariant de `drawScene()` (`states/playing.js`) doit être renforcé au-delà d'un commentaire.

- [ ] **Bandeau de consentement qui recouvre le bas du panneau de gauche** sur desktop (boutons Plein écran/version masqués tant que le visiteur n'a pas choisi) — le décaler ou le rétrécir. Cosmétique, rien d'urgent.
- [ ] **Permettre de changer son choix de consentement** (RGPD : retirer son accord aussi facilement qu'on l'a donné) : ajouter un bouton **« Cookies »** dans le panneau de gauche qui rouvre le bandeau (`js/consent.js` n'affiche aujourd'hui le bandeau que tant qu'aucun choix n'est mémorisé). Prévoir aussi un lien depuis le bandeau vers [docs/donnees-collectees.md](docs/donnees-collectees.md). À faire plus tard, pas urgent.
- [ ] **Tests e2e sur Firefox et WebKit** (Safari/iOS), pas seulement Chromium — ajouter deux projets dans `e2e/playwright.config.js`, voir quels tests passent (audio/AudioWorklet, plein écran absent sur iPhone). Le jeu vise le mobile, donc Safari compte. Pas urgent.
- [ ] Autres améliorations **côté infra** (durcissement de la CSP avec `'wasm-unsafe-eval'`, copie distante et alertes des backups) : suivies dans la *Roadmap* du README de [`terraform-infra-pazpop-hetzner`](https://github.com/pazpop/terraform-infra-pazpop-hetzner), car ce sont ses fichiers qui sont concernés.

- [ ] Score authentifié (jeton signé émis au début de la partie, exigé à la soumission) — pas urgent, le score non authentifié est un risque assumé (voir [docs/securite.md](docs/securite.md))
- [ ] Scan de vulnérabilités des **images construites** ([Trivy](https://trivy.dev/), en CI juste après le build) — `pip-audit` couvre les dépendances Python déclarées, mais pas les paquets système de l'image finale (ex: libs Debian de `python:3.11-slim`)

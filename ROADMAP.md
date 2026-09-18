# Roadmap

Organisée par session de travail suggérée (issue d'une discussion Lumo/Claude/arbitrage humain le 2026-09-18) plutôt qu'en vrac — chaque session est indépendante, à reprendre quand il y a du temps dédié.

## Session 1 — stabilisation (architecture `states/playing.js`) ✅ 2026-09-18

Issu d'une discussion à trois (utilisateur, Claude, revue croisée) sur la décomposition de `game.js` : contrairement aux écrans de `states/` (mutuellement exclusifs par construction, un seul MODE actif à la fois), les sous-systèmes de `playing.js` (collisions, NOVA, vagues, boss, niveau bonus) coexistent dans la même frame — les extraire en modules séparés déplacerait le couplage plutôt que de le réduire. Seule extraction retenue, grain jugé correct : un `waves.js` (le bloc `startWave` + la logique `waveBreak`/déclenchement du niveau bonus dans `update()`), même patron que `bonusLevel.js` (minuteur propre, champs `g` propres).

- [x] Extraire `waves.js` de `states/playing.js` — `startWave()` et la transition de vague/niveau bonus (`updateWaveTransition()`) déplacées ; `states/playing.js` passe de ~590 à ~495 lignes.
- [x] Fix : la clause de garde de `updateGraze()` (`graze.js`) ne vérifiait pas `g.bonusLevel`/`g.clearingScreen`, contrairement à `resolveCollisions()` — `|| g.clearingScreen` ajouté.
- [x] Test ajouté dans `frontend/js/graze.test.js` ("le graze ne progresse pas pendant clearingScreen"), avec un test de contrôle qui prouve que le même scénario grazerait bien sans la garde.
- [x] Commentaire de cartographie "qui écrit quoi" sur `g.novaStock`/`g.novaProgress` ajouté dans `states/playing.js`, juste avant `triggerNova()`.
- [x] Commentaire d'invariant ajouté en tête de `drawScene()` (`states/playing.js`).
- [ ] Option toujours en réserve, non faite : un test e2e comparant deux captures d'écran prises en pause (doivent être bit à bit identiques), si l'invariant ci-dessus doit être renforcé au-delà d'un commentaire un jour.

## Session 2 — nouvelles fonctionnalités (meilleur rapport effort/impact) ✅ 2026-09-18

- [x] **Distance parcourue, phase 1 (frontend seul)** — `g.distanceTraveled` accumulée proportionnellement au warp (`DISTANCE.lightYearsPerSecond`, `config.js`), affichée à l'écran de fin de partie et sur la carte de partage. Aucun changement backend. Phase 2 (classement, changement de schéma serveur) reste à faire, non urgente.
- [x] **QR code sur la carte de partage** (`shareCard.js`) — 100% client-side, encode directement `https://arcadepipe.pazpop.net`. Bibliothèque vendorisée dans `frontend/lib/qrcode.js` ([kazuhikoarase/qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator), MIT — pas celle de Nayuki envisagée initialement, qui n'existe qu'en TypeScript à compiler ; celle-ci est distribuée en JS pur, sans étape de build, cohérente avec le reste du projet). Noir sur blanc volontairement non stylisé (la scannabilité prime sur l'esthétique) — un test e2e (`share-qr.spec.js`) décode le QR après recompression JPEG et vérifie le contraste au pixel près (bug de teinte corrigé en 2.75). Créditée dans le README et l'écran crédits en jeu.

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

## Autres (non séquencées)

- [ ] Précharger les 5 pistes musicales en mémoire au premier geste (~156 Ko au total) au lieu d'un `fetch` à chaque changement de piste — envisagé pendant la saga audio, **plus justifié** depuis le 6e round (la cause de la boucle de requêtes n'était pas le réseau). Choix d'architecture optionnel, à ne reconsidérer que si de nouveaux incidents réseau réapparaissent.
- [ ] Score authentifié (jeton signé émis au début de la partie, exigé à la soumission) — pas urgent, le score non authentifié est un risque assumé (voir la section *Sécurité* du [README](README.md))
- [ ] Scan de vulnérabilités des **images construites** ([Trivy](https://trivy.dev/), en CI juste après le build) — `pip-audit` couvre les dépendances Python déclarées, mais pas les paquets système de l'image finale (ex: libs Debian de `python:3.11-slim`)

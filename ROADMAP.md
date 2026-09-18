# Roadmap

Organisée par session de travail suggérée (issue d'une discussion Lumo/Claude/arbitrage humain le 2026-09-18) plutôt qu'en vrac — chaque session est indépendante, à reprendre quand il y a du temps dédié.

## Session 1 — stabilisation (architecture `states/playing.js`) ✅ 2026-09-18

Issu d'une discussion à trois (utilisateur, Claude, revue croisée) sur la décomposition de `game.js` : contrairement aux écrans de `states/` (mutuellement exclusifs par construction, un seul MODE actif à la fois), les sous-systèmes de `playing.js` (collisions, NOVA, vagues, boss, niveau bonus) coexistent dans la même frame — les extraire en modules séparés déplacerait le couplage plutôt que de le réduire. Seule extraction retenue, grain jugé correct : un `waves.js` (le bloc `startWave` + la logique `waveBreak`/déclenchement du niveau bonus dans `update()`), même patron que `bonusLevel.js` (minuteur propre, champs `g` propres).

- [x] Extraire `waves.js` de `states/playing.js` — `startWave()` et la transition de vague/niveau bonus (`updateWaveTransition()`) déplacées ; `states/playing.js` passe de ~610 à ~495 lignes.
- [x] Fix : la clause de garde de `updateGraze()` (`graze.js`) ne vérifiait pas `g.bonusLevel`/`g.clearingScreen`, contrairement à `resolveCollisions()` — `|| g.clearingScreen` ajouté.
- [x] Test ajouté dans `frontend/js/graze.test.js` ("le graze ne progresse pas pendant clearingScreen"), avec un test de contrôle qui prouve que le même scénario grazerait bien sans la garde.
- [x] Commentaire de cartographie "qui écrit quoi" sur `g.novaStock`/`g.novaProgress` ajouté dans `states/playing.js`, juste avant `triggerNova()`.
- [x] Commentaire d'invariant ajouté en tête de `drawScene()` (`states/playing.js`).
- [ ] Option toujours en réserve, non faite : un test e2e comparant deux captures d'écran prises en pause (doivent être bit à bit identiques), si l'invariant ci-dessus doit être renforcé au-delà d'un commentaire un jour.

## Session 2 — nouvelles fonctionnalités (meilleur rapport effort/impact)

- [ ] **Distance parcourue, phase 1 (frontend seul)** — priorité la plus haute de la Roadmap actuelle : aucun changement backend requis (`g.distanceTraveled += vitesse × warp × dt` dans `states/playing.js`), affichage immédiat à l'écran de fin de partie et sur la carte de partage. Risque quasi nul (pas de DB, pas de logique de scoring touchée). Coche progressivement l'idée déjà notée dans `frontend/GAMEPLAY.md` (classement = phase 2, plus tard, demande un changement de schéma serveur).
- [ ] **QR code sur la carte de partage** (`shareCard.js`) — 100% client-side (contrairement au "lien court" écarté plus tôt, un QR code encode directement l'URL statique du jeu, pas besoin de backend). Ajouter une petite bibliothèque de génération QR vendorisée dans `lib/` (même principe que `chiptune3.js` déjà dans le repo — un seul fichier, sans dépendance), appelée lors de la génération de la carte. Utile surtout sur mobile, où scanner bat le recopiage manuel de l'URL.

## Session 3 — optimisations optionnelles (pas pressé)

- [ ] **Rang dynamique** (monte par tranche de X grazes sans dégât, redescend au coup encaissé, module vitesse des tirs/taux de spawn) — le code est simple (un `g.rank` + compteur, un multiplicateur lu par `bulletSpeedFactor`/le spawn d'ennemis/les intervalles de tir du boss), **le vrai coût est le tuning** : X grazes par palier, combien on perd par coup, ajuster jusqu'à ce que la pression soit juste — ça ne se devine pas, ça se joue et se réajuste. À lancer seulement quand le jeu est stable et qu'il y a du temps dédié au réglage, pas avant.
- [ ] **Cache session du classement** (`states/leaderboardScreen.js`) : chaque ouverture de l'écran classement refait `fetchTopScores(10)` **et** `fetchGamesPlayedCount()`, sans mémorisation — 5 ouvertures/fermetures = 10 requêtes. Payloads minuscules et rate-limiting déjà en place côté backend, donc gain estimé <10ms par session ; pas prioritaire, à faire seulement si un joueur signale une vraie lenteur (data-driven, pas préemptif). Si implémenté : un cache avec TTL court, **contrainte explicite — doit s'invalider après une soumission de score** (`confirmNameEntry` rouvre le classement juste après avoir soumis, `g.scores` doit rester frais à ce moment précis, jamais servir une version en cache à cet instant-là).
- [ ] **Événement mi-run** (un mini-événement imprévu qui casse la courbe monotone vagues/boss/bonus une fois par run — ex: formation ennemie spéciale en anneau) — en réserve, pas pressé. Avant tout un design challenge (déclenché par quoi : vague fixe, score, temps écoulé ? les runs varient trop en durée pour un simple "milieu de partie") plutôt qu'un chantier de code : le niveau bonus fournit déjà l'échafaudage réutilisable (seuil de déclenchement, glissée d'entrée, message explicatif, garde anti-doublon), donc moins cher que ça en a l'air une fois la décision de design prise.

## Autres (non séquencées)

- [ ] Score authentifié (jeton signé émis au début de la partie, exigé à la soumission) — pas urgent, le score non authentifié est un risque assumé (voir la section *Sécurité* du [README](README.md))
- [ ] Scan de vulnérabilités des **images construites** ([Trivy](https://trivy.dev/), en CI juste après le build) — `pip-audit` couvre les dépendances Python déclarées, mais pas les paquets système de l'image finale (ex: libs Debian de `python:3.11-slim`)

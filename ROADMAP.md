# Roadmap

Organisée par session de travail, chacune indépendante, à reprendre quand il y a du temps dédié. Ce qui est fait est dans le [CHANGELOG](CHANGELOG.md).

## Bugs signalés

Aucun en ce moment.

## Session 3 — optimisations optionnelles (pas pressé)

- [ ] **Rang dynamique** : monte par tranche de X grazes sans dégât, redescend au coup encaissé, module la vitesse des tirs et le spawn (un `g.rank` lu par `bulletSpeedFactor`, le spawn et le boss). Code simple ; **le vrai coût est le réglage**, à faire en jouant, quand le jeu est stable.
- [ ] **Événement mi-run** (ex. formation ennemie en anneau, une fois par partie) : surtout une question de design (déclenché par quoi ?). Le niveau bonus fournit déjà l'échafaudage (seuil, glissée d'entrée, message, garde anti-doublon).

## Session 4 — mode paysage mobile (pas pressé)

En paysage, des bandes noires encadrent le jeu : la résolution interne est en 16:9 (`RES_W`/`RES_H`), les téléphones sont plus larges (~20:9), et `resizeCanvas()` (`main.js`) garde le ratio. Le bouton Plein écran ne les retire pas.

- [ ] **Élargir la résolution interne** (ou autre approche) : touche le placement du HUD et les zones d'apparition et de tir des ennemis (`LEFT_BOUND`/`FIRE_MIN_X`, `enemies.js`). Session dédiée, avec vérification visuelle avant/après.

## Session 5 — polish (liste fermée, sans nouveau système de jeu)

Objectif : peaufiner l'existant (game feel, UX, boucle de rejouabilité) — **rien de nouveau côté systèmes de jeu**. Deux consignes : **liste fermée** (aucun ajout en cours de route ; une fois cochée, on déploie et on passe à la promotion) et **une valeur par défaut proposée pour chaque constante à tuner, notée « à ajuster au ressenti »**. Chaque item doit être vérifiable en jouant, avec une mesure objective.

| # | Item | Sévérité | Effort | Existant / mesure | Défaut (à ajuster au ressenti) |
|---|---|---|---|---|---|
| 3 | **Mode attract** au menu (le jeu se joue seul) | Optionnel | Haut | N'existe pas : partie sans score ni son, bot qui esquive | Trajectoire pseudo-aléatoire + esquive du tir le plus proche |
| 6 | **Télégraphe des tirs circulaires du boss** | Important | Moyen | Aucun signal d'anticipation. Mesure : aucune mort « injuste » sur 5 boss | ~0,2 s |
| 7 | **Première minute** : lancement instantané, 1er bonus en 30 s | Important | Faible | Vérification. Mesures : clic → 1re image ; délai avant le 1er drop (10 parties) | Si > 30 s : plus de drops en vague 1 |
| 8 | **Indications contextuelles** : NOVA prête, son à l'apparition d'un kamikaze | Important | Faible | NOVA déjà signalée ; aucun son de kamikaze | Sifflement descendant ~0,15 s |
| 9 | **Messages de fin variables** (« Presque le boss ! ») | Optionnel | Faible | Réutilise `getRunSummary()` | 3-4 messages, règle simple |
| 10 | **Partage réel** testé (Twitter/Discord) | Important | Faible | QR lu à ≥ 400 px en local ; test manuel | — |

**Prochains items** : 6, 7, 8, puis 10. Les items 2, 4 et 5 sont en place avec leurs valeurs par défaut (`HIT_STOP`, `GRAZE.milestones`, `config.js`) : **à valider en jouant**.

- [ ] 3 — Mode attract (optionnel, reporté)
- [ ] 6 — Télégraphe des tirs circulaires du boss
- [ ] 7 — Première minute vérifiée
- [ ] 8 — Indications contextuelles (NOVA, kamikaze)
- [ ] 9 — Messages de fin de partie variables
- [ ] 10 — Partage réel testé

## À faire

- [ ] **Jauge d'énergie « bullet time »** (idée, façon *Max Payne*) : une barre qui se remplit avec le score et se dépense pour ralentir le temps. À concevoir : touche et bouton tactile, vitesse de remplissage, durée, articulation avec la jauge NOVA (deux jauges à surveiller).
- [ ] **Menu Options** (idée) : interrupteur du filtre rétro CRT, aujourd'hui accessible seulement par la touche C, donc absent sur téléphone ; éventuellement une qualité d'affichage. Le ratio d'écran relève de la Session 4.
- [ ] **Traductions** : faire relire l'anglais (`frontend/js/i18n/en.js`) ; les balises `<meta>` de `index.html` (description, Open Graph) restent en français. Changer de langue recharge la page (voir `nextLang`, `i18n.js`).
- [ ] **Helper unique pour les conditions « combat suspendu ».** Prédicats dupliqués : `updateGraze` (`graze.js`) contre `resolveCollisions` et `update` (`states/playing.js`). Proposer `isCombatSuspended(g, player)` après avoir listé les différences voulues ; `graze.test.js` couvre déjà le cas du niveau bonus.
- [ ] **Refonte du câblage DOM de `main.js`** (~350 lignes, une quinzaine de sections sans lien entre elles) : sortir le panneau du bas gauche (musique, volumes, tir auto, vitesse, aide, plein écran, CRT) dans un module. Objectif : lisibilité pour un débutant, comportement inchangé. Tests à relancer : `menu-pause`, `gameplay`, `consent`.
- [ ] **Features d'inspiration** (idées à évaluer, hors de la Session 5 qui reste une liste fermée) : manette via la Gamepad API (détection de connexion, analogique et croix, remappage — [SpeedLazer](https://github.com/speedlazer/speedlazer), [INNBC-STARFIGHTER](https://github.com/InnovativeBioresearch/INNBC-STARFIGHTER)) · interrupteurs de debug hitbox/FPS ([bullethell](https://github.com/selenebun/bullethell)) · démarrage à la vague N par paramètre d'URL ([galaga](https://github.com/civilian7/galaga), utile aux tests) · jeton de session serveur pour le score (le hachage côté client se contourne) · PWA installable hors ligne · leaderboard hebdomadaire · ralenti passif d'esquive (à étudier, inspiré du « slowdown » de bullethell).

## Autres (non séquencées)

- [ ] **Distance parcourue, phase 2** : l'ajouter au classement (changement de schéma serveur, non urgent).
- [ ] Test e2e comparant deux captures d'écran prises en pause (doivent être identiques bit à bit), si l'invariant de `drawScene()` (`states/playing.js`) doit être renforcé au-delà d'un commentaire.

- [ ] **Tests e2e sur Firefox et WebKit** (Safari/iOS), pas seulement Chromium — ajouter deux projets dans `e2e/playwright.config.js`, voir quels tests passent (audio, plein écran absent sur iPhone). Le jeu vise le mobile, donc Safari compte. Pas urgent.
- [ ] Côté **infra** (décision Traefik ou Caddy, copie distante et alertes des backups) : suivi dans la *Roadmap* du README de [`terraform-infra-pazpop-hetzner`](https://github.com/pazpop/terraform-infra-pazpop-hetzner).

- [ ] Score authentifié (jeton signé émis au début de la partie, exigé à la soumission) — pas urgent, le score non authentifié est un risque assumé (voir [docs/securite.md](docs/securite.md))
- [ ] Scan de vulnérabilités des **images construites** ([Trivy](https://trivy.dev/), en CI juste après le build) — `pip-audit` couvre les dépendances Python déclarées, mais pas les paquets système de l'image finale (ex: libs Debian de `python:3.13-slim`)

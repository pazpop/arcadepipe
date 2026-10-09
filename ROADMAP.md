# Roadmap

Ce qui reste à faire, par ordre de priorité. Ce qui est fait est dans le [CHANGELOG](CHANGELOG.md).

## Avant la publication officielle

- [ ] **Vérifier sur un vrai téléphone** les commandes dans les bandes noires en paysage (Pause, onglet du panneau, NOVA) et l'encoche.
- [ ] **Valider en jouant les réglages par défaut** : micro-gel à l'impact (`HIT_STOP`) et paliers sonores du frôlement (`GRAZE.milestones`), dans `config.js`.
- [ ] **Faire relire l'anglais** (`frontend/js/i18n/en.js`).
- [ ] **Cinquième morceau de mall-e** : l'ajouter à `AUDIO.tracks` (`config.js`) et au README.
- [ ] **Tester le partage en conditions réelles** (Twitter, Discord) : l'image s'affiche, le QR code se lit.
- [ ] **Première minute** : mesurer le délai avant le premier bonus sur dix parties ; s'il dépasse 30 s, augmenter les chances de drop en vague 1.

## Jeu

- [ ] **Télégraphe des tirs circulaires du boss** : un signal d'environ 0,2 s avant un anneau ou une spirale. Mesure : aucune mort « injuste » sur cinq combats.
- [ ] **Son à l'apparition d'un kamikaze** (à voir, pas sûr d'en vouloir) : sifflement descendant d'environ 0,15 s.
- [ ] **Cadence du boss** : elle accélère par deux mécanismes cumulés (`phaseSpeed` et l'intervalle dans `updateBoss`, `boss.js`), si bien que le plancher de 0,35 s n'en est pas un. N'en garder qu'un, puis régler en jouant.
- [ ] **Messages de fin de partie variables** (« Presque le boss ! »), à partir de `getRunSummary()`.
- [ ] **Remplir l'écran des téléphones en paysage** (idée) : le jeu reste en 16:9, avec les commandes dans les bandes noires. Élargir la zone de jeu toucherait le HUD, les zones d'apparition et de tir des ennemis (`LEFT_BOUND`, `FIRE_MIN_X`, `enemies.js`) et l'équité du classement entre écrans.
- [ ] **Menu Options** : y déplacer les réglages du panneau (filtre rétro, langue...), éventuellement une qualité d'affichage.
- [ ] **Changer de langue sans recharger la page** (voir `nextLang`, `i18n.js`) et traduire les balises `<meta>` de `index.html` (titre et description des liens partagés, en français seulement).
- [ ] **Distance parcourue au classement** (change le schéma de la base).

## Idées à évaluer

- **Jauge d'énergie « bullet time »**, façon *Max Payne* : une barre qui se remplit avec le score et se dépense pour ralentir le temps. À concevoir : touche et bouton tactile, vitesse de remplissage, durée, cohabitation avec la jauge NOVA.
- **Rang dynamique** : la difficulté monte par tranche de frôlements sans dégât et redescend au coup encaissé. Le code est simple, le réglage long.
- **Événement en cours de partie**, par exemple une formation ennemie en anneau.
- **Mode attract** : le jeu se joue seul derrière le menu.
- Manette (Gamepad API) · démarrage à la vague N par paramètre d'URL · PWA installable hors ligne · classement hebdomadaire · interrupteurs de debug (hitbox, FPS).

## Technique

- [ ] **Score authentifié** : jeton signé émis au début de la partie, exigé à l'envoi. Le score non authentifié est un risque assumé (voir [docs/securite.md](docs/securite.md)).
- [ ] **Rate limiting en IPv6** : compter par préfixe /64 plutôt que par adresse (`get_client_ip`, `backend/main.py`), si l'instance publique est joignable en IPv6.
- [ ] **Tests e2e** : les réglages du panneau (volumes, vitesse), le bouton Partager ; Firefox et WebKit en plus de Chromium (`e2e/playwright.config.js`) ; les lancer dans la CI.
- [ ] **Dépendances de développement épinglées** (`backend/requirements-dev.txt`, et `ruff`, `pip-audit` dans la CI).
- [ ] **Scan des images construites** ([Trivy](https://trivy.dev/)) en CI : `pip-audit` ne couvre pas les paquets système de l'image.
- [ ] **Infra** (Traefik ou Caddy, copie distante et alertes des sauvegardes) : suivi dans le README de [`terraform-infra-pazpop-hetzner`](https://github.com/pazpop/terraform-infra-pazpop-hetzner).

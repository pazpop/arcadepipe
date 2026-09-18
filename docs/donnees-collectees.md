# Données collectées

- **Pseudo, score, vague, ennemis abattus** (`player_name` 1-20 caractères, `score`, `wave`, `kills`) : stockés dans SQLite, sans limite de rétention. À cela s'ajoute un **compteur global de parties jouées** (`POST /api/games`, sans payload ni donnée sur le joueur).
- **Adresse IP** : lue depuis `X-Forwarded-For` uniquement pour le rate limiting, gardée en mémoire le temps de la fenêtre (5/min), jamais écrite en base ni dans un log applicatif.
- **Google Analytics** (`js/analytics.js`, gtag.js), sur l'instance publique `arcadepipe.pazpop.net` : cookies de mesure d'audience, **chargés uniquement après consentement** (bandeau Accepter/Refuser, `js/consent.js`, choix mémorisé dans `localStorage`). La CSP du reverse-proxy (repo d'infra) doit autoriser `googletagmanager.com` et `google-analytics.com`, sinon le tag est bloqué.
- **Sur l'appareil du joueur** (`localStorage`) : préférences (volumes, tir automatique, vitesse, filtre CRT, panneau replié, dernier pseudo), choix de consentement, aide déjà vue.

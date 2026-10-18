# Données collectées

Version destinée aux joueurs, en français et en anglais : [`frontend/privacy.html`](../frontend/privacy.html). Les deux doivent rester d'accord.

- **Pseudo, score, vague, ennemis abattus** (`player_name` 1 à 8 caractères, `score`, `wave`, `kills`), avec la date et l'heure de l'envoi : stockés dans SQLite tant que le score reste parmi les 10 000 meilleurs, puis environ quatre semaines de plus dans les sauvegardes de l'instance publique. La date et l'heure ne sont pas publiées. À cela s'ajoute un **compteur global de parties jouées** (`POST /api/games`, sans donnée sur le joueur : seulement la date et l'heure).
- **Adresse IP** : lue depuis `X-Forwarded-For` uniquement pour le rate limiting, gardée en mémoire environ un jour (limite d'envois de scores par jour), jamais écrite en base ni dans les journaux du backend. En déploiement autonome (`docker-compose.yml`), le serveur du frontend (Caddy) ne note une requête, adresse comprise, que lorsqu'elle échoue parce que le backend est arrêté. Sur l'instance publique, le Caddy de l'infra reçoit les requêtes avant lui : ce qu'il note dépend de sa configuration.
- **Pas de mesure d'audience** : le jeu ne charge aucun script de mesure et ne dépose aucun cookie. Sur itch.io, la page qui accueille le jeu suit les règles d'itch.io.
- **Sur l'appareil du joueur** (`localStorage`) : préférences (volumes, son coupé, dernière piste, tir automatique, vitesse, filtre CRT, panneau replié, dernier pseudo, langue), record personnel, aide déjà vue.

# Sécurité

## En place

- **CORS** restreint (`ALLOWED_ORIGINS`, jamais `"*"`), requêtes SQL paramétrées, entrées validées (Pydantic).
- **Aucune surface XSS** : le pseudo n'est jamais inséré dans du HTML (rendu Canvas côté client, JSON côté serveur).
- **Rate limiting** (`slowapi`, par IP réelle via `X-Forwarded-For` derrière un reverse-proxy de confiance) : `POST /api/scores` 5/min, `POST /api/games` 10/min, `GET /api/scores` et `GET /api/games/count` 60/min.
- **Conteneurs** backend et frontend non-root, rootfs read-only, `cap_drop: ALL` (le frontend garde `NET_BIND_SERVICE`, nécessaire à Caddy non-root sur le port 80).
- **Taille des requêtes** `POST /api/*` plafonnée à 10 Ko par le reverse-proxy, sur les routes API uniquement (jamais sur les fichiers statiques ou la musique).
- **Sauvegarde** quotidienne de la base SQLite, gérée dans le repo d'infra (`backup/`).

## Non fait volontairement

- **Score non authentifié** : la triche est possible via `curl` (score borné à 999 999). Piste : jeton de session serveur, voir la ROADMAP.
- **En-têtes HTTP** (HSTS, CSP...) : laissés au reverse-proxy de qui déploie. L'instance publique les pose via Traefik ; le `docker-compose.yml` autonome n'en ajoute pas.
- **`player_name`** borné à 20 *codepoints* Unicode, pas à 20 caractères visuels : sans impact sécurité (rendu Canvas, pas de HTML), et le jeu filtre déjà la saisie à `[A-Z0-9 ]`.

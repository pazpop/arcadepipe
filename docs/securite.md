# Sécurité

## En place

- **CORS** restreint (`ALLOWED_ORIGINS`, jamais `"*"` par défaut), requêtes SQL paramétrées, entrées validées (Pydantic).
- **Pseudo** limité à ce que le jeu saisit : 1 à 8 lettres majuscules, chiffres ou espaces.
- **Table des scores bornée** : seuls les 10 000 meilleurs sont gardés (100 au plus sont lisibles). La marge protège les vrais scores : de faux scores peuvent occuper le classement, mais il en faut 10 000 meilleurs qu'un vrai pour l'effacer, soit 200 jours d'envois depuis une même adresse IP. Une fois les faux supprimés de la base, les vrais reviennent.
- **Aucune surface XSS** : le pseudo n'est jamais inséré dans du HTML (rendu Canvas côté client, JSON côté serveur).
- **Rate limiting** (`slowapi`, par IP réelle via `X-Forwarded-For` derrière un reverse-proxy de confiance) : `POST /api/scores` 5/min et 50/jour, `POST /api/games` 10/min, `GET /api/scores` et `GET /api/games/count` 60/min.
- **Conteneurs** backend et frontend non-root, rootfs read-only, `cap_drop: ALL` (le frontend garde `NET_BIND_SERVICE`, nécessaire à Caddy non-root sur le port 80).
- **Taille des requêtes** vers `/api/*` plafonnée à 10 Ko par le reverse-proxy (Caddy en déploiement autonome, Traefik sur l'instance publique), jamais sur les fichiers statiques ou la musique.
- **Sauvegarde** quotidienne de la base SQLite, gérée dans le repo d'infra (`backup/`).

## Non fait volontairement

- **Score non authentifié** : la triche est possible via `curl` (score borné à 999 999). Piste : jeton de session serveur, voir la ROADMAP.
- **Origine d'itch.io partagée** : `https://html-classic.itch.zone`, autorisée par CORS sur l'instance publique, sert tous les jeux HTML d'itch.io. Une autre page hébergée là peut donc envoyer des scores depuis le navigateur de ses visiteurs. Cela n'ajoute rien à ce que `curl` permet déjà, et le rate limiting s'applique de la même façon.
- **En-têtes HTTP** (HSTS, CSP...) : laissés au reverse-proxy de qui déploie. L'instance publique les pose via Traefik ; le `docker-compose.yml` autonome n'en ajoute pas.
- **Compteur de parties** : une ligne par partie dans la table `games`, sans limite (30 octets par ligne, 10 écritures par minute et par IP au plus).

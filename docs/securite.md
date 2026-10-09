# Sécurité

## En place

- **CORS** restreint (`ALLOWED_ORIGINS`, jamais `"*"` par défaut), requêtes SQL paramétrées, entrées validées (Pydantic).
- **Pseudo** limité à ce que le jeu saisit : 1 à 8 lettres majuscules, chiffres ou espaces.
- **Table des scores bornée** : seuls les 10 000 meilleurs sont gardés (100 au plus sont lisibles). La marge protège les vrais scores : de faux scores peuvent occuper le classement, mais il en faut 10 000 meilleurs qu'un vrai pour l'effacer, soit 200 jours d'envois depuis une même adresse IP. Un attaquant qui dispose de nombreuses adresses va plus vite (voir plus bas) : le recours est alors la sauvegarde quotidienne. Tant que les vrais scores sont en base, supprimer les faux les fait revenir.
- **Aucune surface XSS** : le pseudo n'est jamais inséré dans du HTML (rendu Canvas côté client, JSON côté serveur).
- **Rate limiting** (`slowapi`, par IP réelle via `X-Forwarded-For` derrière un reverse-proxy de confiance, compteurs en mémoire, remis à zéro à chaque redémarrage) : `POST /api/scores` 5/min et 50/jour, `POST /api/games` 10/min, `GET /api/scores` et `GET /api/games/count` 60/min.
- **Conteneurs** backend et frontend non-root, rootfs read-only, `cap_drop: ALL` (le frontend garde `NET_BIND_SERVICE` : le binaire de Caddy porte cette capacité et ne démarre pas sans elle).
- **Taille des requêtes** vers `/api/*` plafonnée à 10 Ko par le reverse-proxy (Caddy en déploiement autonome, Traefik sur l'instance publique), jamais sur les fichiers statiques ou la musique.
- **Sauvegarde** quotidienne de la base SQLite, gérée dans le repo d'infra (`backup/`).

## Non fait volontairement

- **Score non authentifié** : la triche est possible via `curl` (score borné à 999 999). Piste : jeton de session serveur, voir la ROADMAP.
- **Origine d'itch.io partagée** : `https://html-classic.itch.zone`, autorisée par CORS sur l'instance publique, sert tous les jeux HTML d'itch.io. Une autre page hébergée là peut donc envoyer des scores depuis le navigateur de ses visiteurs, chacun avec sa propre adresse IP, donc son propre quota : un jeu malveillant et très fréquenté pourrait remplir la table en un jour. Un réseau de machines obtient le même résultat avec `curl`.
- **Compteur de parties ouvert à tout site** : `POST /api/games` n'a ni corps ni en-tête particulier, donc n'importe quelle page web peut le déclencher depuis le navigateur de ses visiteurs (10 par minute et par adresse IP). Seul un compteur d'affichage est en jeu. La table `games` reçoit une ligne par partie, sans limite (30 octets par ligne).
- **En-têtes HTTP** (HSTS, CSP...) : à poser par le reverse-proxy qui reçoit les joueurs. Ne pas en placer un second devant Caddy ou Traefik (nginx, Cloudflare...) : le rate limiting verrait la même adresse IP pour tout le monde, et quelques requêtes suffiraient à bloquer l'envoi de scores pour tous les joueurs. L'instance publique les pose via Traefik ; le `docker-compose.yml` autonome n'en ajoute pas.

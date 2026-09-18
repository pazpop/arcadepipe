# Déploiement

## Docker (autonome)

`docker-compose.yml`, à la racine, fait tourner tout le jeu (backend + frontend) sans dépendance externe : il publie le port 80 et garde les protections de sécurité (non-root, rootfs read-only, `cap_drop: ALL`, rate limiting, CORS). Caddy (frontend) route lui-même `/api/*` vers le backend.

```bash
docker compose up --build -d
# -> http://localhost
```

Port 80 déjà pris ? Changer le mapping `"80:80"` du service `frontend` (ex. `"8080:80"`) et adapter `ALLOWED_ORIGINS` du service `backend`.

C'est le seul fichier de déploiement Docker de ce repo. Celui qui ajoute Traefik et TLS pour l'instance publique vit dans le repo d'infra séparé.

## CI/CD

`.github/workflows/deploy.yml` : sur push vers `main`, lint backend (`ruff`), audit des dépendances (`pip-audit`), lint frontend (`eslint`), puis build et push des images vers GHCR (`:latest` et `:<sha>`, public).

- Actions GitHub épinglées par SHA de commit, images de base épinglées par digest : un tag peut être redéplacé, un SHA ou un digest non.
- [Dependabot](../.github/dependabot.yml) ouvre une PR à chaque mise à jour (`pip`, `github-actions`, `docker`).
- **Choix assumé : les tests (`pytest`, `node --test`, Playwright) ne tournent pas en CI**, seulement le lint et l'audit. Ils sont lancés à la main avant de pousser. Risque : un push qui casse un test est quand même buildé et déployé. Acceptable pour l'instant (un seul développeur, suite e2e d'environ 2 minutes) ; à reconsidérer si le rythme ou le nombre de contributeurs augmente.

Ce repo ne connaît ni VPS ni serveur cible. L'instance `arcadepipe.pazpop.net` est déployée par [`terraform-infra-pazpop-hetzner`](https://github.com/pazpop/terraform-infra-pazpop-hetzner), notifié par un événement `repository_dispatch` une fois les images publiées. Un fork n'a pas ce déclenchement (secret absent) et n'en a pas besoin : voir la section Docker ci-dessus.

⚠️ GHCR crée les packages en **privé** au premier push : après le premier run, les passer en public dans *Package Settings* (sinon `docker compose pull` échoue sans authentification).

# Backend

FastAPI + `sqlite3` natif — API du classement.

| Route | Rôle |
| --- | --- |
| `GET /api/health` | l'API répond |
| `GET /api/scores?limit=10` | meilleurs scores (100 au maximum) |
| `POST /api/scores` | enregistre un score (`player_name`, `score`, `wave`, `kills`) |
| `GET /api/games/count` | nombre total de parties jouées |
| `POST /api/games` | compte une partie terminée |

Variables d'environnement : `DB_PATH` (fichier SQLite, `./arcadepipe.db` par défaut) et `ALLOWED_ORIGINS` (origines autorisées par CORS, séparées par des virgules ; `http://localhost:5500` par défaut). Cette dernière ne sert que si le jeu et l'API ne sont pas servis à la même adresse, comme en développement.

En local, l'API écoute sur http://localhost:8000 : http://localhost:8000/api/health doit répondre `{"status":"ok"}`.

## Lancer en local

Les commandes sont dans le [README principal](../README.md#lancer-en-local). `seed.py` ajoute quelques scores de départ si la base est vide.

Retirer un score (demande d'un joueur, faux score) se fait à la main dans la base. En local : `sqlite3 arcadepipe.db "DELETE FROM scores WHERE player_name = 'PSEUDO';"`. Dans le conteneur, qui n'a pas la commande `sqlite3` :

```bash
docker compose exec backend python -c "import os, sqlite3; c = sqlite3.connect(os.environ['DB_PATH']); c.execute('DELETE FROM scores WHERE player_name = ?', ('PSEUDO',)); c.commit()"
```

## Tests

- `tests/test_main.py` : validation des scores et lecture de l'IP du client.
- `tests/test_api.py` : les routes, via `TestClient`, sur une base SQLite temporaire par test.
- `tests/test_rate_limit.py` : le rate limiting, que `test_api.py` désactive pour ses propres tests.

```bash
pip install -r requirements-dev.txt && pytest
```

## Lint

Voir `pyproject.toml` (vérifié en CI avant chaque build, voir [docs/deploiement.md](../docs/deploiement.md#cicd)) :

```bash
ruff check .   # inclus dans requirements-dev.txt ci-dessus
```

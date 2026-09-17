# Backend

FastAPI + `sqlite3` natif — API du leaderboard.

## Lancer en local

```bash
python -m venv venv && source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt && python seed.py && uvicorn main:app --reload
```

## Tests

Logique pure (`tests/test_main.py` : validation des scores, `get_client_ip`) + intégration HTTP (`tests/test_api.py` : vraies routes FastAPI via `TestClient`, DB SQLite temporaire par test) + rate limiting réellement exercé (`tests/test_rate_limit.py`, fixture séparée avec le limiter actif — `test_api.py` le désactive pour ses propres tests) :

```bash
pip install -r requirements-dev.txt && pytest   # 27 tests
```

## Lint

Voir `pyproject.toml` (vérifié en CI avant chaque build — voir *CI/CD* dans le README racine) :

```bash
ruff check .   # inclus dans requirements-dev.txt ci-dessus
```

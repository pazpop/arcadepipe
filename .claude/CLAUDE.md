# ArcadePipe : règles pour l'assistant

Méthode commune : `../methode/METHODE.md`. Ce fichier ne contient que les divergences et ce qui est propre au
projet.

Type : jeu (@../../methode/JEUX.md), web (@../../methode/WEB.md). Statut : PROD.

Jeu web public : frontend JS vanilla + Canvas (`frontend/`), backend FastAPI/SQLite (`backend/`), tests de bout en bout Playwright (`e2e/`). Lire d'abord `README.md`, `frontend/README.md` et `docs/`.

## Git

- Dépôt public.

## Version, CHANGELOG, ROADMAP

- `VERSION` reste `"dev"` dans `frontend/js/config.js` : la CI le remplace.
- Chaque commit qui touche le jeu ajoute une entrée au `CHANGELOG.md`, numérotée selon la règle en tête du fichier.
- Un élément fini est retiré de `ROADMAP.md`.

## Anti-régression

- Après toute suppression : `python tools/check_unused.py`.

## Tests à lancer

- Frontend : `node --test` dans `frontend/js` ; `npm ci && npm run lint` dans `frontend/` (aucun avertissement toléré).
- Backend : `pytest` dans `backend/` (environnement dans `backend/venv`, ignoré par git : `pip install -r requirements-dev.txt`) ; `ruff check backend`.
- Bout en bout : `npm ci`, `npx playwright install chromium`, `npx playwright test` dans `e2e/` (les tests du classement demandent `backend/venv`).

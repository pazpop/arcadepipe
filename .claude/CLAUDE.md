# ArcadePipe : règles pour l'assistant

Lire d'abord `../methode/METHODE.md` (dépôt privé du propriétaire), à chaque reprise. Ce fichier ne contient que les
divergences et ce qui est propre au projet.

Jeu web public : frontend JS vanilla + Canvas (`frontend/`), backend FastAPI/SQLite (`backend/`), tests de bout en bout Playwright (`e2e/`). Lire d'abord `README.md`, `frontend/README.md` et `docs/`.

## Git

- Jamais de tag ni de release : c'est le propriétaire qui s'en charge.
- Dépôt public.
- Le déploiement n'est pas ici : il se fait à la main depuis le dépôt privé `infra-pazpop-hetzner`. Ce dépôt teste et publie les images sur GHCR (`.github/workflows/image.yml`).

## Version, CHANGELOG, ROADMAP

- `VERSION` reste `"dev"` dans `frontend/js/config.js` : la CI le remplace.
- Chaque commit qui touche le jeu ajoute une entrée au `CHANGELOG.md`, numérotée selon la règle en tête du fichier.
- Un élément fini est retiré de `ROADMAP.md`.

## Anti-régression

Divergence : plus strict que la méthode.

- Ce qu'on cherche avant de modifier comprend le clavier et le doigt (tactile).
- Tout changement du jeu : un test qui échoue, puis la correction, puis casser exprès pour vérifier que le test le voit.
- Après toute suppression : `python tools/check_unused.py`.

## Tests à lancer

- Frontend : `node --test` dans `frontend/js` ; `npm ci && npm run lint` dans `frontend/` (aucun avertissement toléré).
- Backend : `pytest` dans `backend/` (environnement dans `backend/venv`, ignoré par git : `pip install -r requirements-dev.txt`) ; `ruff check backend`.
- Bout en bout : `npm ci`, `npx playwright install chromium`, `npx playwright test` dans `e2e/` (les tests du classement demandent `backend/venv`).

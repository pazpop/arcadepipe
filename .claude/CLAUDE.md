# ArcadePipe : règles pour l'assistant

Jeu web public : frontend JS vanilla + Canvas (`frontend/`), backend FastAPI/SQLite (`backend/`), tests de bout en bout Playwright (`e2e/`). Lire d'abord `README.md`, `frontend/README.md` et `docs/`.

## Git

- Commits locaux directement sur `main`. **Jamais de push**, ni de tag, ni de release : le propriétaire pousse lui-même.
- Un commit par sujet.
- Dépôt public : aucun nom réel, courriel personnel, adresse IP réelle ni chemin de machine dans le code, les commits ou la doc. Seul le pseudonyme `pazpop`.
- Le déploiement n'est pas ici : il se fait à la main depuis le dépôt privé `infra-pazpop-hetzner`. Ce dépôt teste et publie les images sur GHCR (`.github/workflows/image.yml`).

## Version, CHANGELOG, ROADMAP

- `VERSION` reste `"dev"` dans `frontend/js/config.js` : la CI le remplace.
- Chaque commit qui touche le jeu ajoute une entrée au `CHANGELOG.md`, numérotée selon la règle en tête du fichier.
- Un élément fini est retiré de `ROADMAP.md`.

## Anti-régression

1. Chercher tout ce qui utilise la chose modifiée : clavier, doigt (tactile), tests, doc.
2. Écrire un test qui échoue, puis la correction.
3. Casser exprès pour vérifier que le test le voit.
4. Après toute suppression : `python tools/check_unused.py`.
5. Ne jamais annuler un travail non commité avec `git checkout` ou `git restore`.

## Tests à lancer

- Frontend : `node --test` dans `frontend/js` ; `npm ci && npm run lint` dans `frontend/` (aucun avertissement toléré).
- Backend : `pytest` dans `backend/` (environnement dans `backend/venv`, ignoré par git : `pip install -r requirements-dev.txt`) ; `ruff check backend`.
- Bout en bout : `npm ci`, `npx playwright install chromium`, `npx playwright test` dans `e2e/` (les tests du classement demandent `backend/venv`).

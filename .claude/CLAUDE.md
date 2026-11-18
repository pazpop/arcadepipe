# ArcadePipe : règles pour l'assistant

Méthode commune : `../methode/METHODE.md`. Ce fichier ne contient que les divergences et ce qui est propre au
projet.

Type : jeu, web. Statut : PROD.
@../../methode/JEUX.md
@../../methode/WEB.md

Jeu web public, sans serveur : JS vanilla + Canvas (`frontend/`), publié à la main sur itch.io
(`tools/build_itch.py`), classement dans le navigateur (`frontend/js/scores.js`) ; tests de bout en bout Playwright
(`e2e/`). Lire d'abord `README.md`, `frontend/README.md` et `docs/`.

Divergence avec `WEB.md` : pas d'image GHCR ni de déploiement par infra-pazpop-hetzner (archivé) ; la CI teste
seulement.

## Git

- Dépôt public.

## Version, CHANGELOG, ROADMAP

- `VERSION` reste `"dev"` dans `frontend/js/config.js` : `tools/build_itch.py` le remplace dans l'archive.
- Chaque commit qui touche le jeu ajoute une entrée au `CHANGELOG.md`, numérotée selon la règle en tête du fichier.
- Un élément fini est retiré de `ROADMAP.md`.

## Anti-régression

- Après toute suppression : `python tools/check_unused.py`.

## Tests à lancer

- Frontend : `node --test` dans `frontend/js` ; `npm ci && npm run lint` dans `frontend/` (aucun avertissement toléré).
- Bout en bout : `npm ci`, `npx playwright install chromium`, `npx playwright test` dans `e2e/` (il faut `python`
  pour servir le jeu).

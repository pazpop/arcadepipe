# Frontend

JS vanilla (modules ES6) + Canvas 2D — shoot'em up à défilement horizontal, pixel art généré par code.

Ce que le jeu implémente, système par système : [`GAMEPLAY.md`](GAMEPLAY.md).

## Lancer en local

```bash
python -m http.server 5500   # http://localhost:5500
```

## Tests

Logique pure des modules JS, aucune dépendance npm (Node ≥ 18) :

```bash
cd js && node --test   # 16 tests
```

Rien du canvas, de la souris/du tactile ni de l'audio n'est couvert ici — voir [`../e2e/README.md`](../e2e/README.md) pour les tests bout-en-bout (Playwright) qui pilotent un vrai navigateur.

## Lint

Config minimale (`eslint:recommended`, voir `eslint.config.js`) — vérifiée en CI avant chaque build (voir *CI/CD* dans le README racine), symétrique de `ruff` côté backend. `package.json` ici ne sert qu'à ça : le jeu lui-même reste du JS vanilla servi tel quel, aucune dépendance d'exécution.

```bash
npm install && npm run lint
```

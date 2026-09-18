# Tests bout-en-bout (Playwright)

Les tests de `backend/` et `frontend/js/` couvrent la logique pure, mais pas le canvas, la souris/le tactile ni l'audio. Ce dossier pilote un vrai navigateur (Chromium) sur le jeu, comme le ferait un joueur : il attrape surtout les vraies casses (erreur JS, bouton mort, écran figé). Le rendu canvas n'est pas inspectable comme du DOM : le « joli » reste à l'œil humain, via les captures de `test-results/`.

```bash
cd e2e
npm install
npm run install-browsers   # télécharge Chromium (une fois)
npm test                   # ou : npx playwright test --headed
```

`npm test` démarre le serveur statique du frontend (port 5500). Résultats et captures dans `test-results/` (ignoré par git).

## Ce qui est couvert (`tests/`)

- `menu-pause` — menu, pause, confirmation de sortie, aide (bienvenue, menu, pause, bouton du panneau)
- `gameplay` — tir manuel/auto, choix de piste, session prolongée, saisie du pseudo
- `powerups-boss` — bonus, bouclier, premier boss
- `graze-nova` — frôlements, jauge NOVA, bouton tactile
- `bonus-level` — niveau bonus et récompense
- `music-retry` — un 429 sur les `.xm` ne déclenche pas de rafale de requêtes
- `music-end` — une fin de piste ne provoque qu'**une** requête (latence simulée : le serveur local, trop rapide, masque le bug)
- `consent` — Google Analytics jamais chargé avant « Accepter » ; bouton Plein écran
- `share-qr` — le QR de la carte de partage se décode après recompression JPEG ; contraste vérifié au pixel

## Forcer une constante le temps d'un test

Sans exposer de point d'accès de debug en production : les modules ES sont mis en cache par URL, donc un import dynamique depuis le test récupère les *mêmes* objets que la partie en cours.

```js
await page.evaluate(async () => {
  const { DIFFICULTY } = await import("/js/config.js");
  DIFFICULTY.baseWaveKills = 1; // vague suivante en 1 kill au lieu de 10
});
```

Marche pour tout module déjà chargé : `config.js` (constantes), `main.js` (instances `music`/`audio`). Voir `tests/helpers.js` : `skipHints()` masque aussi le bandeau de consentement, qui recouvrirait les boutons du bas de l'écran.

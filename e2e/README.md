# Tests bout-en-bout (Playwright)

Les tests de `backend/` et `frontend/js/` couvrent la logique pure, mais pas le canvas, la souris/le tactile ni l'audio. Ce dossier pilote un vrai navigateur (Chromium) sur le jeu, comme le ferait un joueur : il attrape surtout les vraies casses (erreur JS, bouton mort, écran figé). Le rendu canvas n'est pas inspectable comme du DOM : le « joli » reste à l'œil humain, via les captures de `test-results/`.

```bash
cd e2e
npm install
npm run install-browsers   # télécharge Chromium (une fois)
npm test                   # ou : npx playwright test --headed
```

`npm test` démarre le serveur statique du frontend (port 5500) avec `python`, qui doit donc être installé. Si l'environnement du backend existe (`backend/venv`, voir son [README](../backend/README.md)), il démarre aussi le backend sur le port 8001, avec une base vide, pour les tests du classement ; sinon ces tests sont sautés. Les autres tests tournent sans backend : les appels au classement échouent, ce que le jeu gère. Résultats et captures dans `test-results/` (ignoré par git).

## Ce qui est couvert (`tests/`)

- `menu-pause` — menu, pause (scène figée), confirmation de sortie, aide (bienvenue, menu, pause, bouton du panneau), clavier et focus, panneau replié, plein écran, filtre rétro
- `gameplay` — tir manuel et automatique, choix de piste, fin de vague, fin de partie sans serveur
- `powerups-boss` — bonus (arme, bouclier, les deux ensemble), premier boss, vie perdue, boss vaincu
- `graze-nova` — frôlements, jauge NOVA, bouton tactile
- `bonus-level` — le niveau bonus se déclenche, se termine, puis la partie reprend
- `music-retry` — un 429 sur les pistes ne déclenche pas de rafale de requêtes
- `music-end` — une fin de piste enchaîne sur une autre piste, qui joue réellement
- `consent` — mesure d'audience désactivée par défaut ; activée, Google Analytics jamais chargé avant « Accepter », bouton Cookies (changer ou retirer son choix)
- `i18n` — langue du navigateur par défaut, changement de langue mémorisé
- `mobile` — téléphone en paysage : commandes dans les bandes noires, le vaisseau suit le doigt et tire
- `leaderboard` — avec le vrai backend : scores du serveur triés, pseudo saisi puis score inscrit, REJOUER
- `pages` — page de confidentialité et kit presse
- `share-qr` — le QR de la carte de partage se décode après recompression JPEG ; contraste vérifié au pixel

## Attendre un état, pas un délai

Un délai fixe (`page.waitForTimeout`) rend un test instable : trop court sur une machine chargée, il échoue au hasard ; et une action tombée au mauvais moment (un clic pendant le ralenti de mort, par exemple) est ignorée sans que le test ne le voie. On attend donc l'état réel du jeu, lu dans la page via l'instance `game` exportée par `main.js` (`tests/helpers.js`) :

```js
await startRun();                    // clique JOUER et attend le mode "playing" ("help" si l'aide de bienvenue s'ouvre)
await page.keyboard.press("KeyP");
await waitForMode(page, "paused");   // modes : js/states/mode.js
await expect.poll(async () => (await gameState(page)).wave).toBe(2);
```

Les clics sont traités aussitôt (`handleTap`), les touches à la frame suivante : après une touche, toujours attendre l'état voulu. Un délai fixe reste légitime seulement quand la **durée elle-même** est ce qu'on vérifie (aucune requête ni aucun tir pendant N secondes), ou comme pause entre deux essais d'une boucle bornée qui relit l'état du jeu.

## Forcer une constante le temps d'un test

Sans exposer de point d'accès de debug en production : les modules ES sont mis en cache par URL, donc un import dynamique depuis le test récupère les *mêmes* objets que la partie en cours.

```js
await page.evaluate(async () => {
  const { DIFFICULTY } = await import("/js/config.js");
  DIFFICULTY.baseWaveKills = 1; // vague suivante en 1 kill au lieu de 10
});
```

Marche pour tout module déjà chargé : `config.js` (constantes), `main.js` (instances `music` et `game`). Voir `tests/helpers.js` : `skipHints()` saute l'aide de bienvenue, `enableAnalytics()` active la mesure d'audience pour les tests du bandeau.

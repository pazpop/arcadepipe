# Tests bout-en-bout (Playwright)

`backend`/`frontend/js` (voir le README racine) couvrent la logique pure, mais rien du canvas, de la souris/du tactile ni de l'audio — c'est ce que ce dossier teste, en pilotant un vrai navigateur (Chromium) sur le jeu tel qu'un joueur le vivrait.

> **C'est quoi, "bout-en-bout" (e2e) ?** Un petit robot qui joue au jeu à ta place : il ouvre un vrai navigateur, bouge la souris, clique, attend, prend des captures d'écran — exactement ce qu'on ferait à la main pour vérifier qu'un changement n'a rien cassé, mais écrit une fois et rejouable en une commande (`npm test`) au lieu de tout refaire manuellement à chaque modification. Il ne juge pas si un écran est "joli" (ça reste à l'œil humain via les captures dans `test-results/`) — il attrape surtout les vraies casses : une erreur JS, un bouton qui ne répond plus, un écran qui reste figé.

```bash
cd e2e
npm install
npm run install-browsers   # télécharge Chromium pour Playwright (une fois)
npm test                   # ou : npx playwright test --headed pour voir le navigateur
```

`npm test` démarre et arrête automatiquement le serveur statique du frontend (port 5500, même commande que "Lancer en local" dans le README racine) — pas besoin de le lancer à la main. Les résultats (dont un rapport HTML en cas d'échec) et les captures d'écran atterrissent dans `test-results/` (ignoré par git).

**Ce qui est couvert** (voir `tests/`) :
- `menu-pause.spec.js` — chargement du menu, clic souris dans la pause, confirmation de sortie de partie, aide de bienvenue (première partie), accès à l'aide depuis le menu/la pause/le bouton du panneau
- `gameplay.spec.js` — tir manuel vs tir auto (+ persistance), sélection aléatoire de piste musicale, session de jeu prolongée (vague 1 → 2), saisie du nom (nom aléatoire pré-rempli + validation tactile, sans clavier)
- `powerups-boss.spec.js` — ramassage de bonus (un seul à la fois), bouclier (absorption de coups), premier combat de boss
- `graze-nova.spec.js` — frôlement des tirs, remplissage de la jauge NOVA, déclenchement via le bouton tactile
- `bonus-level.spec.js` — déclenchement du niveau bonus, défilement des anneaux, récompense NOVA

**Limite volontaire** : le rendu canvas n'est pas inspectable comme du DOM, donc pas d'assertion pixel-exacte possible. Ces tests valident surtout l'absence d'erreurs JS sur de vraies séquences d'interaction, avec des captures d'écran pour la vérification visuelle humaine — pas un remplacement total du "lancer le jeu et regarder", plutôt un filet qui attrape les régressions qui plantent (erreurs JS, écran figé, flux cassé).

**Forcer une constante le temps d'un test** (taux de drop d'un bonus, difficulté d'une vague...) sans toucher au code source ni exposer de point d'accès de debug en production : les modules ES sont mis en cache par URL par le navigateur, donc un import dynamique déclenché depuis le test récupère les *mêmes* objets déjà utilisés par la partie en cours, pas une copie isolée :

```js
await page.evaluate(async () => {
  const { DIFFICULTY } = await import("/js/config.js");
  DIFFICULTY.baseWaveKills = 1; // vague suivante en 1 kill au lieu de 10
});
```

Ça marche pour n'importe quel module déjà chargé par la page — `config.js` pour les constantes, ou `main.js` pour atteindre les instances `music`/`audio` (voir l'export en bas de `frontend/js/main.js`). Voir `tests/helpers.js` pour le détail et d'autres exemples.

# Changelog

Changements notables (gameplay, visuel, audio, infra), plus récent en premier. `VERSION` (`frontend/js/config.js`) vaut `2.<nombre de commits>` au dernier commit qui touche le jeu (les commits doc/infra ne l'incrémentent pas). Avant 2.43, ou pour le détail d'une entrée condensée : `git log`.

## [2.116] - 2026-10-08
- **Rejouer en 1 clic.** L'écran GAME OVER propose REJOUER (par défaut) et CLASSEMENT à la place de « OK ». REJOUER relance aussitôt : avant, il fallait 3 ou 4 clics (OK, valider le pseudo, classement, JOUER). Le score n'est pas perdu : s'il entre dans le top 10, il est envoyé en arrière-plan sous le pseudo mémorisé, ou un nom de pilote aléatoire.

## [2.115] - 2026-10-08
- **Fix : textes illisibles.** Le jeu était dessiné en 480×270 puis agrandi : un texte de 7 px n'avait que 7 pixels de haut. Le canvas est maintenant rendu à la résolution de l'écran (densité plafonnée à 2), le jeu dessine toujours en coordonnées 480×270 (`renderScale`, `main.js`). Sprites inchangés.

## [2.114] - 2026-10-08
- **Fix : les ennemis pouvaient tirer vers l'arrière.** Un élite ou un gunner ne tire plus que si le joueur est devant lui (`enemies.test.js`).
- Fix : le bandeau de consentement recouvrait le bas du panneau de gauche ; il est maintenant en haut de l'écran.
- Panneau de gauche : barres de volume musique et bruitages alignées, libellé « MUSIQUE (by Mall-E) ».

## [2.113] - 2026-10-07
- **Quatrième morceau** de [mall-e](https://mall-e.bandcamp.com/) dans la playlist (`fourth.mp3`, en ligne depuis le 2026-10-07 sous le numéro 2.107).
- Backend : Python 3.13 (image Docker, CI et cible de ruff) et FastAPI 0.142.2.

## [2.107] - 2026-09-30
- Boss plus résistant : 5 PV par point faible au lieu de 3, 4 pour le premier boss.

## [2.106] - 2026-09-30
- **Fix : le boss pouvait être détruit avant son premier tir.** Ses points faibles encaissaient des dégâts pendant son entrée (~3,3 s). Il est maintenant invulnérable pendant une entrée plus rapide, et tire presque aussitôt arrivé.
- Tests backend : `httpx2` à la place de `httpx`, déprécié par starlette 1.7.
- Docs : références au lecteur tracker retiré mises à jour, nouvelle capture d'écran dans le README.

## [2.100] - 2026-09-30
- **Nouvelle musique** : 3 morceaux originaux de [mall-e](https://mall-e.bandcamp.com/), en MP3, crédité et remercié dans le jeu et le README.
- Lecteur tracker (`.xm`, libopenmpt, chiptune3) retiré : les pistes sont lues par un simple élément `<audio>` branché sur l'AudioContext des bruitages. Plus de WebAssembly, donc plus besoin de `'unsafe-eval'` dans la CSP.

## [2.93] - 2026-09-30
- Zoom du navigateur autorisé (accessibilité) ; le canvas bloque toujours les gestes pendant le jeu (`touch-action: none`).
- Nettoyage : CSS sans `!important`, meta `keywords` retirée, tests backend sans état global partagé, ROADMAP raccourcie (sujets d'infra suivis côté terraform).

## [2.92] - 2026-09-30
- Fix : téléchargement de la carte de partage (URL libérée après un délai ; révoquée aussitôt, certains navigateurs annulaient le téléchargement).

## [2.91] - 2026-09-30
- Fix : l'Aide ouverte depuis le menu principal reprend à la page 1.
- Tests e2e bonus et bouclier : vérifient le ramassage réel et la règle « un seul bonus à la fois » au lieu de simples attentes fixes.

## [2.90] - 2026-09-30
- Nettoyage sans changement de comportement : client HTTP du classement déplacé de `js/audio/leaderboard.js` vers `js/api.js`, références périmées corrigées dans les commentaires et les docs, commentaires historiques retirés. Docs raccourcies (GAMEPLAY.md, tableau de la Session 5 de la ROADMAP). CI : `npm ci`.

## [2.88] - 2026-09-30
- **Fix : musique parfois muette pendant toute la première partie.** Une piste envoyée au lecteur avant qu'il soit prêt (nœud audio pas encore créé, ou WASM de libopenmpt pas encore chargé) était perdue sans erreur. Les messages attendent maintenant que le lecteur soit prêt ([correctif n° 4](frontend/lib/PATCHES.md)).
- Tests e2e : attente de l'état réel du jeu (`waitForMode`, `gameState`) au lieu de délais fixes ; `music-end` stable, et le test du boss atteint enfin un combat de boss.

## [2.87] - 2026-09-30
- Fix : taper M ou C dans le pseudo coupait le son / basculait le filtre CRT. Raccourcis clavier ajoutés à l'écran Aide.
- CI : les tests backend (`pytest`) et frontend (`node --test`) bloquent désormais le build.
- Nettoyage sans changement de comportement : code mort (`watchAudioContext`, gardes audio inutiles, migration `kills`), commentaires faux ou historiques.

## [2.82] - 2026-09-18
- Nettoyage sans changement de comportement : stockage local factorisé (`js/storage.js`), exports inutiles retirés, commentaires raccourcis, `frontend/.dockerignore` (tests et docs ne sont plus servis en production).
- Docs en 3 couches : README racine réduit, détail dans `docs/` (déploiement, sécurité, données collectées), CHANGELOG et ROADMAP condensés.

## [2.76] - 2026-09-18
- **Fix : musique qui ne redémarre jamais en fin de piste, boucle de GET sur les `.xm`, RAM qui grimpe.** Le worklet reposta `end` à chaque quantum audio ; chaque `end` relançait un `fetch`. Reproduit par `music-end.spec.js` (2031 requêtes en 6 s à 150 ms de latence).
- Fix (infra) : `favicon.svg` absent de l'image Docker (404).

## [2.75] - 2026-09-18
- Fix : QR code de la carte de partage teinté (l'ombre du texte précédent restait active). Test e2e qui décode le QR après recompression JPEG.

## [2.74] - 2026-09-18
- Bandeau de consentement RGPD : Google Analytics n'est chargé qu'après « Accepter » (`js/consent.js`).
- Bouton Plein écran dans le panneau de gauche (masqué si l'API est absente, ex. iPhone).

## [2.73] - 2026-09-18
- Google Analytics ajouté sur l'instance publique (CSP ajustée côté infra).

## Versions antérieures (condensé)

- **2.71** — Ennemis : plus de tir depuis le tiers gauche. Fix musique (abandon définitif après 3 essais) et boucle de requêtes sur `onError`. Tactile : vaisseau plus éloigné du doigt.
- **2.64** — Écran Aide en une colonne, 4 pages.
- **2.63** — Distance parcourue (années-lumière) à l'écran de fin et sur la carte de partage ; QR code sur la carte (`lib/qrcode.js`).
- **2.62** — Refactor : `states/waves.js` extrait de `playing.js`. Fix : le graze pouvait charger la jauge NOVA pendant le niveau bonus.
- **2.61** — Konami code : tilt du canvas synchronisé avec le jingle.
- **2.60** — Fix : anneau des planètes dessiné en deux moitiés (avant/arrière).
- **2.59** — Favicon (SVG repris du sprite du vaisseau).
- **2.58 / 2.57** — Nettoyage : `playEnemyShot()` jamais appelée supprimée ; initialisation audio simplifiée.
- **2.56** — Fix musique (compteur d'essais jamais remis à zéro dans `playRandom()`). Aide sur 2 pages, bouton Partager recentré, trou noir du décor moins fréquent.
- **2.55** — Partage de run en un clic (image score/vague/kills/chaîne). Fix : spam console `AudioContext suspendu`, double soumission de score. Jauge « NOVA x/max », sprite terni des ennemis touchés, nouveau jingle Konami, étoiles scintillantes (menu et niveau bonus). Limite de 10 Ko sur `POST /api/*` (infra).
- **2.54** — Refactor : `game.js` (~1000 lignes) découpé en un module par écran sous `states/`.
- **2.53** — Cause des coupures de musique confirmée par l'onglet Réseau : des 429 traités comme des fichiers audio. Vérification du statut HTTP, retry différé.
- **2.52** — Musique : reprise périodique de l'`AudioContext` et logs de diagnostic.
- **2.51** — Nettoyage : doublons de code éliminés (`game.js`, `sfx.js`, `hud.js`, `boss.js`).
- **2.50** — Gunner à 2 PV ; pastilles de PV retirées au profit de la légende de l'écran Aide.
- **2.49** — ESLint en CI ; test isolé du rate limiting ; ce fichier créé.
- **2.48** — Fix fuite mémoire du lecteur tracker et reprise de l'`AudioContext` au retour d'onglet. Niveau bonus : entrée en douceur et message explicatif.
- **2.46** — Niveau bonus (série d'anneaux, récompense NOVA), Konami code, kamikazes plafonnés à 2, son NOVA dédié.
- **2.43** — Graze (frôler un tir ou un ennemi rapporte des points et charge la jauge) ; NOVA devient une ressource stockable, déclenchable à la demande.

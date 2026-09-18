# Changelog

Changements notables (gameplay, visuel, audio, infra), plus récent en premier. `VERSION` (`frontend/js/config.js`) vaut `2.<nombre de commits>` au dernier commit qui touche le jeu (les commits doc/infra ne l'incrémentent pas). Avant 2.43, ou pour le détail d'une entrée condensée : `git log`.

## [2.82] - 2026-09-18
- Nettoyage sans changement de comportement : stockage local factorisé (`js/storage.js`), exports inutiles retirés, commentaires raccourcis, `frontend/.dockerignore` (tests et docs ne sont plus servis en production).
- Docs en 3 couches : README racine réduit, détail dans `docs/` (déploiement, sécurité, données collectées, [saga audio](docs/audio-saga.md) intégrale), CHANGELOG et ROADMAP condensés.

## [2.76] - 2026-09-18
- **Fix : musique qui ne redémarre jamais en fin de piste, boucle de GET sur les `.xm`, RAM qui grimpe.** Le worklet reposta `end` à chaque quantum audio ; chaque `end` relançait un `fetch`. Reproduit par `music-end.spec.js` (2031 requêtes en 6 s à 150 ms de latence). Récit : [docs/audio-saga.md](docs/audio-saga.md), round 6.
- Fix (infra) : `favicon.svg` absent de l'image Docker (404).

## [2.75] - 2026-09-18
- Fix : QR code de la carte de partage teinté (l'ombre du texte précédent restait active). Test e2e qui décode le QR après recompression JPEG.

## [2.74] - 2026-09-18
- Bandeau de consentement RGPD : Google Analytics n'est chargé qu'après « Accepter » (`js/consent.js`).
- Bouton Plein écran dans le panneau de gauche (masqué si l'API est absente, ex. iPhone).

## [2.73] - 2026-09-18
- Google Analytics ajouté sur l'instance publique (CSP ajustée côté infra).

## Versions antérieures (condensé)

- **2.71** — Ennemis : plus de tir depuis le tiers gauche. Fix musique (5e round : abandon définitif après 3 essais) et boucle de requêtes sur `onError`. Tactile : vaisseau plus éloigné du doigt. → [audio-saga](docs/audio-saga.md)
- **2.64** — Écran Aide en une colonne, 4 pages.
- **2.63** — Distance parcourue (années-lumière) à l'écran de fin et sur la carte de partage ; QR code sur la carte (`lib/qrcode.js`).
- **2.62** — Refactor : `states/waves.js` extrait de `playing.js`. Fix : le graze pouvait charger la jauge NOVA pendant le niveau bonus.
- **2.61** — Konami code : tilt du canvas synchronisé avec le jingle.
- **2.60** — Fix : anneau des planètes dessiné en deux moitiés (avant/arrière).
- **2.59** — Favicon (SVG repris du sprite du vaisseau).
- **2.58 / 2.57** — Nettoyage : `playEnemyShot()` jamais appelée supprimée ; initialisation audio simplifiée.
- **2.56** — Fix musique (4e round : compteur d'essais jamais remis à zéro dans `playRandom()`). Aide sur 2 pages, bouton Partager recentré, trou noir du décor moins fréquent.
- **2.55** — Partage de run en un clic (image score/vague/kills/chaîne). Fix : spam console `AudioContext suspendu`, double soumission de score. Jauge « NOVA x/max », sprite terni des ennemis touchés, nouveau jingle Konami, étoiles scintillantes (menu et niveau bonus). Limite de 10 Ko sur `POST /api/*` (infra).
- **2.54** — Refactor : `game.js` (~1000 lignes) découpé en un module par écran sous `states/`.
- **2.53** — Cause des coupures de musique confirmée par l'onglet Réseau : des 429 traités comme des fichiers audio. Vérification du statut HTTP, retry différé. → [audio-saga](docs/audio-saga.md), round 3
- **2.52** — Musique : reprise périodique de l'`AudioContext` et logs de diagnostic.
- **2.51** — Nettoyage : doublons de code éliminés (`game.js`, `sfx.js`, `hud.js`, `boss.js`).
- **2.50** — Gunner à 2 PV ; pastilles de PV retirées au profit de la légende de l'écran Aide.
- **2.49** — ESLint en CI ; test isolé du rate limiting ; ce fichier créé.
- **2.48** — Fix fuite mémoire du lecteur tracker (2e round) et reprise de l'`AudioContext` au retour d'onglet. Niveau bonus : entrée en douceur et message explicatif.
- **2.46** — Niveau bonus (série d'anneaux, récompense NOVA), Konami code, kamikazes plafonnés à 2, son NOVA dédié.
- **2.43** — Graze (frôler un tir ou un ennemi rapporte des points et charge la jauge) ; NOVA devient une ressource stockable, déclenchable à la demande.

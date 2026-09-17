# Changelog

Journal des changements notables (gameplay, visuel, audio, infra) — pas les simples ajustements numériques. Adapté au versionnement automatique de ce projet plutôt qu'à SemVer classique : `VERSION` (`frontend/js/config.js`) vaut `2.<nombre de commits>`, jamais choisi à la main (voir `frontend/GAMEPLAY.md`, section *Suivi de version*). Une entrée par version qui mérite d'être racontée, la plus récente en premier.

**Historique non rétro-rempli avant 2.43** — ce fichier démarre à sa création plutôt que de reconstituer tout l'historique Git. `git log` reste la source exhaustive pour ce qui précède.

## [2.50] - 2026-09-17
- Ajustement : gunner (bleu) ramené à 2 PV (au lieu de 3) — écart avec l'élite (3 PV) plus net.
- Retrait : pastilles de PV au-dessus des sprites (gunner/élite), jugées superflues en plein jeu.
- Ajout : PV de chaque type d'ennemi (hors boss) listés dans l'écran Aide, à la place des pastilles.

## [2.49] - 2026-09-17
- Infra : ESLint (config minimale) ajouté côté frontend, vérifié en CI aux côtés de ruff ; test de rate limiting isolé côté backend (le garde-fou 5/minute n'était jamais réellement exercé automatiquement) ; ce fichier créé.
- Nettoyage : paramètre `particlePool` mort dans `updateBoss` (jamais utilisé), trois initialisations de variable inutiles dans `game.js` (trouvés par ESLint).

## [2.48] - 2026-09-17
- Fix : fuite mémoire dans le lecteur de musique tracker (`chiptune3.worklet.js`) provoquant l'arrêt silencieux et définitif de la musique sur une session longue — deuxième cause distincte du même symptôme déjà partiellement corrigé (voir *Retour d'expérience* dans `GAMEPLAY.md`).
- Fix : l'`AudioContext` est repris explicitement au retour sur l'onglet — certains navigateurs le suspendent en arrière-plan sans jamais le reprendre eux-mêmes.
- Niveau bonus : entrée en douceur du vaisseau + message explicatif avant le premier anneau ; silhouette d'arrière-plan (easter egg) bien plus visible tôt dans le niveau.

## [2.46] - 2026-09-17
- Ajout : niveau bonus (traverser une série d'anneaux, récompense proportionnelle qui remplit la jauge NOVA), offert tous les 10 vagues si le score atteint un seuil par cycle.
- Ajout : Konami code (easter egg sonore, aucun effet de jeu).
- Ajustement : le gunner (bleu) encaisse autant qu'une élite (+2 PV) ; kamikazes plafonnés à 2 actifs simultanément ; le NOVA a son propre son "large" au lieu de réutiliser l'explosion normale.

## [2.43] - 2026-09-17
- Ajout : graze (frôler un tir ou le corps d'un ennemi sans le toucher rapporte des points et charge une jauge) + NOVA devient une ressource stockable déclenchable à la demande (clavier/bouton tactile) au lieu d'un drop aléatoire à effet immédiat.

---

*Comment ajouter une entrée : une ligne par changement notable, sous le numéro de `VERSION` du commit qui le porte. Pas nécessaire pour un ajustement purement numérique (équilibrage, couleur, timing) sans nouveau système.*

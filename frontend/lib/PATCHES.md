# Correctifs locaux sur les bibliothèques vendorisées

Ce dossier contient du code tiers copié tel quel, **sauf** `chiptune3.worklet.js`, qui porte 3 correctifs faits à la main. Remplacer ce fichier par une version « propre » (mise à jour de [chiptune3](https://github.com/DrSnuggles/chiptune), par exemple) **les fait disparaître** : à réappliquer, ou à vérifier un par un.

`chiptune3.js` et `libopenmpt.worklet.js` sont inchangés par rapport à l'amont. Les correctifs sont aussi commentés « Corrigé » dans le code, à côté des lignes concernées.

| # | Où (`chiptune3.worklet.js`) | Problème amont | Correctif | Si perdu | Comment le vérifier |
|---|---|---|---|---|---|
| 1 | `play()` | Le fichier `.xm` copié dans le tas WASM (`ptrToFile`) n'est jamais libéré. | `libopenmpt._free(ptrToFile)` juste après `_openmpt_module_create_from_memory`. | Fuite de dizaines/centaines de Ko à chaque changement de piste ; le tas WASM finit par s'épuiser, plus de musique. | Pas de test automatique — relire `play()`. |
| 2 | `stop()` | Libère `leftBufferPtr`/`rightBufferPtr`, des noms jamais définis : les vrais buffers (`leftPtr`/`rightPtr`, alloués dans `play()`) ne sont jamais libérés. | Libérer `leftPtr`/`rightPtr`. | Seconde fuite, à chaque piste. | Pas de test automatique — relire `stop()`. |
| 3 | `process()` et `stop()` | Une fois le module terminé, `process()` (~375 appels/s) reposte `end` (ou `err`) **à chaque appel** tant qu'aucune piste n'est rechargée. | `this.stop()` après avoir posté `end`/`err` (un seul message), et `stop()` ne fait plus de retour anticipé quand `modulePtr` vaut déjà 0 (le cas d'erreur doit libérer `leftPtr`/`rightPtr`). | Chaque `end` relance un `fetch` : avec la moindre latence réseau, boucle de requêtes sans fin, plus jamais de musique, RAM qui grimpe. | `e2e/tests/music-end.spec.js` (150 ms de latence simulée : une seule requête après la fin d'une piste). |

Contexte détaillé de ces bugs : `frontend/GAMEPLAY.md`, section *Retour d'expérience* (2e round pour 1 et 2, 6e round pour 3).

## Checklist si `chiptune3.worklet.js` est remplacé

1. Réappliquer les 3 correctifs ci-dessus (ou vérifier que la nouvelle version amont les contient).
2. `cd e2e && npx playwright test music-end` doit passer.
3. Jouer une session avec plusieurs changements de piste en surveillant la mémoire de l'onglet (les correctifs 1 et 2 ne sont pas couverts par un test).

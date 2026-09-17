// Tests pour grazeScoreForChain()/novaMaxForWave() (graze.js) — logique pure.
// Lancer : node --test frontend/js/*.test.js (aucune dépendance npm requise).
import { test } from "node:test";
import assert from "node:assert/strict";

import { grazeScoreForChain, novaMaxForWave } from "./graze.js";
import { GRAZE, DIFFICULTY } from "./config.js";

test("le score d'un graze scale avec la taille de la chaîne", () => {
  assert.equal(grazeScoreForChain(1), GRAZE.baseScore);
  assert.equal(grazeScoreForChain(4), GRAZE.baseScore * 4);
});

test("avant la vague du 2e boss : une seule charge NOVA max", () => {
  assert.equal(novaMaxForWave(1), 1);
  assert.equal(novaMaxForWave(DIFFICULTY.bossWaveEvery * 2 - 1), 1);
});

test("dès la vague du 2e boss : deux charges NOVA max", () => {
  assert.equal(novaMaxForWave(DIFFICULTY.bossWaveEvery * 2), 2);
  assert.equal(novaMaxForWave(DIFFICULTY.bossWaveEvery * 2 + 3), 2);
});
